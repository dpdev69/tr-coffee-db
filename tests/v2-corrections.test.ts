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
  db.sqlite.close();
});
