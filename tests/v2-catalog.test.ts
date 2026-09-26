import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import type {CatalogDatabase,SqlValue,Statement} from '../shared/v2/database';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import {getCatalogCounts,getCoffeeDetail,getRoasterDetail,getSimilarCoffees,listCatalog,listEvents,listRoasters} from '../shared/v2/catalog';
import type {CrawlInput,SourceCoffee} from '../shared/v2/types';

class SQLite implements CatalogDatabase {
  db=new DatabaseSync(':memory:');
  constructor(){for(const file of ['0001_catalog.sql','0002_queue_job_idempotency.sql'])this.db.exec(readFileSync(new URL(`../migrations/d1/${file}`,import.meta.url),'utf8'));}
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
  const detail=await getCoffeeDetail(db,list.coffees[0].slug);assert.equal(detail?.offers[0].inStock,false);assert.equal(detail?.priceHistory.length,2);
  assert.equal(detail?.latestEvents[0].type,'OUT_OF_STOCK');
  assert.equal(await getCoffeeDetail(db,'hidden'),null);
  assert.equal((await listEvents(db,'OUT_OF_STOCK')).length,1);
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
  const db=await setup();db.db.exec(readFileSync(new URL('../migrations/d1/0004_alias_lookup.sql',import.meta.url),'utf8'));
  let query='';const prepare=db.prepare.bind(db);db.prepare=(sql)=>{if(sql.includes('FROM coffees c JOIN roasters'))query=sql;return prepare(sql);};
  assert.equal(await getCoffeeDetail(db,'missing'),null);
  const plan=db.db.prepare('EXPLAIN QUERY PLAN '+query).all('missing','missing','missing').map(row=>row.detail).join('\n');
  assert.match(plan,/SEARCH c USING INDEX sqlite_autoindex_coffees/);assert.match(plan,/SEARCH coffee_aliases USING COVERING INDEX aliases_lookup/);assert.doesNotMatch(plan,/SCAN c\b/);db.db.close();
});
