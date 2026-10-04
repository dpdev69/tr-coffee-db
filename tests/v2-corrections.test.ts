import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import {getCatalogCounts,getCoffeeDetail,listCatalog} from '../shared/v2/catalog';
import {applyCorrections,sizeKey} from '../scripts/v2-apply-corrections.mts';
import type {CrawlInput,SourceCoffee} from '../shared/v2/types';

const product=(id:string,name:string,weightG=250):SourceCoffee=>({sourceProductId:id,canonicalUrl:`https://shop.test/${id}`,name,visibility:'public',rawMetadata:{country:'Ethiopia'},
  features:[{feature:'normalized_origin',value:'Ethiopia',sourceType:'RULE_INFERRED',confidence:null,version:'1'}],
  offers:[{sourceVariantId:`sku-${id}`,label:`${weightG}g`,weightG,price:weightG,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:`https://shop.test/${id}`}]});
const run=(day:number,products:SourceCoffee[]):CrawlInput=>({id:`run${day}`,roasterId:'r',startedAt:`2026-01-0${day}T00:00:00.000Z`,completedAt:`2026-01-0${day}T00:01:00.000Z`,status:'success',parserVersion:'test',products,diagnostics:[]});

test('size suffixes fold away, roast words do not',()=>{
  assert.equal(sizeKey('KOYU 2.5KG').key,sizeKey('Koyu').key);
  assert.equal(sizeKey('Kenya (1000 gr)').key,sizeKey('Kenya 250 g').key);
  assert.notEqual(sizeKey('Koyu – Espresso').key,sizeKey('Koyu').key);
});

test('corrections link size twins, override visibility and MANUAL facts across crawls, and undo when removed',async()=>{
  const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'roaster',name:'Roaster',websiteUrl:'https://shop.test',adapter:'test'});
  const koyu=product('koyu','Koyu'),big=product('big','KOYU 2.5KG',2500),espresso=product('esp','Koyu – Espresso'),again=product('again','Koyu');
  await ingestCrawl(db,{...run(1,[koyu]),mode:'baseline'});
  await ingestCrawl(db,run(2,[koyu,big,espresso]));
  const slug=(id:string)=>String(db.sqlite.prepare('SELECT slug FROM coffees WHERE source_product_id=?').get(id)?.slug);
  const corrections=[{coffeeSlug:slug('esp'),visibility:'hidden' as const},{coffeeSlug:slug('koyu'),features:{origin_country:'Kenya'}}];
  const result=await applyCorrections(db,corrections,'2026-01-02T01:00:00.000Z');
  assert.deepEqual(result.links,[`${slug('big')} → ${slug('koyu')}`]);
  // A later crawl rewrites visibility and features; the corrections stand.
  await ingestCrawl(db,run(3,[koyu,big,espresso]));
  const list=await listCatalog(db);
  assert.deepEqual(list.coffees.map(c=>c.sourceProductId),['koyu']);
  assert.deepEqual(list.coffees[0].offers.map(o=>o.weightG).sort(),[250,2500]);
  assert.deepEqual({...await getCatalogCounts(db)},{coffees:1,roasters:1,offers:2});
  assert.equal((await getCoffeeDetail(db,slug('big')))?.id,list.coffees[0].id,'a twin URL resolves to its parent');
  assert.equal((await getCoffeeDetail(db,slug('koyu')))?.priceHistory.length,5,'the group history covers both bags');
  // MANUAL wins on display and in filters; raw/inferred Ethiopia no longer matches.
  assert.equal(list.coffees[0].rawMetadata.country,undefined);
  assert.deepEqual(list.coffees[0].features.filter(f=>f.feature.includes('origin')).map(f=>[f.feature,f.value,f.sourceType]),[['origin_country','Kenya','MANUAL']]);
  assert.equal((await listCatalog(db,{origin:['Ethiopia']})).total,0);
  assert.equal((await listCatalog(db,{origin:['Kenya']})).total,1);
  const snapshot=()=>db.sqlite.prepare('SELECT id,visibility,visibility_override,canonical_coffee_id,updated_at FROM coffees ORDER BY id').all().concat(db.sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY coffee_id,feature,source_type').all());
  const before=snapshot();await applyCorrections(db,corrections,'2026-01-03T01:00:00.000Z');
  assert.deepEqual(snapshot(),before,'a repeated run rewrites nothing');
  // Identical names may be a relisted lot: an opt-out or an ambiguous group is never linked automatically.
  await ingestCrawl(db,run(4,[koyu,big,espresso,again]));
  assert.deepEqual((await applyCorrections(db,[],'2026-01-04T01:00:00.000Z')).links,[]);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM coffee_feature_values WHERE source_type='MANUAL'").get()?.n,0);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM coffees WHERE visibility_override IS NOT NULL OR canonical_coffee_id IS NOT NULL').get()?.n,0);
  await assert.rejects(applyCorrections(db,[{coffeeSlug:'missing'}]),/Unknown coffee slug/);
  // A misspelt feature or a second entry for one coffee fails before anything is written.
  await assert.rejects(applyCorrections(db,[{coffeeSlug:slug('esp'),visibility:'hidden'},{coffeeSlug:slug('koyu'),features:{origin:'Kenya'}}]),/Uncorrectable feature/);
  await assert.rejects(applyCorrections(db,[{coffeeSlug:slug('esp'),visibility:'hidden'},{coffeeSlug:slug('esp'),visibility:'public'}]),/Duplicate corrections entry/);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM coffees WHERE visibility_override IS NOT NULL').get()?.n,0);
  db.sqlite.close();
});

test('automatic links only join currently listed coffees, so a delisted size never hides the sizes still sold',async()=>{
  const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'roaster',name:'Roaster',websiteUrl:'https://shop.test',adapter:'test'});
  const day=(d:number):CrawlInput=>({...run(1,[]),id:`run${d}`,startedAt:new Date(Date.UTC(2026,0,d)).toISOString(),completedAt:new Date(Date.UTC(2026,0,d,0,1)).toISOString()});
  const small=product('small','Kenya 50g',50),big=product('big','Kenya 250g');
  await ingestCrawl(db,{...day(1),products:[small],mode:'baseline'});
  await ingestCrawl(db,{...day(2),products:[small,big]});
  assert.equal((await applyCorrections(db,[],'2026-01-02T01:00:00.000Z')).links.length,1);
  // The 50 g bag is withdrawn; the 250 g bag keeps selling past the 7-day window.
  for(let d=3;d<=12;d++){await ingestCrawl(db,{...day(d),products:[big]});await applyCorrections(db,[],new Date(Date.UTC(2026,0,d,1)).toISOString());}
  assert.deepEqual((await listCatalog(db)).coffees.map(c=>c.sourceProductId),['big']);
  // A long-gone listing is never chosen as the parent of a new one.
  const old=product('old','Brazil'),fresh=product('fresh','Brazil 250 g');
  await ingestCrawl(db,{...day(13),products:[big,old]});
  for(let d=14;d<=22;d++)await ingestCrawl(db,{...day(d),products:[big]});
  await ingestCrawl(db,{...day(23),products:[big,fresh]});
  assert.deepEqual((await applyCorrections(db,[],'2026-01-23T01:00:00.000Z')).links,[]);
  assert.deepEqual((await listCatalog(db)).coffees.map(c=>c.sourceProductId).sort(),['big','fresh']);
  db.sqlite.close();
});
