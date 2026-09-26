import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { CatalogDatabase, SqlValue, Statement } from '../shared/v2/database';
import { beginCrawl, ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { CrawlInput } from '../shared/v2/types';

/** Executes actual SQL and rollback against SQLite, implementing D1's documented atomic batch semantics. */
class SqliteD1 implements CatalogDatabase {
  sqlite = new DatabaseSync(':memory:');
  beforeBatch?: () => void;
  constructor() { for(const file of ['0001_catalog.sql','0002_queue_job_idempotency.sql']) this.sqlite.exec(readFileSync(new URL(`../migrations/d1/${file}`, import.meta.url),'utf8')); }
  prepare(sql: string): Statement { return new SqliteStatement(this,sql); }
  async batch(statements: Statement[]): Promise<unknown[]> {
    this.beforeBatch?.();
    this.beforeBatch = undefined;
    this.sqlite.exec('BEGIN');
    try {
      const result = statements.map(statement => {
        const {sql,values} = statement as SqliteStatement;
        return this.sqlite.prepare(sql).run(...values);
      });
      this.sqlite.exec('COMMIT');
      return result;
    } catch(error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
class SqliteStatement implements Statement {
  values: SqlValue[] = [];
  constructor(readonly owner: SqliteD1,readonly sql: string) {}
  bind(...values: SqlValue[]) { this.values=values; return this; }
  async first<T>() { return (this.owner.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  async all<T>() { return { results:this.owner.sqlite.prepare(this.sql).all(...this.values) as T[],success:true }; }
}
function crawl(day: number, price = 100): CrawlInput { return { id:`r${day}`,roasterId:'r',startedAt:`2026-01-0${day}T00:00:00.000Z`,completedAt:`2026-01-0${day}T00:01:00.000Z`,
  status:'success',parserVersion:'test1',diagnostics:[],products:[{sourceProductId:'123',canonicalUrl:'https://shop.test/p',name:'Coffee',rawMetadata:{process:'Natural'},visibility:'public',
    offers:[{sourceVariantId:'456',label:'250g',weightG:250,price,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:'https://shop.test/p?variant=456'}]}] }; }
async function setup() { const db = new SqliteD1(); await registerRoaster(db,{id:'r',slug:'r',name:'R',websiteUrl:'https://shop.test',adapter:'test'}); return db; }
const count = (db: SqliteD1,table: string) => Number(db.sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);

test('atomic crawl ingestion preserves same offer history, stable URLs, idempotency and verified deal evidence', async () => {
  const db = await setup();
  await ingestCrawl(db,{...crawl(1),mode:'baseline'});
  const oldSlug = db.sqlite.prepare('SELECT slug FROM coffees').get()?.slug;
  await ingestCrawl(db,crawl(2));
  const third = crawl(3,90);
  third.products[0].name='Renamed coffee';
  third.products[0].canonicalUrl='https://shop.test/new-url';
  const result = await ingestCrawl(db,third);
  assert.equal(result.events,2);
  assert.equal(count(db,'coffees'),1);
  assert.equal(count(db,'offers'),1);
  assert.equal(count(db,'price_observations'),3);
  assert.equal(db.sqlite.prepare('SELECT slug FROM coffees').get()?.slug,oldSlug);
  assert.equal(count(db,'coffee_aliases'),4);
  assert.equal((await ingestCrawl(db,third)).replayed,true);
  assert.equal(count(db,'price_observations'),3);
  assert.equal(count(db,'coffee_events'),2);
  const deal = db.sqlite.prepare("SELECT before_json FROM coffee_events WHERE type='DEAL'").get();
  assert.equal(JSON.parse(String(deal?.before_json)).baselineObservationIds.length,2);
  await assert.rejects(ingestCrawl(db,{...third,parserVersion:'different'}),/reused/);
  db.sqlite.close();
});
test('failed, partial and missing products never mass-unavailable; health and safe diagnostics persist', async () => {
  const db = await setup();
  await ingestCrawl(db,crawl(1));
  const original = db.sqlite.prepare('SELECT * FROM offers').get();
  for (const [day,status] of [[2,'failed'],[3,'partial']] as const) {
    const input=crawl(day,1); input.status=status; input.diagnostics=[{stage:'fetch',code:'FAILED',message:'token=SECRET person@example.com',context:{secret:'hidden'}}];
    await ingestCrawl(db,input);
  }
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM offers').get(),original);
  assert.equal(count(db,'price_observations'),1);
  assert.equal(count(db,'crawl_errors'),2);
  assert.doesNotMatch(JSON.stringify(db.sqlite.prepare('SELECT * FROM crawl_errors').all()),/SECRET|person@example|hidden/);
  const other=crawl(4); other.products[0].sourceProductId='different';other.products[0].canonicalUrl='https://shop.test/other';other.products[0].offers[0].sourceVariantId='other';
  await ingestCrawl(db,other);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS count FROM offers WHERE in_stock=1').get()?.count,2);
  db.sqlite.close();
});
test('duplicates, stale crawls, ambiguous identities and concurrent plans fail without partial writes', async () => {
  const db = await setup();
  await ingestCrawl(db,crawl(1));
  const duplicate=crawl(2);duplicate.products[0].offers.push({...duplicate.products[0].offers[0]});
  await assert.rejects(ingestCrawl(db,duplicate),/Duplicate offer/);
  assert.equal(count(db,'crawl_runs'),1);
  const ambiguous=crawl(2);ambiguous.products[0].sourceProductId='unexpected';
  await assert.rejects(ingestCrawl(db,ambiguous),/identity change/);
  db.beforeBatch=() => db.sqlite.exec('UPDATE roasters SET revision=revision+1');
  await assert.rejects(ingestCrawl(db,crawl(2)),/CHECK/);
  assert.equal(count(db,'price_observations'),1);
  assert.equal(count(db,'ingestion_guards'),0);
  await ingestCrawl(db,crawl(3));
  await assert.rejects(ingestCrawl(db,crawl(2)),/Stale/);
  assert.equal(count(db,'crawl_runs'),2);
  db.sqlite.close();
});
test('rollback includes the entire batch when a late feature constraint fails', async () => {
  const db=await setup();
  const input=crawl(1);input.products[0].features=[{feature:'flavor',value:'fruit',sourceType:'RULE_INFERRED',confidence:0.8,version:'1'},{feature:'flavor',value:'nut',sourceType:'RULE_INFERRED',confidence:0.8,version:'1'}];
  await assert.rejects(ingestCrawl(db,input),/UNIQUE/);
  for(const table of ['coffees','offers','price_observations','coffee_events','crawl_runs','coffee_aliases']) assert.equal(count(db,table),0);
  db.sqlite.close();
});
test('running attempts persist before fetch and finish idempotently', async () => {
  const db=await setup();const input=crawl(1);
  assert.deepEqual(await beginCrawl(db,input),{status:'running',existed:false});
  assert.equal(db.sqlite.prepare('SELECT crawl_health FROM roasters').get()?.crawl_health,'running');
  assert.equal(count(db,'coffees'),0);
  assert.deepEqual(await beginCrawl(db,input),{status:'running',existed:true});
  await ingestCrawl(db,input);
  assert.deepEqual(await beginCrawl(db,input),{status:'success',existed:true});
  assert.equal(count(db,'crawl_runs'),1);
  assert.equal((await ingestCrawl(db,input)).replayed,true);
  db.sqlite.close();
});
test('baseline retires synthetic legacy offers without inventing SKU history or duplicate active counts', async () => {
  const db=await setup();const legacy=crawl(1);legacy.mode='import';
  legacy.products[0].offers[0].sourceVariantId=null;legacy.products[0].offers[0].identityKey='legacy:original-coffee';
  await ingestCrawl(db,legacy);
  await ingestCrawl(db,{...crawl(2),mode:'baseline'});
  assert.equal(count(db,'offers'),2);
  assert.equal(count(db,'price_observations'),2);
  assert.equal(count(db,'coffee_events'),0);
  assert.equal(db.sqlite.prepare('SELECT offers FROM catalog_counts').get()?.offers,1);
  await ingestCrawl(db,crawl(3,80));
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM coffee_events WHERE type='DEAL'").get()?.count,0);
  db.sqlite.close();
});
test('conflicting URLs inside one new crawl are rejected and older failed attempts cannot override newer health', async () => {
  const db=await setup();const collision=crawl(1);
  collision.products.push({...collision.products[0],sourceProductId:'another'});
  await assert.rejects(ingestCrawl(db,collision),/Conflicting product alias/);
  assert.equal(count(db,'coffees'),0);
  await ingestCrawl(db,crawl(3));
  await ingestCrawl(db,{...crawl(2),status:'failed'});
  assert.equal(db.sqlite.prepare('SELECT crawl_health FROM roasters').get()?.crawl_health,'success');
  db.sqlite.close();
});
test('a scheduled job can commit only one successful attempt even when the second plan reads after the first commit',async()=>{
  const db=await setup();
  await ingestCrawl(db,{...crawl(1),jobKey:'one-scheduled-job',mode:'baseline'});
  await assert.rejects(ingestCrawl(db,{...crawl(2),jobKey:'one-scheduled-job',mode:'baseline'}),/UNIQUE/);
  assert.equal(count(db,'crawl_runs'),1);assert.equal(count(db,'price_observations'),1);
  assert.equal(db.sqlite.prepare('SELECT last_seen_at FROM coffees').get()?.last_seen_at,crawl(1).startedAt);
  db.sqlite.close();
});

test('successful source refresh replaces old derived values but preserves reviewed manual and unrelated declared features', async () => {
  const db = await setup();
  const baseline = crawl(1);
  baseline.products[0].features = [
    { feature: 'process_family', value: 'washed', sourceType: 'RULE_INFERRED', confidence: 0.7, version: 'rules-v1' },
    { feature: 'old_taste', value: 'fruity', sourceType: 'RULE_INFERRED', confidence: null, version: 'rules-v1' },
    { feature: 'process_family', value: 'Washed', sourceType: 'ROASTER_DECLARED', confidence: null, version: 'source-v1', sourceReference: 'https://shop.test/p' },
  ];
  await ingestCrawl(db, baseline);
  // Simulate an independently reviewed write, never an upstream crawler assertion.
  db.sqlite.prepare(`INSERT INTO coffee_feature_values (coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at)
    SELECT id,'process_family','"honey"','MANUAL',0.99,'review-v1','review:42',?,? FROM coffees`)
    .run(baseline.startedAt, baseline.startedAt);
  const protectedBefore = db.sqlite.prepare("SELECT * FROM coffee_feature_values WHERE source_type IN ('MANUAL','ROASTER_DECLARED') ORDER BY source_type").all();
  const refresh = crawl(2);
  refresh.products[0].features = [{ feature: 'process_family', value: 'natural', sourceType: 'RULE_INFERRED', confidence: 0.8, version: 'rules-v2', sourceReference: 'https://shop.test/p#process' }];
  const result = await ingestCrawl(db, refresh);
  assert.equal(result.status, 'success');
  assert.equal(count(db, 'price_observations'), 2);
  assert.deepEqual(db.sqlite.prepare("SELECT * FROM coffee_feature_values WHERE source_type IN ('MANUAL','ROASTER_DECLARED') ORDER BY source_type").all(), protectedBefore);
  const derived = db.sqlite.prepare("SELECT feature,value_json,version,source_reference FROM coffee_feature_values WHERE source_type='RULE_INFERRED'").all();
  assert.equal(derived.length, 1);
  assert.equal(derived[0].feature, 'process_family');
  assert.equal(derived[0].value_json, '"natural"');
  assert.equal(derived[0].version, 'rules-v2');
  assert.equal(derived[0].source_reference, 'https://shop.test/p#process');
  assert.equal((await ingestCrawl(db, refresh)).replayed, true);
  assert.deepEqual(db.sqlite.prepare("SELECT * FROM coffee_feature_values WHERE source_type IN ('MANUAL','ROASTER_DECLARED') ORDER BY source_type").all(), protectedBefore);
  db.sqlite.close();
});

test('forged MANUAL provenance in a source result cannot create or replace reviewed features or commit other changes', async () => {
  const db = await setup();
  await ingestCrawl(db, crawl(1));
  db.sqlite.prepare(`INSERT INTO coffee_feature_values (coffee_id,feature,value_json,source_type,confidence,version,created_at,updated_at)
    SELECT id,'origin_country','"Ethiopia"','MANUAL',NULL,'review-v1',?,? FROM coffees`).run(crawl(1).startedAt, crawl(1).startedAt);
  const beforeFeatures = db.sqlite.prepare('SELECT * FROM coffee_feature_values').all();
  const beforeCoffee = db.sqlite.prepare('SELECT * FROM coffees').get();
  const beforeOffer = db.sqlite.prepare('SELECT * FROM offers').get();
  for (const feature of ['origin_country', 'new_manual_claim']) {
    const forged = crawl(2, 1);
    forged.products[0].name = 'Untrusted replacement';
    forged.products[0].features = [
      { feature: 'process_family', value: 'natural', sourceType: 'RULE_INFERRED', confidence: null, version: 'rules-v2' },
      { feature, value: 'fabricated review', sourceType: 'MANUAL', confidence: 1, version: 'forged-v1' },
    ];
    await assert.rejects(ingestCrawl(db, forged), /Crawl features may only use ROASTER_DECLARED or RULE_INFERRED provenance/);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM coffee_feature_values').all(), beforeFeatures);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM coffees').get(), beforeCoffee);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM offers').get(), beforeOffer);
    assert.equal(count(db, 'crawl_runs'), 1);
    assert.equal(count(db, 'price_observations'), 1);
  }
  db.sqlite.close();
});

test('first native baseline upgrades only an imported URL-path identity and preserves its aliases and history',async()=>{
  const db=await setup();const imported=crawl(1);imported.mode='import';imported.products[0].sourceProductId='p';
  imported.products[0].offers[0]={...imported.products[0].offers[0],sourceVariantId:null,identityKey:'legacy:old-row'};
  await ingestCrawl(db,imported);const identity=db.sqlite.prepare('SELECT id,slug FROM coffees').get();
  await ingestCrawl(db,{...crawl(2),mode:'baseline'});
  assert.deepEqual(db.sqlite.prepare('SELECT id,slug FROM coffees').get(),identity);
  assert.equal(count(db,'coffees'),1);assert.equal(count(db,'price_observations'),2);assert.equal(count(db,'coffee_events'),0);
  assert.deepEqual(db.sqlite.prepare("SELECT alias FROM coffee_aliases WHERE alias_type='source' ORDER BY alias").all().map(r=>r.alias),['123','p']);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM offers WHERE retired_at IS NOT NULL").get()?.n,1);
  const changed=crawl(3);changed.mode='baseline';changed.products[0].sourceProductId='another-native-id';
  await assert.rejects(ingestCrawl(db,changed),/identity change/);db.sqlite.close();
});

test('explicitly unavailable parents retire offers without fabricated SKU observations and recover on return', async()=>{
  const db=await setup();await ingestCrawl(db,{...crawl(1),mode:'baseline'});
  const unavailable=crawl(2);unavailable.products[0]={...unavailable.products[0],offers:[],unavailable:true};
  await ingestCrawl(db,unavailable);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM offers WHERE retired_at IS NULL').get()?.n,0);
  assert.equal(count(db,'price_observations'),1);assert.equal(count(db,'coffee_events'),0);
  await ingestCrawl(db,crawl(3));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM offers WHERE retired_at IS NULL').get()?.n,1);db.sqlite.close();
});
