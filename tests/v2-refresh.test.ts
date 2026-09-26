import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {registerRoaster} from '../shared/v2/ingestion';
import {refreshCatalog} from '../scripts/v2-refresh.mts';
import {D1RestDatabase} from '../scripts/v2-d1-rest';

test('free runner attempts every active source, preserves failed data, and deduplicates completed daily jobs',async()=>{
  const db=new TestCatalogDatabase();
  for(const slug of ['petra','paper'])await registerRoaster(db,{id:slug,slug,name:slug,websiteUrl:slug==='petra'?'https://petracoffee.com':'https://paperroastingcoffee.com',adapter:'test'});
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  let tick=0,calls=0;const options={scheduledAt:'2026-01-01T00:00:00Z',now:()=>new Date(Date.parse('2026-01-01T01:00:00Z')+tick++*1000).toISOString(),source:{requestDelayMs:0,fetch:async(input:RequestInfo|URL)=>{calls++;return String(input).includes('petracoffee')?Response.json(payload):new Response('down',{status:503});}}};
  const results=await refreshCatalog(db,options);assert.equal(results.length,2);assert.equal(results.find(r=>r.slug==='petra')?.status,'success');assert.equal(results.find(r=>r.slug==='paper')?.status,'failed');
  const count=db.sqlite.prepare('SELECT count(*) n FROM price_observations').get()?.n;await refreshCatalog(db,options);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM price_observations').get()?.n,count);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM crawl_runs WHERE status='running'").get()?.n,0);assert.equal(calls,3);db.sqlite.close();
});

test('D1 REST sends parameters and an entire transaction together, validates errors, and accounts for quota',async()=>{
  let calls=0;
  const db=new D1RestDatabase('a'.repeat(32),'a'.repeat(8)+'-'+ 'b'.repeat(4)+'-'+ 'c'.repeat(4)+'-'+ 'd'.repeat(4)+'-'+ 'e'.repeat(12),'private-test-token',async(_,init)=>{
    calls++;const {batch}=JSON.parse(String(init?.body));assert.equal(batch.length,2);assert.deepEqual(batch[0].params,["coffee's name",null]);
    return Response.json(calls===1?{success:true,result:batch.map(()=>({success:true,results:[],meta:{rows_read:2,rows_written:3}}))}:{success:false,errors:[{message:'CHECK constraint failed'}]});
  });
  const statements=[db.prepare('INSERT ...').bind("coffee's name",null),db.prepare('UPDATE ...')];
  await db.batch(statements);assert.equal(db.rowsWritten,6);assert.equal(db.rowsRead,4);await assert.rejects(db.batch(statements),/CHECK constraint/);
});
