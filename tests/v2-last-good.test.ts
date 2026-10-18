import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseDeadlineError, forgetLastGoodChecks, LAST_GOOD_REFRESH_MS, lastGoodKey, withDeadline, withLastGood, type LastGoodStore } from '../shared/v2/last-good';
import { withDerivedCache } from '../shared/v2/read-cache';
import { lastGoodListingName } from '../shared/v2/catalog';
import { findLanding, landingFacts, listLandings } from '../src/lib/catalog-landing';
import type { CatalogDatabase, Statement } from '../shared/v2/database';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

/** An in-memory stand-in for the LAST_GOOD KV namespace. */
class MemoryKv implements LastGoodStore {
  entries = new Map<string, { value: string; metadata: unknown }>();
  puts = 0;
  async get(key: string) { return this.entries.get(key)?.value ?? null; }
  async getWithMetadata<M>(key: string) { const entry = this.entries.get(key); return { value: entry?.value ?? null, metadata: (entry?.metadata ?? null) as M | null }; }
  async put(key: string, value: string, options?: { metadata?: unknown }) { this.puts++; this.entries.set(key, { value, metadata: options?.metadata ?? null }); }
}
const quota = () => new Error('D1_ERROR: Exceeded daily row read limit (7500)');
/** A database whose every read fails the way D1 does once the daily allowance is spent. */
function spentDatabase(): CatalogDatabase & { calls: number } {
  const db = { calls: 0, prepare(): Statement {
    const statement: Statement = { bind: () => statement, first: async () => { db.calls++; throw quota(); }, all: async () => { db.calls++; throw quota(); } };
    return statement;
  }, batch: async () => { db.calls++; throw quota(); } };
  return db;
}

test('a value is kept in KV after it is computed, and served from there when the computation fails', async () => {
  forgetLastGoodChecks();
  const store = new MemoryKv();
  assert.deepEqual(await withLastGood({ store }, 'counts', async () => ({ coffees: 5 })), { coffees: 5 });
  assert.equal(store.puts, 1);
  const key = await lastGoodKey('counts');
  assert.ok(Date.parse((store.entries.get(key)!.metadata as { at: string }).at) <= Date.now(), 'the copy carries its write time');

  let fellBack: string | null | undefined;
  const value = await withLastGood({ store, onFallback: at => { fellBack = at; } }, 'counts', async () => { throw quota(); });
  assert.deepEqual(value, { coffees: 5 });
  assert.equal(fellBack, (store.entries.get(key)!.metadata as { at: string }).at);

  await assert.rejects(withLastGood({ store }, 'never-stored', async () => { throw quota(); }), /7500/, 'no copy: the original error');
  await assert.rejects(withLastGood(undefined, 'counts', async () => { throw quota(); }), /7500/, 'no KV binding: unchanged behaviour');
});

test('a fresh copy is not rewritten, so the copies stay far inside the free KV writes', async () => {
  forgetLastGoodChecks();
  const store = new MemoryKv();
  for (let run = 0; run < 5; run++) await withLastGood({ store }, 'origins', async () => ['Kenya']);
  assert.equal(store.puts, 1, 'this isolate checks a key at most once an hour');
  forgetLastGoodChecks();
  await withLastGood({ store }, 'origins', async () => ['Kenya', 'Peru']);
  assert.equal(store.puts, 1, 'another isolate sees the copy is younger than the refresh age');
  const key = await lastGoodKey('origins');
  store.entries.get(key)!.metadata = { at: new Date(Date.now() - LAST_GOOD_REFRESH_MS - 1000).toISOString() };
  forgetLastGoodChecks();
  await withLastGood({ store }, 'origins', async () => ['Kenya', 'Peru']);
  assert.equal(store.puts, 2, 'an old copy is replaced');
  assert.equal(await store.get(key), '["Kenya","Peru"]');
});

test('a failed KV write never fails the request', async () => {
  forgetLastGoodChecks();
  const store = new MemoryKv();
  store.put = async () => { throw new Error('KV write limit'); };
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try { assert.equal(await withLastGood({ store }, 'roasters', async () => 'live'), 'live'); }
  finally { console.error = original; }
  assert.equal(errors.length, 1);
});

test('long names are stored under a hash, inside the 512-byte KV key limit', async () => {
  const name = `derived:facts:${JSON.stringify(Array.from({ length: 40 }, (_, index) => ({ origin: [`Country ${index}`] })))}`;
  const key = await lastGoodKey(name);
  assert.ok(new TextEncoder().encode(key).byteLength <= 512);
  assert.match(key, /^v\d+:sha256:[0-9a-f]{64}$/);
  assert.equal(key, await lastGoodKey(name), 'stable');
  assert.equal(await lastGoodKey('counts'), 'v1:counts');
});

test('derived results fall back to their KV copy when D1 is out of reads', async () => {
  forgetLastGoodChecks();
  const store = new MemoryKv();
  const db = new TestCatalogDatabase();
  assert.deepEqual(await withDerivedCache(db, 'stage:v1', 86400, { store }).derive!('roasters', async () => ['live']), ['live']);
  db.sqlite.close();
  const spent = spentDatabase();
  let fellBack = false;
  // A new deploy (namespace) still finds it: the copy is keyed by name alone.
  const value = await withDerivedCache(spent, 'stage:v2', 86400, { store, onFallback: () => { fellBack = true; } }).derive!('roasters', async () => { await spent.prepare('SELECT 1').all(); return ['never']; });
  assert.deepEqual(value, ['live']);
  assert.ok(fellBack);
});

test('a statement that does not answer in time fails, and the rest of the request fails at once', async () => {
  let calls = 0;
  const hanging: CatalogDatabase = { prepare(): Statement {
    const statement: Statement = { bind: () => statement, first: () => { calls++; return new Promise(() => {}); }, all: () => { calls++; return new Promise(() => {}); } };
    return statement;
  }, batch: () => new Promise(() => {}) };
  const db = withDeadline(hanging, 30);
  const started = Date.now();
  await assert.rejects(db.prepare('SELECT 1').bind(1).first(), DatabaseDeadlineError);
  assert.ok(Date.now() - started < 1000);
  await assert.rejects(db.prepare('SELECT 2').all(), DatabaseDeadlineError);
  await assert.rejects(db.batch([db.prepare('SELECT 3')]), DatabaseDeadlineError);
  assert.equal(calls, 1, 'after the first outage nothing else reaches the database');
});

test('the daily-limit error stops the rest of the request; a plain SQL error does not', async () => {
  const spent = spentDatabase();
  const db = withDeadline(spent, 1000);
  await assert.rejects(db.prepare('SELECT 1').first(), /7500/);
  await assert.rejects(db.prepare('SELECT 1').first(), /7500/);
  assert.equal(spent.calls, 1);

  const sqlite = new TestCatalogDatabase();
  const live = withDeadline(sqlite, 1000);
  await assert.rejects(live.prepare('SELECT nope FROM missing').all(), /no such table/);
  assert.deepEqual({ ...await live.prepare('SELECT ? AS n').bind(2).first() }, { n: 2 }, 'a query bug does not stop the next read');
  await live.batch([live.prepare('CREATE TABLE t (n INTEGER)'), live.prepare('INSERT INTO t VALUES (?)').bind(7)]);
  assert.deepEqual({ ...await live.prepare('SELECT n FROM t').first() }, { n: 7 }, 'batch passes the underlying statements through');
  sqlite.sqlite.close();
});

test('only the unfiltered newest listing has a last-good copy, one per page', () => {
  assert.equal(lastGoodListingName({ origin: [], process: [], taste: [], roaster: [], sort: 'newest', page: 2, perPage: 24 }), 'listing:newest:24:2');
  assert.equal(lastGoodListingName({}), 'listing:newest:24:1');
  assert.equal(lastGoodListingName({ origin: ['Kenya'] }), null);
  assert.equal(lastGoodListingName({ search: 'geisha' }), null);
  assert.equal(lastGoodListingName({ search: '  ' }), 'listing:newest:24:1');
  assert.equal(lastGoodListingName({ priceMax: 500 }), null);
  assert.equal(lastGoodListingName({ sort: 'price_asc' }), null);
  assert.equal(lastGoodListingName({ event: 'NEW' }), null);
});

test('an origin with nothing listed costs no catalog pass of its own', async () => {
  const db = new TestCatalogDatabase();
  let reads = 0;
  const counted: CatalogDatabase = { prepare: sql => { reads++; return db.prepare(sql); }, batch: statements => db.batch(statements) };
  const landing = findLanding('koken', 'kolombiya');
  assert.ok(landing);
  await listLandings(counted);
  const listOnly = reads;
  reads = 0;
  assert.deepEqual(await landingFacts(counted, landing), { coffees: 0, roasters: 0 });
  assert.equal(reads, listOnly, 'only the shared landing list is read, never a separate count');
  db.sqlite.close();
});
