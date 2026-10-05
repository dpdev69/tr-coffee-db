import assert from 'node:assert/strict';
import test from 'node:test';
import { coffeeExclusionReason, coffeeOnlySql } from '../shared/v2/coffee-eligibility';
import { getCatalogCounts, getCoffeeDetail, getSimilarCoffees, listCatalog, listEvents, listRoasters } from '../shared/v2/catalog';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { handleOutbound } from '../shared/v2/outbound';
import { TestCatalogDatabase } from './helpers/v2-sqlite';
import type { SourceCoffee } from '../shared/v2/types';

function product(id:string, name:string, categories:string[]=[]):SourceCoffee {
  return {sourceProductId:id, name,canonicalUrl:`https://coffeemolecule.com/${id}`,visibility:'public',rawMetadata:{sourceData:{categories:categories.map(name=>({name}))}},offers:[{sourceVariantId:id,label:'250 g',weightG:250,price:600,currency:'TRY',compareAtPrice:null,inStock:true,purchaseUrl:`https://coffeemolecule.com/${id}`}]};
}
const excluded=[product('ying-yang','Ying Yang'),product('new-ceramic','Yeni tasarım',['Türk Kahvesi Setleri']),product('mug','Kahve Fincanı'),product('filter','FİLTRE KAĞIDI'),product('tea','Green Tea'),product('class','Kahve Atölyesi'),
  product('thermos','Kahve Termosu Özel - 500ml'),product('tote','Hound Coffee Bez Çanta'),product('bread','Ekşi Maya Tam Çavdar Ekmeği'),
  product('thermos-taxonomy','Yeni tasarım',['TERMOSLAR']),product('tumbler','Coffee Tumbler'),product('flask','Coffee Flask'),product('bottle','Kahve Matarası'),product('bread-en','Sourdough Bread'),
  product('plan','12 Haftalık Kahve Planı · 4 × 250 g / 2 Haftada Bir'),product('drip','Burundi Baho / Drip Bag Kahve'),product('drip-tr','Drip Hazır Filtre Kahve'),product('set','Best of Panama Seti'),product('case','Colombia Supremo Huila Çekirdek Kahve 1 Kg x 10 Adet (Koli)'),product('fair','Fuar Paket'),
  // Coffee Sapiens and Vitus, 2026-10-05: two 100 g packs, and a box of three 75 g coffees.
  product('sapiens-set','EVOLUTION & MUTATION İKİLİ SET'),product('vitus-box','XOX Espresso Experience 3x75GR'),product('two-pack','Kenya & Ethiopia 2 x 100 g'),product('trio','Üçlü Paket Filtre'),product('sub','Aylık Kahve Aboneliği'),
  // Spada, 2026-10-05: chocolate bars named by their cacao origin.
  product('bean-to-bar','Kolombiya Opita - Bean To Bar Çikolata 45gr')];
const allowed=[product('colombia','Colombia China Alta Ibagué Washed'),{...product('fruit','Berry coffee'),rawMetadata:{description:'Seramik V60 dripper, filtre kağıdı ve fincan kullanın. Termosta içebilir, ekmek ile servis edebilirsiniz.',tastingNotes:['green tea','chocolate bar','bread']}},product('unknown-weight','Ethiopia'),
  product('cascara-process','Colombia San Adolfo Cascara'),product('decaf-water','Lala Salama Sparkling Water Kafeinsiz'),product('sugar-decaf','Colombia Sugar Cane Decaf'),
  product('sunset','Sunset Espresso'),product('one-bag','Ethiopia Guji 1x250 g')];

test('one coffee-only policy rejects non-coffee identity/taxonomy in JS and SQL without parsing tasting notes or brew instructions',async()=>{
  const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'molecule',name:'Molecule',websiteUrl:'https://coffeemolecule.com',adapter:'test'});
  await ingestCrawl(db,{id:'one',roasterId:'r',startedAt:'2026-09-14T00:00:00Z',completedAt:'2026-09-14T00:01:00Z',parserVersion:'test',status:'success',products:[...excluded,...allowed],diagnostics:[]});
  for(const value of excluded)assert.ok(coffeeExclusionReason(value),value.name);
  for(const value of allowed)assert.equal(coffeeExclusionReason(value),null,value.name);
  const sqlRows=db.sqlite.prepare(`SELECT source_product_id FROM coffees c WHERE ${coffeeOnlySql()}`).all();
  assert.deepEqual(sqlRows.map(row=>row.source_product_id).sort(),allowed.map(row=>row.sourceProductId).sort());
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM coffees WHERE visibility='hidden'").get()?.n,excluded.length);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM coffees').get()?.n,excluded.length+allowed.length,'identities preserved');
  assert.equal((await listEvents(db,'NEW')).length,allowed.length,'excluded products produce no discovery event');
  db.sqlite.close();
});

test('legacy public mistakes stay out of pagination, totals, roaster counts, events, details and outbound before database cleanup',async()=>{
  const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'molecule',name:'Molecule',websiteUrl:'https://coffeemolecule.com',adapter:'test'});
  await ingestCrawl(db,{id:'baseline',roasterId:'r',startedAt:'2026-09-14T00:00:00Z',completedAt:'2026-09-14T00:01:00Z',parserVersion:'test',status:'success',mode:'baseline',products:[...excluded,...allowed],diagnostics:[]});
  db.sqlite.prepare("UPDATE coffees SET visibility='public',raw_metadata_json=json_set(raw_metadata_json,'$.country','Kenya')").run();
  const list=await listCatalog(db,{perPage:2});assert.equal(list.total,allowed.length);assert.equal(list.totalPages,Math.ceil(allowed.length/2));assert.equal(list.coffees.length,2);
  assert.deepEqual({...await getCatalogCounts(db)},{coffees:allowed.length,roasters:1,offers:allowed.length});
  assert.equal((await listRoasters(db))[0].coffeeCount,allowed.length);
  for(const product of excluded){
    const row=db.sqlite.prepare('SELECT c.id,c.slug,o.id offer_id FROM coffees c JOIN offers o ON o.coffee_id=c.id WHERE c.source_product_id=?').get(product.sourceProductId)!;
    assert.equal(await getCoffeeDetail(db,String(row.id)),null,product.name);assert.equal(await getCoffeeDetail(db,String(row.slug)),null,product.name);
    assert.equal((await handleOutbound(new Request('https://app.test/go'),String(row.offer_id),db,{})).status,404,product.name);
  }
  const current=(await getCoffeeDetail(db,list.coffees[0].id))!;
  const similar=await getSimilarCoffees(db,current,12);
  assert.equal(similar.length,allowed.length-1,'recommendations include every other coffee even when equipment has matching origin');
  assert.ok(similar.every(coffee=>!excluded.some(product=>product.sourceProductId===coffee.sourceProductId)));
  assert.equal((await listCatalog(db,{event:'NEW'})).total,0,'baselines never manufacture NEW');
  assert.equal((await listCatalog(db,{sort:'newest'})).total,allowed.length,'catalog additions remain meaningful without events or a date cutoff');
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM coffees').get()?.n,excluded.length+allowed.length,'classification never deletes identities');
  db.sqlite.close();
});
