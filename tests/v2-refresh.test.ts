import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {registerRoaster} from '../shared/v2/ingestion';
import {attentionNeeded,refreshCatalog,syncRoasters} from '../scripts/v2-refresh.mts';
import {crawlRoaster} from '../scrapers/src/v2/crawl';
import {D1RestDatabase} from '../scripts/v2-d1-rest';
import {ALL_ROASTER_CONFIGS} from '../scrapers/src/roasters/configs';

test('refresh overlaps at most three storefronts and retains every snapshot and daily deduplication',async()=>{
  const db=new TestCatalogDatabase();
  const slugs=['petra','homestead','boxx','nok-coffee'];
  for(const config of ALL_ROASTER_CONFIGS.filter(config=>slugs.includes(config.slug)))await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,adapter:config.platform});
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  let active=0,peak=0,calls=0;const hosts=new Set<string>();
  const options={scheduledAt:'2026-01-01T00:00:00Z',now:()=> '2026-01-01T01:00:00Z',source:{requestDelayMs:0,fetch:async(input:RequestInfo|URL)=>{
    const host=new URL(String(input)).hostname;assert.ok(!hosts.has(host));hosts.add(host);
    calls++;peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,20));active--;hosts.delete(host);return Response.json(payload);
  }}};
  const results=await refreshCatalog(db,options);
  assert.equal(peak,3);assert.equal(results.length,4);assert.ok(results.every(result=>result.status==='success'&&result.products===1&&result.offers===3));
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM coffees').get()?.n,4);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM price_observations').get()?.n,12);
  assert.ok((await refreshCatalog(db,options)).every(result=>result.status==='already_completed'));assert.equal(calls,4);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM crawl_runs WHERE status='running'").get()?.n,0);db.sqlite.close();
});

test('refresh settles other storefronts before propagating a fatal reporting error',async()=>{
  const db=new TestCatalogDatabase();
  for(const config of ALL_ROASTER_CONFIGS.filter(config=>['petra','homestead','boxx','nok-coffee'].includes(config.slug)))await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,adapter:config.platform});
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  const reported:string[]=[];
  await assert.rejects(refreshCatalog(db,{scheduledAt:'2026-01-01T00:00:00Z',now:()=> '2026-01-01T01:00:00Z',source:{requestDelayMs:0,fetch:async(input)=>{
    await new Promise(resolve=>setTimeout(resolve,String(input).includes('homestead')?5:30));return Response.json(payload);
  }},report:async result=>{reported.push(String(result.slug));if(result.slug==='homestead')throw new Error('report unavailable');}}),/report unavailable/);
  assert.equal(reported.length,4);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM crawl_runs WHERE status='running'").get()?.n,0);db.sqlite.close();
});

test('free runner attempts every active source, preserves failed data, and deduplicates completed daily jobs',async()=>{
  const db=new TestCatalogDatabase();
  for(const slug of ['petra','paper'])await registerRoaster(db,{id:slug,slug,name:slug,websiteUrl:slug==='petra'?'https://petracoffee.com':'https://paperroastingcoffee.com',adapter:'test'});
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  let tick=0,calls=0;const options={scheduledAt:'2026-01-01T00:00:00Z',now:()=>new Date(Date.parse('2026-01-01T01:00:00Z')+tick++*1000).toISOString(),source:{requestDelayMs:0,fetch:async(input:RequestInfo|URL)=>{calls++;return String(input).includes('petracoffee')?Response.json(payload):new Response('down',{status:503});}}};
  const results=await refreshCatalog(db,options);assert.equal(results.length,2);assert.equal(results.find(r=>r.slug==='petra')?.status,'success');assert.equal(results.find(r=>r.slug==='paper')?.status,'failed');
  const count=db.sqlite.prepare('SELECT count(*) n FROM price_observations').get()?.n;await refreshCatalog(db,options);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM price_observations').get()?.n,count);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM crawl_runs WHERE status='running'").get()?.n,0);assert.equal(calls,3);db.sqlite.close();
});

test('configs own roasters by slug, revision moves only on change, and red means a source is days stale',async()=>{
  const db=new TestCatalogDatabase();
  db.sqlite.prepare("INSERT INTO roasters(id,slug,name,website_url,adapter,trusted_hosts_json,last_success_at,created_at,updated_at) VALUES('legacy-uuid','petra','Old','https://petracoffee.com/','shopify','[]','2026-01-04T00:00:00.000Z','x','x'),('gone','gone','Gone','https://gone.test/','shopify','[]',NULL,'x','x')").run();
  const configs=ALL_ROASTER_CONFIGS.filter(config=>['petra','cho-coffee'].includes(config.slug));
  await syncRoasters(db,configs,'2026-01-05T00:00:00.000Z');
  const rows=()=>db.sqlite.prepare('SELECT id,slug,name,active,revision FROM roasters ORDER BY slug').all().map(row=>({...row}));
  assert.deepEqual(rows(),[{id:'cho-coffee',slug:'cho-coffee',name:'Cho Coffee Roastery',active:0,revision:0},{id:'gone',slug:'gone',name:'Gone',active:0,revision:1},{id:'legacy-uuid',slug:'petra',name:'Petra Coffee',active:1,revision:1}]);
  await syncRoasters(db,configs,'2026-01-06T00:00:00.000Z');
  assert.deepEqual(rows().map(row=>row.revision),[0,1,1],'an unchanged config writes nothing');
  assert.deepEqual(await attentionNeeded(db,[{status:'failed'},...Array(9).fill({status:'success'})],'2026-01-06T00:00:00.000Z'),[]);
  assert.deepEqual(await attentionNeeded(db,[{status:'failed'},{status:'success'}],'2026-01-08T00:00:00.000Z'),['No successful crawl for 3 days: petra','Only 1/2 sources succeeded in this run']);
  db.sqlite.close();
});

test('a transport failure is retried once; an HTTP refusal is not',async()=>{
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  const config=ALL_ROASTER_CONFIGS.find(config=>config.slug==='petra')!;
  let calls=0;const flaky=await crawlRoaster(config,{requestDelayMs:0,sleep:async()=>{},fetch:async()=>{if(++calls===1)throw new TypeError('fetch failed');return Response.json(payload);}});
  assert.equal(flaky.complete,true);assert.equal(calls,2);
  calls=0;const blocked=await crawlRoaster(config,{requestDelayMs:0,sleep:async()=>{},fetch:async()=>{calls++;return new Response('no',{status:403});}});
  assert.equal(blocked.complete,false);assert.equal(calls,1);
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

test('D1 concurrent batches recover after an error and stop at the settled quota',async()=>{
  let calls=0,active=0,peak=0;
  const db=new D1RestDatabase('a'.repeat(32),'a'.repeat(8)+'-'+ 'b'.repeat(4)+'-'+ 'c'.repeat(4)+'-'+ 'd'.repeat(4)+'-'+ 'e'.repeat(12),'private-test-token',async()=>{
    const call=++calls;peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,10));active--;
    return Response.json(call===1?{success:false,errors:[{message:'temporary failure'}]}:{success:true,result:[{success:true,results:[],meta:{rows_read:1,rows_written:65_000}}]});
  });
  const results=await Promise.allSettled([db.batch([db.prepare('first')]),db.batch([db.prepare('second')]),db.batch([db.prepare('third')])]);
  assert.deepEqual(results.map(result=>result.status),['rejected','fulfilled','rejected']);
  assert.match(String((results[0] as PromiseRejectedResult).reason),/temporary failure/);
  assert.match(String((results[2] as PromiseRejectedResult).reason),/budget reached/);
  assert.equal(peak,1);assert.equal(calls,2);assert.equal(db.rowsWritten,65_000);assert.equal(db.rowsRead,1);
});

test('the scheduled refresh skips local-only sources unless they are requested by name',async()=>{
  const db=new TestCatalogDatabase();
  for(const config of ALL_ROASTER_CONFIGS.filter(config=>['petra','sezy'].includes(config.slug)))await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,adapter:config.platform});
  assert.equal(ALL_ROASTER_CONFIGS.find(config=>config.slug==='sezy')?.runsFrom,'local');
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  const source={requestDelayMs:0,fetch:async()=>Response.json(payload)};
  const scheduled=await refreshCatalog(db,{scheduledAt:'2026-01-01T00:00:00Z',now:()=> '2026-01-01T01:00:00Z',source});
  assert.deepEqual(scheduled.map(result=>result.slug),['petra']);
  const named=await refreshCatalog(db,{scheduledAt:'2026-01-01T00:00:00Z',now:()=> '2026-01-01T01:00:00Z',slugs:['sezy'],source});
  assert.deepEqual(named.map(result=>result.slug),['sezy']);db.sqlite.close();
});
