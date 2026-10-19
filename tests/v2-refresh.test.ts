import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TestCatalogDatabase} from './helpers/v2-sqlite';
import {registerRoaster} from '../shared/v2/ingestion';
import {attentionNeeded,refreshCatalog,syncRoasters} from '../scripts/v2-refresh.mts';
import {crawlRoaster} from '../scrapers/src/v2/crawl';
import {D1RestDatabase} from '../scripts/v2-d1-rest';
import {relayFetch,relayRequest,siteRequest} from '../shared/v2/relay';
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

test('relay sources are fetched through the relay and nothing else is',async()=>{
  const db=new TestCatalogDatabase();
  for(const config of ALL_ROASTER_CONFIGS.filter(config=>['petra','sezy'].includes(config.slug)))await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,adapter:config.platform});
  const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
  const direct:string[]=[],relayed:string[]=[];
  await refreshCatalog(db,{scheduledAt:'2026-01-01T00:00:00Z',now:()=> '2026-01-01T01:00:00Z',
    source:{requestDelayMs:0,fetch:async input=>{direct.push(new URL(String(input)).hostname);return Response.json(payload);}},
    relay:async input=>{relayed.push(new URL(String(input)).hostname);return Response.json([]);}});
  assert.deepEqual([...new Set(direct)],['petracoffee.com']);assert.deepEqual([...new Set(relayed)],['sezycoffee.com']);db.sqlite.close();
});

test('the relay refuses callers without the token, other hosts and non-GET requests',async()=>{
  const hosts=new Set(['sezycoffee.com']),headers={'User-Agent':'test'};
  const upstream:typeof fetch=async(input,init)=>{assert.equal(new Headers(init?.headers).get('user-agent'),'test');return new Response('[]',{status:200,headers:{'content-type':'application/json','set-cookie':'a=b'}});};
  const call=(url:string,init?:RequestInit,token:string|undefined='secret')=>relayRequest(new Request(`https://relay.test/relay?url=${encodeURIComponent(url)}`,init),token,hosts,headers,upstream);
  const auth={headers:{Authorization:'Bearer secret'}};
  assert.equal((await call('https://sezycoffee.com/x')).status,401);
  assert.equal((await call('https://sezycoffee.com/x',{headers:{Authorization:'Bearer wrong!'}})).status,401);
  assert.equal((await relayRequest(new Request('https://relay.test/relay?url=https%3A%2F%2Fsezycoffee.com%2Fx',auth),undefined,hosts,headers,upstream)).status,503);
  assert.equal((await call('https://evil.example/x',auth)).status,403);
  assert.equal((await call('http://sezycoffee.com/x',auth)).status,403);
  assert.equal((await call('not a url',auth)).status,400);
  assert.equal((await call('https://sezycoffee.com/x',{...auth,method:'POST'})).status,405);
  const ok=await call('https://sezycoffee.com/x',auth);
  assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'application/json');assert.equal(ok.headers.get('set-cookie'),null);
  const seen:string[]=[];const viaRelay=relayFetch('https://relay.test/relay','secret',async(input,init)=>{seen.push(String(input),new Headers(init?.headers).get('authorization')??'');return new Response('ok');});
  await viaRelay('https://sezycoffee.com/a?b=1');assert.deepEqual(seen,['https://relay.test/relay?url=https%3A%2F%2Fsezycoffee.com%2Fa%3Fb%3D1','Bearer secret']);
});

test('the site route needs the relay token, sends GETs bare and only the purge as POST, on the real host',async()=>{
  const seen:{url:string;method:string;headers:Record<string,string>}[]=[];
  const site={fetch:(async(input:RequestInfo|URL,init?:RequestInit)=>{seen.push({url:String(input),method:init?.method??'GET',headers:Object.fromEntries(new Headers(init?.headers))});
    return new Response('page',{status:200,headers:{'content-type':'text/html','cf-cache-status':'MISS','set-cookie':'a=b'}});})as typeof fetch};
  const call=(path:string,init:RequestInit={})=>siteRequest(new Request(`https://crawler.test${path}`,init),'secret',site,'https://kahve.test');
  const auth={Authorization:'Bearer secret'};
  assert.equal((await call('/site/kahveler')).status,401);
  assert.equal((await call('/site/kahveler',{headers:{Authorization:'Bearer wrong!'}})).status,401);
  assert.equal((await siteRequest(new Request('https://crawler.test/site/kahveler',{headers:auth}),undefined,site,'https://kahve.test')).status,503);
  assert.equal((await siteRequest(new Request('https://crawler.test/site/',{headers:auth}),'secret',undefined,'https://kahve.test')).status,503);
  assert.equal((await call('/site/api/subscribe',{method:'POST',headers:auth})).status,405);
  assert.equal((await call('/site/kahveler',{method:'DELETE',headers:auth})).status,405);
  assert.equal(seen.length,0);
  const page=await call('/site/kahveler?_rsc',{headers:{...auth,Accept:'text/x-component',RSC:'1',Cookie:'c=d'}});
  assert.equal(page.status,200);assert.equal(page.headers.get('cf-cache-status'),'MISS');assert.equal(page.headers.get('set-cookie'),null);assert.equal(await page.text(),'page');
  assert.deepEqual(seen.pop(),{url:'https://kahve.test/kahveler?_rsc',method:'GET',headers:{accept:'text/x-component',rsc:'1'}});
  await call('/site/',{headers:auth});assert.equal(seen.pop()?.url,'https://kahve.test/');
  await call('/site/api/cache',{method:'POST',headers:{...auth,'X-Cache-Purge-Token':'purge'}});
  assert.deepEqual(seen.pop(),{url:'https://kahve.test/api/cache',method:'POST',headers:{authorization:'Bearer purge'}});
});

test('a source awaiting qualification never succeeds by design, so it does not turn the nightly run red',async()=>{
  const db=new TestCatalogDatabase();
  for(const config of ALL_ROASTER_CONFIGS.filter(config=>['petra','vitus'].includes(config.slug)))await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,adapter:config.platform});
  db.sqlite.exec(`UPDATE roasters SET last_success_at='2026-01-05T00:00:00.000Z' WHERE slug='petra'`);
  assert.deepEqual(await attentionNeeded(db,[{status:'success'},{status:'partial'}].concat(Array(8).fill({status:'success'})),'2026-01-06T00:00:00.000Z'),[]);
  db.sqlite.close();
});

test('the relay refuses non-default ports and credentials in the target, and only talks to an https relay',async()=>{
  const hosts=new Set(['sezycoffee.com']);let upstreamCalls=0;
  const upstream:typeof fetch=async()=>{upstreamCalls++;return new Response('[]');};
  const call=(url:string)=>relayRequest(new Request(`https://relay.test/relay?url=${encodeURIComponent(url)}`,{headers:{Authorization:'Bearer secret'}}),'secret',hosts,{},upstream);
  for(const url of ['https://sezycoffee.com:8443/x','https://sezycoffee.com:22/x','https://user:pw@sezycoffee.com/x','https://user@sezycoffee.com/x'])assert.equal((await call(url)).status,403,url);
  assert.equal((await call('https://SEZYCOFFEE.com:443/x')).status,200,'default port and case are normalised');
  assert.equal(upstreamCalls,1);
  assert.throws(()=>relayFetch('http://relay.test/relay','secret',upstream),/https/);
});
