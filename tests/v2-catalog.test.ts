import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import type {CatalogDatabase,SqlValue,Statement} from '../shared/v2/database';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import {getCatalogCounts,getCoffeeDetail,getPriceHistory,getRoasterDetail,getSavedCoffees,getSimilarCoffees,listCatalog,listEvents,listRoasters} from '../shared/v2/catalog';
import {rankQuizMatches} from '../shared/v2/quiz-rank';
import type {CrawlInput,SourceCoffee} from '../shared/v2/types';
import {applyD1Limits,applyMigrations} from './helpers/v2-sqlite';

class SQLite implements CatalogDatabase {
  db=new DatabaseSync(':memory:');
  constructor(){applyMigrations(this.db);}
  prepare(sql:string):Statement{return new Prepared(this,sql);}
  async batch(statements:Statement[]){this.db.exec('BEGIN');try{const results=statements.map(s=>{const p=s as Prepared;return this.db.prepare(p.sql).run(...p.values);});this.db.exec('COMMIT');return results;}catch(error){this.db.exec('ROLLBACK');throw error;}}
}
class Prepared implements Statement {
  values:SqlValue[]=[];constructor(readonly owner:SQLite,readonly sql:string){}
  bind(...values:SqlValue[]){this.values=values;return this;}
  async first<T>(){return(this.owner.db.prepare(this.sql).get(...this.values)??null)as T|null;}
  async all<T>(){return{results:this.owner.db.prepare(this.sql).all(...this.values)as T[],success:true};}
}
const product=(id:string,override:Partial<SourceCoffee>={}):SourceCoffee=>({sourceProductId:id,canonicalUrl:`https://shop.test/${id}`,name:`Coffee ${id}`,visibility:'public',rawMetadata:{country:'Ethiopia',varieties:['Gesha']},
  offers:[{sourceVariantId:`sku-${id}`,label:'250g',weightG:250,price:100,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:`https://shop.test/${id}`}],...override});
const run=(day:number,products:SourceCoffee[]):CrawlInput=>({id:`run${day}`,roasterId:'r',startedAt:`2026-01-0${day}T00:00:00.000Z`,completedAt:`2026-01-0${day}T00:01:00.000Z`,status:'success',parserVersion:'test',products,diagnostics:[]});
async function setup(){const db=new SQLite();await registerRoaster(db,{id:'r',slug:'roaster',name:'Roaster',websiteUrl:'https://shop.test',adapter:'test'});return db;}

test('canonical current counts agree across catalog, roasters and detail with unknown/dead stock excluded',async()=>{
  const db=await setup();const a=product('a'),b=product('b'),hidden=product('hidden',{visibility:'hidden'});b.offers[0].inStock=null;
  await ingestCrawl(db,run(1,[a,b,hidden]));
  const counts=await getCatalogCounts(db);assert.deepEqual({...counts},{coffees:1,roasters:1,offers:1});
  const list=await listCatalog(db);assert.equal(list.total,counts.coffees);assert.equal(list.coffees.length,1);
  assert.equal((await listRoasters(db))[0].coffeeCount,counts.coffees);
  assert.equal((await getRoasterDetail(db,'roaster'))?.catalog.total,counts.coffees);
  assert.equal(list.coffees[0].offers[0].unitPriceTry,40);
  a.offers[0].inStock=false;await ingestCrawl(db,run(2,[a,b,hidden]));
  assert.equal((await listCatalog(db)).total,0);
  const detail=await getCoffeeDetail(db,list.coffees[0].slug);assert.equal(detail?.offers[0].inStock,false);assert.equal((await getPriceHistory(db,detail!.id)).length,2);assert.equal('priceHistory' in detail!,false,'the coffee page reads no price history');
  assert.equal(detail?.latestEvents[0].type,'OUT_OF_STOCK');
  assert.equal(await getCoffeeDetail(db,'hidden'),null);
  assert.equal((await listEvents(db,'OUT_OF_STOCK')).length,1);
  db.db.close();
});
test('a coffee absent from successful crawls for over 7 days leaves the catalog; failed crawls never hide it',async()=>{
  const db=await setup();const a=product('a'),b=product('b');
  const at=(day:string,products:SourceCoffee[],status:CrawlInput['status']='success'):CrawlInput=>({...run(1,products),id:`run-${day}`,startedAt:`2026-01-${day}T00:00:00.000Z`,completedAt:`2026-01-${day}T00:01:00.000Z`,status});
  await ingestCrawl(db,at('01',[a,b]));
  await ingestCrawl(db,at('08',[a]));
  assert.equal((await getCatalogCounts(db)).coffees,2,'exactly 7 days since last sighting is still current');
  await ingestCrawl(db,at('09',[a]));
  assert.deepEqual((await listCatalog(db)).coffees.map(c=>c.sourceProductId),['a']);
  assert.equal((await getCatalogCounts(db)).coffees,1);
  assert.equal(db.db.prepare('SELECT coffees FROM catalog_counts').get()?.coffees,1);
  assert.equal(db.db.prepare("SELECT in_stock FROM offers WHERE source_variant_id='sku-b'").get()?.in_stock,1,'no stock state is written');
  await ingestCrawl(db,at('30',[],'failed'));
  assert.equal((await getCatalogCounts(db)).coffees,1,'an outage keeps the last successful catalog');
  await ingestCrawl(db,at('31',[a,b]));
  assert.equal((await getCatalogCounts(db)).coffees,2,'a returning coffee is current again');
  db.db.close();
});
test('filters use declared and inferred features without misrepresenting raw source, search is parameterized, bounds safe',async()=>{
  const db=await setup();const a=product('a',{rawMetadata:{varieties:['Gesha']},features:[
    {feature:'origin_country',value:'Ethiopia',sourceType:'RULE_INFERRED',confidence:null,version:'legacy'},
    {feature:'process_family',value:'natural',sourceType:'RULE_INFERRED',confidence:0.8,version:'1'},
    {feature:'flavor_categories',value:['fruity'],sourceType:'RULE_INFERRED',confidence:0.8,version:'1'},
  ]});
  await ingestCrawl(db,run(1,[a,product('b',{rawMetadata:{country:'Brazil'}})]));
  const list=await listCatalog(db,{origin:['Ethiopia'],taste:['fruity'],process:['natural'],variety:'Gesha',priceMin:90,priceMax:110,roaster:['roaster']});
  assert.equal(list.total,1);assert.equal(list.coffees[0].rawMetadata.country,undefined);assert.equal(list.coffees[0].features[0].sourceType,'RULE_INFERRED');
  assert.equal((await listCatalog(db,{search:"%' OR 1=1 --"})).total,0);
  assert.equal((await listCatalog(db,{perPage:-2,page:-3})).perPage,1);
  assert.equal((await listCatalog(db,{priceMax:1})).total,0);
  db.db.close();
});
test('feed deals require matching present price; similarity is deterministic and excludes current or unavailable coffee',async()=>{
  const db=await setup();const a=product('a'),b=product('b'),c=product('c',{rawMetadata:{country:'Brazil'}});
  await ingestCrawl(db,{...run(1,[a,b,c]),mode:'baseline'});await ingestCrawl(db,run(2,[a,b,c]));a.offers[0].price=80;
  await ingestCrawl(db,run(3,[a,b,c]));
  const deals=await listCatalog(db,{event:'DEAL'});assert.equal(deals.total,1);
  const similar=await getSimilarCoffees(db,deals.coffees[0]);assert.equal(similar.length,1);assert.deepEqual(similar[0].similarityReasons,['Aynı kökenden']);
  a.offers[0].price=120;await ingestCrawl(db,run(4,[a,b,c]));assert.equal((await listCatalog(db,{event:'DEAL'})).total,0);
  assert.equal((await listEvents(db,'DEAL')).length,1); // history is retained, the active deal feed is different.
  db.db.close();
});

test('catalog rows and hydration do not wait for the independent total query',async()=>{
  const db=await setup();await ingestCrawl(db,{...run(1,[product('a')]),mode:'baseline'});
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  let hydrated=false;
  const concurrent:CatalogDatabase={...db,batch:statements=>db.batch(statements),prepare(sql){
    const statement=db.prepare(sql);
    if(sql.startsWith('SELECT o.*,g.group_id'))hydrated=true;
    return {bind(...values){statement.bind(...values);return this;},first:async<T>()=>{if(sql.startsWith('SELECT count(*) AS count'))await pending;return statement.first<T>();},all:<T>()=>statement.all<T>()};
  }};
  const result=listCatalog(concurrent);
  await new Promise<void>(resolve=>setImmediate(resolve));
  try{assert.equal(hydrated,true,'selected coffees hydrate while the total is pending');}finally{release();}
  assert.equal((await result).total,1);db.db.close();
});

test('similarity ranks declared/inferred values with Turkish duplicates excluded and hydrates only winners',async()=>{
  const db=await setup();
  await registerRoaster(db,{id:'r2',slug:'other',name:'Other',websiteUrl:'https://shop.test',adapter:'test'});
  const facts={country:'Türkiye',process:'washed'};
  const features=[{feature:'flavor_families',value:['fruity'],sourceType:'RULE_INFERRED' as const,confidence:null,version:'1'}];
  const a=product('a',{name:'IŞIK',rawMetadata:facts,features});
  const strongest=product('strongest',{rawMetadata:{country:'TÜRKİYE',process:'WASHED'},features});
  const inferred=product('inferred',{rawMetadata:{},features:[
    {feature:'normalized_origin',value:['Türkiye',12,null],sourceType:'RULE_INFERRED',confidence:null,version:'1'},
    {feature:'process_family',value:'washed',sourceType:'RULE_INFERRED',confidence:null,version:'1'},
    {feature:'flavor_categories',value:[true,'fruity'],sourceType:'RULE_INFERRED',confidence:null,version:'1'},
    {feature:'origin_country',value:null,sourceType:'RULE_INFERRED',confidence:null,version:'1'},
    {feature:'process',value:{unmatched:'washed'},sourceType:'RULE_INFERRED',confidence:null,version:'1'},
  ]});
  const hidden=product('hidden',{visibility:'hidden',rawMetadata:facts,features});
  const unavailable=product('unavailable',{rawMetadata:facts,features});unavailable.offers[0].inStock=false;
  await ingestCrawl(db,{...run(1,[a,strongest,inferred,hidden,unavailable,product('duplicate',{name:'ışık',rawMetadata:facts,features}),product('equipment',{name:'Kahve Fincanı',rawMetadata:facts,features}),product('origin-only',{rawMetadata:{country:'Türkiye'}})]),mode:'baseline'});
  // Legacy incorrect visibility must still pass the shared coffee-only guard.
  db.db.prepare("UPDATE coffees SET visibility='public' WHERE source_product_id='equipment'").run();
  await ingestCrawl(db,{...run(2,[product('same-url',{canonicalUrl:a.canonicalUrl,rawMetadata:facts,features})]),roasterId:'r2',mode:'baseline'});
  const all=(await listCatalog(db)).coffees;const current=all.find(c=>c.sourceProductId==='a')!;
  let reads=0;let hydratedIds:SqlValue[]=[];
  const counted:CatalogDatabase={batch:statements=>db.batch(statements),prepare(sql){reads++;const statement=db.prepare(sql);return {bind(...values){if(sql.startsWith('SELECT o.*,g.group_id'))hydratedIds=values;statement.bind(...values);return this;},first:<T>()=>statement.first<T>(),all:<T>()=>statement.all<T>()};}};
  const result=await getSimilarCoffees(counted,current,2);
  const winners=all.filter(c=>['strongest','inferred'].includes(c.sourceProductId!)).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(result,winners.map(c=>({...c,similarityReasons:['Aynı kökenden','Benzer işleme yöntemi','Benzer tat profili']})));
  // Candidates, the winners' rows by id (the candidate list itself is shared through the derived cache), then hydration.
  assert.equal(reads,5);assert.deepEqual(hydratedIds,winners.map(c=>c.id));
  assert.equal((await getSimilarCoffees(db,current,0)).length,0);
  assert.equal((await getSimilarCoffees(db,current,-1)).length,0);
  assert.equal((await getSimilarCoffees(db,current,NaN)).length,3);
  db.db.close();
});

test('restock feed follows the triggering SKU when another SKU remains available',async()=>{
  const db=await setup();const a=product('a');
  a.offers[0].inStock=false;
  a.offers.push({...a.offers[0],sourceVariantId:'always-available',label:'1kg',weightG:1000,inStock:true});
  await ingestCrawl(db,{...run(1,[a]),mode:'baseline'});
  a.offers[0].inStock=true;await ingestCrawl(db,run(2,[a]));
  const restocked=await listCatalog(db,{event:'RESTOCKED'});
  assert.equal(restocked.total,1);
  const triggeringId=restocked.coffees[0].offers.find(offer=>offer.sourceVariantId==='sku-a')!.id;
  a.offers[0].inStock=false;await ingestCrawl(db,run(3,[a]));
  assert.equal((await listCatalog(db)).total,1,'the other package keeps the coffee in the catalog');
  assert.equal((await listCatalog(db,{event:'RESTOCKED'})).total,0,'sold-out triggering package is no longer a current restock');
  a.offers[0].inStock=null;await ingestCrawl(db,run(4,[a]));
  assert.equal((await listCatalog(db,{event:'RESTOCKED'})).total,0,'unknown stock cannot make a restock claim');
  db.db.prepare('UPDATE offers SET in_stock=1,retired_at=? WHERE id=?').run('2026-01-05T00:00:00.000Z',triggeringId);
  assert.equal((await listCatalog(db)).total,1);
  assert.equal((await listCatalog(db,{event:'RESTOCKED'})).total,0,'retired triggering package is excluded even if its stored stock was true');
  assert.equal((await listEvents(db,'RESTOCKED')).length,1,'the immutable historical event remains available');
  db.db.close();
});

test('country filter joins exact English/Turkish aliases from raw and feature values without broadening origin evidence',async()=>{
  const db=await setup();
  await ingestCrawl(db,run(1,[
    product('en',{rawMetadata:{country:'Brazil'}}),product('tr',{rawMetadata:{country:'Brezilya'}}),
    product('feature',{rawMetadata:{},features:[{feature:'origin_country',value:['BREZİLYA'],sourceType:'RULE_INFERRED',confidence:null,version:'test'}]}),
    product('region',{rawMetadata:{country:'Brazil Cerrado'}}),product('different',{rawMetadata:{country:'Colombia',description:'Brazil coffee'}}),
  ]));
  for(const origin of ['Brazil','Brezilya']){
    const result=await listCatalog(db,{origin:[origin]});
    assert.equal(result.total,3);assert.deepEqual(result.coffees.map(c=>c.sourceProductId).sort(),['en','feature','tr']);
    assert.equal(result.coffees.find(c=>c.sourceProductId==='tr')?.rawMetadata.country,'Brezilya');
    assert.equal(result.coffees.find(c=>c.sourceProductId==='feature')?.rawMetadata.country,undefined);
  }
  assert.equal((await listCatalog(db,{origin:['Bra']})).total,0);
  assert.equal((await listCatalog(db,{origin:["Brazil') OR 1=1 --"]})).total,0);
  assert.equal((await listCatalog(db,{origin:['Brazil'],process:['washed']})).total,0);
  db.db.close();
});

test('many selected country aliases and combined metadata filters keep SQL bindings bounded',async()=>{
  const db=await setup();await ingestCrawl(db,run(1,[product('a')]));
  let maxBindings=0;
  const bounded:CatalogDatabase={batch:statements=>db.batch(statements),prepare(sql){const statement=db.prepare(sql);return {...statement,bind(...values:SqlValue[]){maxBindings=Math.max(maxBindings,values.length);assert.ok(values.length<=100);return statement.bind(...values);},first:()=>statement.first(),all:()=>statement.all()};}};
  const many=['Brazil','Colombia','Ethiopia','Costa Rica','Cuba','China','India','Indonesia','Mexico','Nicaragua','Bolivia','Ecuador','Dominican Republic','DR Congo','Rwanda','Tanzania','Papua New Guinea','Thailand','Jamaica','Kenya'];
  await listCatalog(bounded,{origin:many,process:many,taste:many,roast:many,brewMethod:many,roaster:many,farm:'Farm',producer:'Producer',variety:'Gesha',search:'coffee',priceMin:1,priceMax:1000,event:'NEW',since:'2026-01-01'});
  assert.ok(maxBindings>0&&maxBindings<=100);db.db.close();
});

test('altitude searches declared text literally without inferred values, fabricated ranges or unknowns',async()=>{
  const db=await setup();await ingestCrawl(db,run(1,[
    product('text',{rawMetadata:{altitude:'1800–2200 m'}}),product('decimal',{rawMetadata:{altitude:'1.8 km'}}),
    product('null',{rawMetadata:{altitude:null}}),product('unknown',{rawMetadata:{altitude:'unknown'}}),
    product('inferred',{rawMetadata:{},features:[{feature:'altitude',value:'1800',sourceType:'RULE_INFERRED',confidence:null,version:'test'}]}),
  ]));
  assert.deepEqual((await listCatalog(db,{altitude:'1800'})).coffees.map(c=>c.sourceProductId),['text']);
  assert.equal((await listCatalog(db,{altitude:'1900'})).total,0,'text ranges do not imply numeric containment');
  assert.equal((await listCatalog(db,{altitude:'unknown'})).total,0);
  assert.equal((await listCatalog(db,{altitude:'%'})).total,0,'wildcards are literal');
  assert.equal((await listCatalog(db,{altitude:"' OR 1=1 --"})).total,0);
  assert.equal((await listCatalog(db,{altitude:'  1.8 km  '})).total,1);
  db.db.close();
});

test('traceability filters actual public linked archive sources, not inferred origin or scores',async()=>{
  const db=await setup();await ingestCrawl(db,run(1,['present','private-lot','private-source','no-url','no-source','no-archive'].map(id=>product(id))));
  const rows=db.db.prepare('SELECT id,source_product_id FROM coffees').all() as {id:string;source_product_id:string}[];
  const archive=(table:string,id:string,payload:object)=>db.db.prepare('INSERT INTO legacy_traceability VALUES (?,?,?,?)').run(table,id,JSON.stringify(payload),'2026-01-01');
  for(const row of rows){
    const id=row.source_product_id;if(id==='no-archive')continue;
    db.db.prepare('INSERT INTO legacy_id_map VALUES (?,?,?,?,?,?)').run('supabase','coffee',id,row.id,null,'2026-01-01');
    archive('coffees',id,{green_lot_id:`lot-${id}`});
    archive('coffee_lots',`lot-${id}`,{is_public:id!=='private-lot',traceability_score:100});
    if(id!=='no-source')archive('trace_sources',`source-${id}`,{lot_id:`lot-${id}`,is_public:id!=='private-source',source_url:id==='no-url'?null:'https://shop.test/source'});
  }
  assert.deepEqual((await listCatalog(db,{traceability:'available'})).coffees.map(c=>c.sourceProductId),['present']);
  assert.equal((await listCatalog(db,{traceability:'missing'})).total,5);
  assert.equal((await listCatalog(db,{traceability:'available',altitude:'1800'})).total,0);
  assert.equal((await listCatalog(db)).total,6);
  db.db.close();
});

test('detail identity lookup seeks indexed candidates instead of scanning aliases per coffee',async()=>{
  const db=await setup();
  let query='';const prepare=db.prepare.bind(db);db.prepare=(sql)=>{if(sql.includes('FROM coffees c JOIN roasters'))query=sql;return prepare(sql);};
  assert.equal(await getCoffeeDetail(db,'missing'),null);
  const plan=db.db.prepare('EXPLAIN QUERY PLAN '+query).all('missing','missing','missing').map(row=>row.detail).join('\n');
  assert.match(plan,/SEARCH c USING INDEX sqlite_autoindex_coffees/);assert.match(plan,/SEARCH coffee_aliases USING COVERING INDEX aliases_lookup/);assert.doesNotMatch(plan,/SCAN c\b/);db.db.close();
});

test('grind/roast variants at the same weight and price are one package in details, counts and roaster totals',async()=>{
  const db=await setup();
  const variant=(sku:string,label:string,weightG:number,price:number)=>({sourceVariantId:sku,label,weightG,price,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:`https://shop.test/v?${sku}`});
  const grinds=product('g',{name:'Rwanda &#8211; Gisanga',offers:[variant('v60','125 G · Hario V60',125,225),variant('chemex','125 G · Chemex',125,225),variant('bean','125 G · Çekirdek',125,225),variant('kg','1 kg · Çekirdek',1000,1400)]});
  await ingestCrawl(db,run(1,[grinds]));
  const [coffee]=(await listCatalog(db)).coffees;
  assert.equal(coffee.name,'Rwanda – Gisanga');
  assert.deepEqual(coffee.offers.map(o=>[o.weightG,o.label,o.variantOfferIds.length]),[[125,null,3],[1000,'1 kg · Çekirdek',1]]);
  assert.equal((await getCatalogCounts(db)).offers,2);
  assert.equal((await listRoasters(db))[0].offerCount,2);
  assert.equal((await getRoasterDetail(db,'roaster'))?.roaster.offerCount,2);
});

test('price sort/filter use the package the card shows; search folds Turkish case and spelling pairs',async()=>{
  const db=await setup();
  const pack=(sku:string,weightG:number,price:number)=>({sourceVariantId:sku,label:`${weightG} g`,weightG,price,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:`https://shop.test/p?${sku}`});
  // A 50 g sample must not make a 250 g coffee look like the cheapest bag.
  const sampler=product('s',{name:'ETİYOPYA Gesha Village',offers:[pack('s50',50,120),pack('s250',250,900)]});
  const plain=product('p',{name:'Brezilya Cerrado',offers:[pack('p250',250,500)]});
  await ingestCrawl(db,run(1,[sampler,plain]));
  assert.deepEqual((await listCatalog(db,{sort:'price_asc'})).coffees.map(c=>c.name),['Brezilya Cerrado','ETİYOPYA Gesha Village']);
  assert.deepEqual((await listCatalog(db,{priceMax:600})).coffees.map(c=>c.name),['Brezilya Cerrado']);
  for(const search of ['etiyopya','ethiopia','geisha','GESHA'])assert.equal((await listCatalog(db,{search})).total,1,search);
  assert.equal((await listCatalog(db,{search:'brazil'})).total,1);
  assert.equal((await listCatalog(db,{search:'50%_'})).total,0,'LIKE wildcards stay literal');
  // D1 refuses LIKE patterns over 50 bytes; a long query must still run. This database gets D1's limit so the old query fails here.
  applyD1Limits(db.db);
  assert.equal((await listCatalog(db,{search:'a very long search that no coffee could possibly match in this catalog'})).total,0);
  assert.equal((await listCatalog(db,{search:'x'.repeat(100)})).total,0);
});
test('an offer skipped nightly stops reading as current after 7 days in every reader; a valid sighting brings it straight back',async()=>{
  const db=await setup();
  const at=(day:number,products:SourceCoffee[],status:CrawlInput['status']='success'):CrawlInput=>{const d=String(day).padStart(2,'0');return {...run(1,products),id:`run-${d}`,startedAt:`2026-01-${d}T00:00:00.000Z`,completedAt:`2026-01-${d}T00:01:00.000Z`,status};};
  const pack=(sku:string,price:number,inStock=true,currency='TRY')=>({sourceVariantId:sku,label:sku,weightG:250,price,compareAtPrice:null,currency,inStock,purchaseUrl:`https://shop.test/p?${sku}`});
  // a: one steady bag plus a cheaper grind variant that drops in price, then fails validation ("TL") every night.
  // b: its only in-stock offer goes invalid; the valid one is sold out. c: a size twin of a whose extra offer goes invalid.
  const products=(day:number)=>[
    product('a',{offers:[pack('a1',100),pack('a2',day===1?80:50,true,day<=2||day>=26?'TRY':'TL')]}),
    product('b',{offers:[pack('b1',100,false),pack('b2',100,true,day===1||day>=26?'TRY':'TL')]}),
    product('c',{offers:[pack('c1',300),pack('c2',40,true,day===1||day>=26?'TRY':'TL')]}),
  ];
  await ingestCrawl(db,at(1,products(1)));
  db.db.exec("UPDATE coffees SET canonical_coffee_id=(SELECT id FROM coffees WHERE source_product_id='a') WHERE source_product_id='c'");
  await ingestCrawl(db,at(2,products(2)));
  const idOf=(source:string)=>String(db.db.prepare('SELECT id FROM coffees WHERE source_product_id=?').get(source)?.id);
  const offerIds=async(source:string)=>(await getCoffeeDetail(db,idOf(source)))!.offers.flatMap(o=>o.variantOfferIds.map(v=>String(db.db.prepare('SELECT source_variant_id s FROM offers WHERE id=?').get(v)?.s))).sort();
  const listed=async(filters={})=>(await listCatalog(db,filters)).coffees.map(c=>c.sourceProductId);
  const history=()=>db.db.prepare('SELECT id,price_minor,observed_at FROM price_observations ORDER BY id').all();
  assert.deepEqual(await listed(),['a','b']);
  assert.deepEqual(await listed({priceMax:45}),['a'],'the twin offer c2 is the cheapest 250 g package');
  assert.deepEqual(await listed({event:'PRICE_DROP'}),['a']);
  assert.deepEqual(await offerIds('a'),['a1','a2','c1','c2']);
  for(let day=3;day<=9;day++)await ingestCrawl(db,at(day,products(day)));
  assert.deepEqual(await listed(),['a'],'b2 last validated on day 1 is stale on day 9; b keeps only a sold-out offer');
  assert.deepEqual(await offerIds('a'),['a1','a2','c1'],'a2 validated exactly 7 days ago is still current; c2 is not');
  for(let day=10;day<=12;day++)await ingestCrawl(db,at(day,products(day)));
  const before=history();
  const a=(await getCoffeeDetail(db,idOf('a')))!,b=(await getCoffeeDetail(db,idOf('b')))!;
  assert.deepEqual(await offerIds('a'),['a1','c1'],'the coffee page and card show only current packages');
  assert.deepEqual(b.offers.map(o=>o.inStock),[false]);
  assert.deepEqual(await listed({priceMax:60}),[],'price filters ignore stale packages');
  assert.equal((await listCatalog(db,{sort:'price_asc'})).coffees.length,1);
  assert.deepEqual(await listed({event:'PRICE_DROP'}),[],'a drop on a stale offer is no longer a current deal');
  assert.deepEqual({...await getCatalogCounts(db)},{coffees:1,roasters:1,offers:2});
  assert.equal(db.db.prepare('SELECT offers FROM catalog_counts').get()?.offers,2);
  assert.equal((await listRoasters(db))[0].offerCount,2);
  assert.equal((await rankQuizMatches(db,{brew:[],taste:[],roast:[],process:[]})).total,1);
  assert.deepEqual((await getSavedCoffees(db,[a.slug,b.slug])).map(item=>item.availability),['listed','sold_out']);
  assert.equal((await getPriceHistory(db,a.id)).length+(await getPriceHistory(db,b.id)).length,before.length,'price history keeps every observation of stale offers');
  assert.equal(db.db.prepare("SELECT count(*) n FROM offers WHERE retired_at IS NOT NULL").get()?.n,0,'nothing is retired');
  // A roaster whose crawls stop succeeding is measured against its own last success: nothing more goes stale.
  await ingestCrawl(db,at(20,[],'failed'));await ingestCrawl(db,at(25,[],'failed'));
  assert.deepEqual({...await getCatalogCounts(db)},{coffees:1,roasters:1,offers:2});
  assert.deepEqual(await offerIds('a'),['a1','c1']);
  // One valid observation makes every stale offer current again.
  await ingestCrawl(db,at(26,products(26)));
  assert.deepEqual(await listed(),['a','b']);
  assert.deepEqual(await offerIds('a'),['a1','a2','c1','c2']);
  assert.deepEqual(await listed({event:'PRICE_DROP'}),['a']);
  assert.deepEqual(history().filter(row=>before.some(old=>JSON.stringify(old)===JSON.stringify(row))),before,'existing observations are unchanged');
  db.db.close();
});
