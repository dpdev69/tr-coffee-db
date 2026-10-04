import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {applyMigrations} from './helpers/v2-sqlite';
import type {CatalogDatabase,SqlValue,Statement} from '../shared/v2/database';
import {registerRoaster,beginCrawl,expireCrawls} from '../shared/v2/ingestion';
import {createCrawlerWorker,type CrawlJob} from '../workers/crawler';
import {QUALIFIED_SOURCE_SLUGS,isQualifiedSource} from '../shared/v2/qualified-sources';
import {ALL_ROASTER_CONFIGS} from '../scrapers/src/roasters/configs';

class SQLite implements CatalogDatabase {
  db=new DatabaseSync(':memory:');loseSuccessResponse=false;
  constructor(){applyMigrations(this.db);}
  withSession(){return this;}
  prepare(sql:string):Statement{return new Prepared(this,sql);}
  async batch(statements:Statement[]){this.db.exec('BEGIN');try{const results=statements.map(s=>{const p=s as Prepared;return this.db.prepare(p.sql).run(...p.values);});this.db.exec('COMMIT');
    if(this.loseSuccessResponse&&statements.some(s=>(s as Prepared).sql.startsWith('INSERT INTO crawl_runs')&&(s as Prepared).values.includes('success'))){this.loseSuccessResponse=false;throw new Error('Response lost after commit');}return results;
    }catch(error){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw error;}}
}
class Prepared implements Statement {
  values:SqlValue[]=[];constructor(readonly owner:SQLite,readonly sql:string){}
  bind(...values:SqlValue[]){this.values=values;return this;}
  async first<T>(){return(this.owner.db.prepare(this.sql).get(...this.values)??null)as T|null;}
  async all<T>(){return{results:this.owner.db.prepare(this.sql).all(...this.values)as T[],success:true};}
}
const payload=JSON.parse(readFileSync(new URL('./fixtures/v2/shopify.json',import.meta.url),'utf8'));
const scheduledAt='2026-01-01T00:00:00.000Z';
const job:CrawlJob={roasterId:'r',slug:'petra',scheduledAt};
function message(attempts=1,body:unknown=job){return{body,attempts,acked:false,retried:false,ack(){this.acked=true;},retry(){this.retried=true;}};}
function clock(){let seconds=0;return()=>new Date(Date.parse(scheduledAt)+seconds++*1000).toISOString();}
async function setup(){const db=new SQLite();await registerRoaster(db,{id:'r',slug:'petra',name:'Petra',websiteUrl:'https://petracoffee.com',adapter:'shopify'});return db;}
const DLQ='crawls-dlq-test';
function env(db:SQLite){return{DB:db,CRAWLS_ENABLED:'true',CRAWL_MODE:'baseline',CRAWL_DLQ_QUEUE:DLQ,CRAWL_QUEUE:{sendBatch:async()=>{}}};}
const count=(db:SQLite,table:string)=>Number(db.db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);
const deliver=async(worker:ReturnType<typeof createCrawlerWorker>,db:SQLite,messages:ReturnType<typeof message>[])=>worker.queue({messages}as never,env(db)as never);

test('scheduler disabled enqueues nothing, enabled schedules only registered qualified active roasters',async()=>{
  const db=await setup();await registerRoaster(db,{id:'unknown',slug:'unknown',name:'Unknown',websiteUrl:'https://unknown.test',adapter:'other'});
  await registerRoaster(db,{id:'cho',slug:'cho-coffee',name:'Cho',websiteUrl:'https://chocoffeeroastery.com',adapter:'custom'});
  await registerRoaster(db,{id:'montag',slug:'montag',name:'Montag',websiteUrl:'https://montag.test',adapter:'shopify'});
  db.db.prepare('UPDATE roasters SET active=0 WHERE id=?').run('montag');
  const worker=createCrawlerWorker();const batches:unknown[][]=[];const background:Promise<unknown>[]=[];
  const bindings={...env(db),CRAWLS_ENABLED:'false',CRAWL_QUEUE:{sendBatch:async(body:unknown[])=>{batches.push(body);}}};
  await worker.scheduled({scheduledTime:Date.parse(scheduledAt)}as never,bindings as never,{waitUntil(p:Promise<unknown>){background.push(p);}}as never);
  assert.equal(background.length,0);bindings.CRAWLS_ENABLED='true';
  await worker.scheduled({scheduledTime:Date.parse(scheduledAt)}as never,bindings as never,{waitUntil(p:Promise<unknown>){background.push(p);}}as never);
  await Promise.all(background);assert.equal(batches.length,1);assert.deepEqual(batches[0],[{body:job,contentType:'json'}]);db.db.close();
});
test('actual queue handler and parser commit one baseline; ack loss redelivery cannot refetch or duplicate history',async()=>{
  const db=await setup();let fetches=0;const worker=createCrawlerWorker({fetch:async()=>{fetches++;return Response.json(payload);},requestDelayMs:0},clock());
  const first=message();await deliver(worker,db,[first]);assert.equal(first.acked,true);assert.equal(count(db,'coffees'),1);assert.equal(count(db,'price_observations'),3);assert.equal(count(db,'coffee_events'),0);
  const retry=message(2);await deliver(worker,db,[retry]);assert.equal(retry.acked,true);assert.equal(fetches,1);assert.equal(count(db,'price_observations'),3);db.db.close();
});
test('source failure terminates attempt, retries independently, and malformed jobs cannot prevent known roaster processing',async()=>{
  const db=await setup();let fails=true;const worker=createCrawlerWorker({fetch:async()=>fails?new Response('down',{status:503}):Response.json(payload),requestDelayMs:0},clock());
  const failed=message();await deliver(worker,db,[failed]);assert.equal(failed.retried,true);assert.equal(db.db.prepare('SELECT status FROM crawl_runs').get()?.status,'failed');assert.equal(count(db,'crawl_errors'),1);
  fails=false;const good=message(2);const bad=message(1,null);const forged=message(1,{...job,roasterId:'unknown'});
  await deliver(worker,db,[bad,forged,good]);assert.equal(bad.acked,true);assert.equal(forged.acked,true);assert.equal(good.acked,true);assert.equal(count(db,'crawl_runs'),2);assert.equal(count(db,'price_observations'),3);db.db.close();
});
test('commit response loss is acknowledged by success reread and leaves no running failure',async()=>{
  const db=await setup();db.loseSuccessResponse=true;const worker=createCrawlerWorker({fetch:async()=>Response.json(payload),requestDelayMs:0},clock());
  const first=message();await deliver(worker,db,[first]);assert.equal(first.acked,true);assert.equal(first.retried,false);assert.equal(count(db,'price_observations'),3);assert.equal(db.db.prepare('SELECT status FROM crawl_runs').get()?.status,'success');db.db.close();
});
test('concurrent deliveries recover interrupted running attempt and cannot double-count successful baseline',async()=>{
  const db=await setup();let fetched!:()=>void;const reachedFetch=new Promise<void>(resolve=>{fetched=resolve;});let unblock!:()=>void;const pause=new Promise<void>(resolve=>{unblock=resolve;});let requests=0;
  const worker=createCrawlerWorker({fetch:async()=>{requests++;if(requests===1){fetched();await pause;}return Response.json(payload);},requestDelayMs:0},clock());
  const first=message(1),second=message(2);const pending=deliver(worker,db,[first]);await reachedFetch;await deliver(worker,db,[second]);unblock();await pending;
  assert.equal(first.acked,true);assert.equal(second.acked,true);assert.equal(count(db,'price_observations'),3);
  assert.equal(db.db.prepare("SELECT count(*) AS count FROM crawl_runs WHERE status='success'").get()?.count,1);
  assert.equal(db.db.prepare("SELECT count(*) AS count FROM crawl_runs WHERE status='running'").get()?.count,0);
  assert.equal(db.db.prepare("SELECT count(*) AS count FROM crawl_errors WHERE code='interrupted_attempt'").get()?.count,1);db.db.close();
});


test('disabled crawls hold queued jobs without crawling or spending retries; DLQ still closes jobs',async()=>{
  const db=await setup();const worker=createCrawlerWorker({fetch:async()=>{throw new Error('Disabled crawler fetched source');}},clock());
  const sent:{body:unknown;options:unknown}[]=[];
  const disabled={...env(db),CRAWLS_ENABLED:'false',CRAWL_QUEUE:{send:async(body:unknown,options:unknown)=>{sent.push({body,options});}}};
  const held=message(3);await worker.queue({queue:'crawls-test',messages:[held]}as never,disabled as never);
  assert.equal(held.acked,true);assert.equal(held.retried,false);
  assert.deepEqual(sent,[{body:job,options:{contentType:'json',delaySeconds:43200}}]);
  assert.equal(count(db,'crawl_runs'),0,'no attempt is started');
  const exhausted=message(5);await worker.queue({queue:DLQ,messages:[exhausted]}as never,disabled as never);
  assert.equal(exhausted.acked,true);assert.equal(sent.length,1);
  assert.equal(db.db.prepare('SELECT status FROM crawl_runs').get()?.status,'failed');db.db.close();
});
test('crawler DLQ variable names the configured dead-letter queue',()=>{
  const config=JSON.parse(readFileSync(new URL('../wrangler.crawler.jsonc',import.meta.url),'utf8').replace(/^\s*\/\/.*$/gm,''));
  const [main,dlq]=config.queues.consumers;
  assert.equal(config.vars.CRAWL_DLQ_QUEUE,main.dead_letter_queue);assert.equal(dlq.queue,main.dead_letter_queue);
});

test('qualification is explicit and rejects configured-but-unreviewed sources before any queue I/O',async()=>{
  assert.equal(QUALIFIED_SOURCE_SLUGS.length,42);
  assert.equal(new Set(QUALIFIED_SOURCE_SLUGS).size,42);
  assert.ok(QUALIFIED_SOURCE_SLUGS.every(slug=>ALL_ROASTER_CONFIGS.some(config=>config.slug===slug)));
  assert.equal(isQualifiedSource('cho-coffee'),false);assert.equal(isQualifiedSource('friendzone'),false);assert.equal(isQualifiedSource('unknown'),false);
  const worker=createCrawlerWorker({fetch:async()=>{throw new Error('Rejected job fetched source');}});
  const rejected=[message(1,{...job,slug:'cho-coffee'}),message(1,{...job,slug:'friendzone'}),message(1,{...job,slug:'unknown'})];
  // No DB or queue binding: refusal must happen before opening a session or making a request.
  await worker.queue({messages:rejected}as never,{}as never);
  assert.ok(rejected.every(m=>m.acked&&!m.retried));
});


test('live sources establish a quiet baseline; exhausted and expired attempts close idempotently',async()=>{
  const db=await setup();const worker=createCrawlerWorker({fetch:async()=>Response.json(payload),requestDelayMs:0},clock());
  const first=message();await worker.queue({messages:[first]}as never,{...env(db),CRAWL_MODE:'live'}as never);
  assert.equal(first.acked,true);assert.equal(db.db.prepare('SELECT mode FROM crawl_runs').get()?.mode,'baseline');assert.equal(count(db,'coffee_events'),0);
  const exhausted=message(1,{...job,scheduledAt:'2025-12-31T12:00:00Z'});
  for(let i=0;i<2;i++)await worker.queue({queue:DLQ,messages:[exhausted]}as never,env(db)as never);
  assert.equal(exhausted.acked,true);assert.equal(exhausted.retried,false);assert.equal(count(db,'crawl_runs'),2);
  await beginCrawl(db,{id:'stale',roasterId:'r',startedAt:'2025-12-31T13:00:00Z',parserVersion:'test',mode:'live'});
  await beginCrawl(db,{id:'recent',roasterId:'r',startedAt:'2026-01-01T01:59:00Z',parserVersion:'test',mode:'live'});
  await expireCrawls(db,'2026-01-01T02:00:00Z');await expireCrawls(db,'2026-01-01T02:00:00Z');
  assert.equal(db.db.prepare("SELECT status FROM crawl_runs WHERE id='stale'").get()?.status,'failed');
  assert.equal(db.db.prepare("SELECT status FROM crawl_runs WHERE id='recent'").get()?.status,'running');
  assert.equal(db.db.prepare('SELECT crawl_health FROM roasters').get()?.crawl_health,'running');
  assert.equal(db.db.prepare("SELECT count(*) AS count FROM crawl_errors WHERE code='attempt_expired'").get()?.count,1);
  assert.equal(count(db,'price_observations'),3);db.db.close();
});

test('source throttling cancels the response and honors Retry-After',async()=>{
  const db=await setup();let cancelled=false;let delay=0;
  const worker=createCrawlerWorker({fetch:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:429,headers:{'retry-after':'900'}})},clock());
  const throttled={...message(),retry(options:{delaySeconds:number}){delay=options.delaySeconds;}};
  await deliver(worker,db,[throttled]);assert.equal(cancelled,true);assert.equal(delay,900);assert.equal(count(db,'price_observations'),0);db.db.close();
});
