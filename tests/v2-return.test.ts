import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import {catalogChangesSince,getCoffeeOfTheDay,getSavedCoffees,getSimilarCoffees,listCatalog,listOrigins,withoutTrailingSize} from '../shared/v2/catalog';
import {handleRoasterOutbound,roasterSiteUrl} from '../shared/v2/outbound';
import type {CrawlInput,SourceCoffee} from '../shared/v2/types';

const product=(id:string,override:Partial<SourceCoffee>={},price=100,inStock:boolean|null=true):SourceCoffee=>({sourceProductId:id,canonicalUrl:`https://shop.test/${id}`,name:`Coffee ${id}`,visibility:'public',
  rawMetadata:{country:'Ethiopia',tastingNotes:['bergamot'],imageUrl:`https://shop.test/${id}.jpg`},
  offers:[{sourceVariantId:`sku-${id}`,label:'250g',weightG:250,price,compareAtPrice:null,currency:'TRY',inStock,purchaseUrl:`https://shop.test/${id}`}],...override});
const run=(day:number,products:SourceCoffee[],roasterId='r'):CrawlInput=>({id:`run-${roasterId}-${day}`,roasterId,startedAt:new Date(Date.UTC(2026,9,day)).toISOString(),completedAt:new Date(Date.UTC(2026,9,day,0,1)).toISOString(),status:'success',parserVersion:'test',products,diagnostics:[]});
async function setup(){const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'roaster',name:'Roaster',websiteUrl:'https://shop.test',adapter:'test'});return db;}
const slug=(db:TestCatalogDatabase,id:string)=>String(db.sqlite.prepare('SELECT slug FROM coffees WHERE source_product_id=?').get(id)?.slug);

test('changes since a visit count NEW, PRICE_DROP and RESTOCKED; malformed or future times are refused, old ones clamp to 30 days',async()=>{
  const db=await setup();
  await ingestCrawl(db,{...run(1,[product('a'),product('b',{},100,false)]),mode:'baseline'});
  await ingestCrawl(db,run(3,[product('a',{},80),product('b'),product('c')]));
  const now=Date.UTC(2026,9,4);
  assert.deepEqual(await catalogChangesSince(db,'2026-10-02T00:00:00Z',now),{since:'2026-10-02T00:00:00.000Z',counts:{NEW:1,PRICE_DROP:1,RESTOCKED:1}});
  assert.deepEqual((await catalogChangesSince(db,'2026-10-03T12:00:00.000Z',now))?.counts,{NEW:0,PRICE_DROP:0,RESTOCKED:0});
  assert.equal((await catalogChangesSince(db,'2025-01-01T00:00:00Z',now))?.since,new Date(now-30*86400000).toISOString());
  for(const bad of [null,'','yesterday','2026-10-09T00:00:00Z','1e12',`2026-10-01T00:00:00Z${'0'.repeat(40)}`])assert.equal(await catalogChangesSince(db,bad,now),null,String(bad));
  db.sqlite.close();
});

test('coffee of the day is stable within an Istanbul day, alternates roasters on consecutive days and never features an empty listing',async()=>{
  const db=await setup();await registerRoaster(db,{id:'r2',slug:'other',name:'Other',websiteUrl:'https://other.test',adapter:'test'});
  await ingestCrawl(db,{...run(1,[product('a'),product('b'),product('bare',{rawMetadata:{country:'Kenya'}})]),mode:'baseline'});
  const other=(id:string)=>product(id,{canonicalUrl:`https://other.test/${id}`,offers:[{...product(id).offers[0],purchaseUrl:`https://other.test/${id}`}]});
  await ingestCrawl(db,{...run(1,[other('x'),other('y')],'r2'),mode:'baseline'});
  const day=Date.UTC(2026,9,5,9);
  const today=await getCoffeeOfTheDay(db,day);
  assert.equal((await getCoffeeOfTheDay(db,Date.UTC(2026,9,5,20,59)))?.id,today?.id,'23:59 in Istanbul is still the same day');
  const picks=[];for(let d=0;d<6;d++)picks.push(await getCoffeeOfTheDay(db,day+d*86400000));
  assert.ok(picks.every(c=>c&&c.sourceProductId!=='bare'));
  for(let d=1;d<picks.length;d++)assert.notEqual(picks[d]!.roaster.id,picks[d-1]!.roaster.id,`day ${d}`);
  db.sqlite.close();
});

test('saved coffees resolve current state by slug: listed, sold out or gone; invalid and excess slugs are dropped',async()=>{
  const db=await setup();
  await ingestCrawl(db,{...run(1,[product('a'),product('b')]),mode:'baseline'});
  await ingestCrawl(db,run(2,[product('a',{},90),product('b',{},100,false)]));
  db.sqlite.exec(`UPDATE coffees SET discontinued_at='2026-10-02' WHERE source_product_id='b'`);
  const gone=await getSavedCoffees(db,[slug(db,'b')]);assert.equal(gone[0].availability,'gone');
  db.sqlite.exec(`UPDATE coffees SET discontinued_at=NULL`);
  const items=await getSavedCoffees(db,[slug(db,'a'),slug(db,'b'),'../x','missing',...Array.from({length:80},(_,i)=>`s${i}`)]);
  assert.deepEqual(items.map(i=>[i.savedSlug,i.availability,i.coffee.offers[0].priceMinor]).sort(),[[slug(db,'a'),'listed',9000],[slug(db,'b'),'sold_out',10000]]);
  db.sqlite.close();
});

test('a grouped coffee drops a trailing size from its name; an ungrouped one keeps it',async()=>{
  for(const [name,expected] of [['Koyu 250 g','Koyu'],['KOYU 2.5KG','KOYU'],['Kenya (1000 gr)','Kenya'],['Kenya – 1 kg','Kenya'],['250 g','250 g'],['Blend 2026','Blend 2026']])assert.equal(withoutTrailingSize(name),expected);
  const db=await setup();
  await ingestCrawl(db,{...run(1,[product('koyu',{name:'Koyu 250 g'}),product('big',{name:'Koyu 1 kg'}),product('solo',{name:'Solo 250 g'})]),mode:'baseline'});
  db.sqlite.exec(`UPDATE coffees SET canonical_coffee_id=(SELECT id FROM coffees WHERE source_product_id='koyu') WHERE source_product_id='big'`);
  assert.deepEqual((await listCatalog(db)).coffees.map(c=>c.name).sort(),['Koyu','Solo 250 g']);
  db.sqlite.close();
});

test('origin options and the same-origin reason respect manual corrections like the filters do',async()=>{
  const db=await setup();
  await ingestCrawl(db,{...run(1,[product('a'),product('b')]),mode:'baseline'});
  const [a,b]=['a','b'].map(id=>String(db.sqlite.prepare('SELECT id FROM coffees WHERE source_product_id=?').get(id)?.id));
  assert.deepEqual(await listOrigins(db),['Ethiopia']);
  const coffeeA=(await listCatalog(db)).coffees.find(c=>c.id===a)!;
  assert.ok((await getSimilarCoffees(db,coffeeA))[0]?.similarityReasons.includes('Aynı kökenden'));
  db.sqlite.prepare(`INSERT INTO coffee_feature_values(coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at) VALUES(?,'origin_country','"Kenya"','MANUAL',NULL,'manual',NULL,'2026-10-02','2026-10-02')`).run(b);
  assert.deepEqual(await listOrigins(db),['Ethiopia','Kenya']);
  db.sqlite.prepare(`INSERT INTO coffee_feature_values(coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at) VALUES(?,'origin_country','"Kenya"','MANUAL',NULL,'manual',NULL,'2026-10-02','2026-10-02')`).run(a);
  assert.deepEqual(await listOrigins(db),['Kenya'],'the corrected-away Ethiopia is no longer offered');
  db.sqlite.exec(`DELETE FROM coffee_feature_values WHERE coffee_id='${a}'`);
  assert.equal((await getSimilarCoffees(db,coffeeA)).length,0,'b is Kenyan now; its raw Ethiopia no longer counts as the same origin');
  db.sqlite.close();
});

test('the roaster site link exists only through the trusted-host check and carries referral tags',async()=>{
  const db=new TestCatalogDatabase();
  await registerRoaster(db,{id:'k',slug:'kimma',name:'Kimma',websiteUrl:'https://shop.kimmacoffee.com/?utm_source=old',trustedHosts:['shop.kimmacoffee.com'],adapter:'test'});
  const site=new URL((await roasterSiteUrl(db,'kimma'))!);
  assert.equal(site.hostname,'shop.kimmacoffee.com');assert.equal(site.searchParams.get('utm_source'),'kahvedrop');assert.equal(site.searchParams.get('utm_medium'),'referral');assert.equal(site.searchParams.get('utm_content'),'roaster');
  const redirect=await handleRoasterOutbound(new Request('https://app.test/go/kavurucu/kimma'),'kimma',db);
  assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),site.toString());assert.equal(redirect.headers.get('cache-control'),'no-store');
  for(const url of ['https://evil.test/','http://shop.kimmacoffee.com/','https://shop.kimmacoffee.com.evil.test/']){
    db.sqlite.prepare("UPDATE roasters SET website_url=? WHERE slug='kimma'").run(url);
    assert.equal(await roasterSiteUrl(db,'kimma'),null,url);assert.equal((await handleRoasterOutbound(new Request('https://app.test/go/kavurucu/kimma'),'kimma',db)).status,404);
  }
  assert.equal((await handleRoasterOutbound(new Request('https://app.test/go/kavurucu/x',{method:'POST'}),'kimma',db)).status,405);
  assert.equal(await roasterSiteUrl(db,'../evil'),null);
  db.sqlite.close();
});

test('saved coffees of a deactivated roaster are not served at all',async()=>{
  const db=await setup();
  await ingestCrawl(db,{...run(1,[product('a',{},100,false)]),mode:'baseline'});
  assert.equal((await getSavedCoffees(db,[slug(db,'a')])).length,1);
  db.sqlite.exec(`UPDATE roasters SET active=0`);
  assert.deepEqual(await getSavedCoffees(db,[slug(db,'a')]),[]);
  db.sqlite.close();
});
