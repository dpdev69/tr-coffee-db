import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import {catalogChangesByDay,listCatalog,type CatalogCoffee} from '../shared/v2/catalog';
import {ARRIVAL_DAYS} from '../shared/v2/events';
import {currentBadges} from '../src/components/v2/discovery-card';
import {buildDigest} from '../scripts/v2-digest.mts';
import type {CrawlInput,SourceCoffee} from '../shared/v2/types';

// One established roaster crawled nightly; "new" must mean the roaster started selling the coffee, nothing else.
const product=(id:string,name=`Coffee ${id}`,inStock:boolean|null=true,sourceData:Record<string,string>={}):SourceCoffee=>({sourceProductId:id,canonicalUrl:`https://shop.test/${id}`,name,visibility:'public',
  rawMetadata:{country:'Ethiopia',sourceData},offers:[{sourceVariantId:`sku-${id}`,label:'250g',weightG:250,price:100,compareAtPrice:null,currency:'TRY',inStock,purchaseUrl:`https://shop.test/${id}`}]});
const day=(d:number)=>new Date(Date.UTC(2026,9,d)).toISOString();
const run=(d:number,products:SourceCoffee[],extra:Partial<CrawlInput>={}):CrawlInput=>({id:`run-${d}`,roasterId:'r',startedAt:day(d),completedAt:new Date(Date.UTC(2026,9,d,0,1)).toISOString(),status:'success',mode:'live',parserVersion:'p1',products,diagnostics:[],...extra});
async function setup(){const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'roaster',name:'Roaster',websiteUrl:'https://shop.test',adapter:'test'});return db;}
const now=Date.UTC(2026,9,12,12);
const since=(days:number)=>new Date(now-days*86400000).toISOString();
const names=(coffees:CatalogCoffee[])=>coffees.map(c=>c.sourceProductId).sort();
const arrivals=async(db:TestCatalogDatabase)=>names((await listCatalog(db,{event:'NEW',since:since(ARRIVAL_DAYS)},now)).coffees);

test('a newly added roaster\'s first crawl and an import produce no arrivals; a coffee first seen at an established roaster does',async()=>{
  const db=await setup();
  await ingestCrawl(db,run(1,[product('a'),product('b')],{mode:'import'}));
  await ingestCrawl(db,run(2,[product('a'),product('b'),product('c')],{mode:'baseline'}));
  assert.deepEqual(await arrivals(db),[],'bulk import and first baseline are new to the database, not new at the roaster');
  await ingestCrawl(db,run(3,[product('a'),product('b'),product('c'),product('d')]));
  assert.deepEqual(await arrivals(db),['d']);
  db.sqlite.close();
});

test('re-identified, regrouped and re-listed products are not arrivals; a restock is not an arrival',async()=>{
  const db=await setup();
  await ingestCrawl(db,run(1,[product('koyu','KOYU'),product('guji','Ethiopia Guji'),product('sold','Kenya AA',false),product('parent','Colombia Huila')],{mode:'baseline'}));
  await ingestCrawl(db,run(2,[product('koyu','KOYU'),product('guji2','Ethiopia Guji'),product('big','KOYU 2.5KG'),product('sold','Kenya AA',true),product('parent','Colombia Huila'),
    product('child','Huila Microlot'),product('fresh','Ethiopia Guji Hambela')]));
  // A reviewed size group (data/corrections.json) puts a differently named member under an older parent.
  db.sqlite.exec("UPDATE coffees SET canonical_coffee_id=(SELECT id FROM coffees WHERE source_product_id='parent') WHERE source_product_id='child'");
  assert.deepEqual(db.sqlite.prepare("SELECT c.source_product_id id FROM coffee_events e JOIN coffees c ON c.id=e.coffee_id WHERE e.type='NEW' ORDER BY 1").all().map(r=>r.id),['big','child','fresh','guji2'],'events stay stored as emitted');
  assert.deepEqual(await arrivals(db),['fresh'],'new source ID under the same name, a size twin and a grouped member read as the old coffee');
  assert.deepEqual(names((await listCatalog(db,{event:'RESTOCKED'},now)).coffees),['sold'],'the restock stays in its own list');
  db.sqlite.close();
});

test('a first sighting after a parser change, after a long crawl gap, or of a product the shop dated earlier is not an arrival',async()=>{
  const db=await setup();
  await ingestCrawl(db,run(1,[product('a')],{mode:'baseline'}));
  const confirmed=product('confirmed','Confirmed',true,{published_at:'2026-10-01T15:00:00+03:00'});
  // The parser changed between day 1 and day 2: only a shop date after day 1 can still date an arrival on day 2.
  await ingestCrawl(db,run(2,[product('a'),product('missed'),confirmed],{parserVersion:'p2'}));
  await ingestCrawl(db,run(11,[product('a'),product('missed'),confirmed,product('gap')],{parserVersion:'p2'}));
  await ingestCrawl(db,run(12,[product('a'),product('missed'),confirmed,product('gap'),product('old','Old',true,{published_at:'2026-09-01T10:00:00+03:00'}),product('shop-new','Shop New',true,{published_at:'2026-10-11T23:30:00+03:00'})],{parserVersion:'p2'}));
  assert.deepEqual(await arrivals(db),['confirmed','shop-new']);
  db.sqlite.close();
});

test('the page, the badge, the home counts, the newest sort and the digest agree on what is new',async()=>{
  const db=await setup();
  await ingestCrawl(db,run(1,[product('a'),product('b',undefined,false)],{mode:'baseline'}));
  await ingestCrawl(db,run(2,[product('a'),product('b'),product('n1')]));
  await ingestCrawl(db,run(9,[product('a'),product('b'),product('n1'),product('n2'),product('n1 1kg','Coffee n1 1kg')]));
  const page=(await listCatalog(db,{event:'NEW',since:since(ARRIVAL_DAYS)},now)).coffees;
  assert.deepEqual(page.map(c=>c.sourceProductId),['n2','n1'],'/yeni lists genuine arrivals, newest first');
  const all=(await listCatalog(db,{},now)).coffees;
  assert.deepEqual(all.map(c=>c.sourceProductId).slice(0,2),['n2','n1'],'the catalog\'s newest sort leads with them');
  assert.deepEqual(names(all.filter(c=>currentBadges(c,now).some(e=>e.type==='NEW'))),names(page),'the Yeni badge is on exactly those cards');
  const days=await catalogChangesByDay(db,now);
  assert.equal(days.reduce((sum,d)=>sum+d.NEW,0),page.length,'the since-your-last-visit buckets count the same coffees');
  assert.equal(days.reduce((sum,d)=>sum+d.RESTOCKED,0),1,'the restock is counted as a restock only');
  const week=(await listCatalog(db,{event:'NEW',since:since(7)},now)).coffees;
  const digest=buildDigest({DEAL:[],PRICE_DROP:[],NEW:week,RESTOCKED:[]},{siteUrl:'https://kahvedrop.test',now:new Date(now)});
  assert.deepEqual(digest.sections,[{title:'Yeni gelenler',count:1}],'the weekly digest takes the last seven days of the same list');
  const later=now+(ARRIVAL_DAYS-5)*86400000;
  assert.equal(currentBadges(page[1],later).length,0,'n1 arrived on day 2: its badge ends with the arrival window');
  assert.equal(currentBadges(page[0],later).length,1);
  db.sqlite.close();
});
