import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DERIVED_CACHE_TABLE, invalidateDerived, MAX_DERIVED_BYTES, purgeEverything, TRACKING_PARAM, untilIstanbulMidnight, withDerivedCache } from '../shared/v2/read-cache';
import { dropTrackingParams } from '../src/lib/v2-runtime';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

test('a derived result is computed once, shared, and recomputed after the nightly invalidation', async () => {
  const db = new TestCatalogDatabase();
  const cached = withDerivedCache(db, 'test:v1');
  let runs = 0;
  const compute = async () => ({ value: ++runs });
  assert.deepEqual(await cached.derive!('counts', compute), { value: 1 });
  assert.deepEqual(await withDerivedCache(db, 'test:v1').derive!('counts', compute), { value: 1 }, 'another isolate reads the stored row');
  assert.deepEqual(await withDerivedCache(db, 'test:v2').derive!('counts', compute), { value: 2 }, 'a new deploy has its own keys');
  // Rows are stamped with the database clock; move the stamps back so the invalidation is strictly later.
  db.sqlite.exec("UPDATE derived_cache SET created_at='2000-01-01T00:00:00.000Z'");
  await db.batch(invalidateDerived(db));
  assert.deepEqual(await cached.derive!('counts', compute), { value: 3 });
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM derived_cache WHERE key<>'invalidated' AND key NOT LIKE 'lease:%'").get()?.n, 1, 'invalidation dropped the old rows');
  db.sqlite.close();
});

test('a result computed before an invalidation is never trusted, and an old row expires', async () => {
  const db = new TestCatalogDatabase();
  const cached = withDerivedCache(db, 'test', 60);
  let runs = 0;
  // The refresh commits while this computation is running: its stamp (read first) is older than the invalidation.
  await cached.derive!('roasters', async () => { db.sqlite.exec("INSERT INTO derived_cache VALUES('invalidated','','2999-01-01T00:00:00.000Z')"); return ++runs; });
  assert.equal(await cached.derive!('roasters', async () => ++runs), 2);
  db.sqlite.exec("DELETE FROM derived_cache WHERE key='invalidated'");
  db.sqlite.exec(`UPDATE derived_cache SET created_at='${new Date(Date.now() - 61_000).toISOString()}'`);
  assert.equal(await cached.derive!('roasters', async () => ++runs), 3, 'older than the ttl');
  db.sqlite.close();
});

test('without the cache table the live result is served, and the nightly writer creates the table itself', async () => {
  const db = new TestCatalogDatabase();
  db.sqlite.exec('DROP TABLE derived_cache');
  assert.equal(await withDerivedCache(db, 'test').derive!('origins', async () => 'live'), 'live');
  await db.batch(invalidateDerived(db));
  db.sqlite.exec("UPDATE derived_cache SET created_at='2000-01-01T00:00:00.000Z'");
  assert.equal(await withDerivedCache(db, 'test').derive!('origins', async () => 'stored'), 'stored');
  assert.equal(await withDerivedCache(db, 'test').derive!('origins', async () => 'again'), 'stored');
  assert.ok(readFileSync('migrations/d1/0008_derived_cache.sql', 'utf8').includes(DERIVED_CACHE_TABLE), 'migration and writer create the same table');
  db.sqlite.close();
});

test('simultaneous first readers share one computation: in one isolate, and across isolates through a lease', async () => {
  const db = new TestCatalogDatabase();
  let runs = 0;
  const slow = async () => { runs++; await new Promise(resolve => setTimeout(resolve, 50)); return { value: runs }; };
  const results = await Promise.all(Array.from({ length: 10 }, () => withDerivedCache(db, 'stampede').derive!('facts', slow)));
  assert.equal(runs, 1, 'ten requests in one isolate, one computation');
  assert.ok(results.every(result => result.value === 1));
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM derived_cache WHERE key LIKE 'lease:%'").get()?.n, 0, 'the lease is released with the store');

  // Another isolate holds the lease and stores its result while this one waits: this one reads it instead of computing.
  const now = (db.sqlite.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS now").get() as { now: string }).now;
  db.sqlite.prepare("INSERT INTO derived_cache VALUES('lease:other:facts','',?)").run(now);
  setTimeout(() => db.sqlite.prepare("INSERT INTO derived_cache VALUES('other:facts','{\"value\":\"theirs\"}',?)").run(now), 500);
  assert.deepEqual(await withDerivedCache(db, 'other').derive!('facts', async () => ({ value: 'mine' })), { value: 'theirs' });

  // A lease older than a minute belongs to a computation that died: the next reader takes over at once.
  db.sqlite.prepare("INSERT INTO derived_cache VALUES('lease:stale:facts','','2000-01-01T00:00:00.000Z')").run();
  const started = Date.now();
  assert.deepEqual(await withDerivedCache(db, 'stale').derive!('facts', async () => ({ value: 'mine' })), { value: 'mine' });
  assert.ok(Date.now() - started < 1000);
  db.sqlite.close();
});

test('a value too large for a D1 row, or a failed store, is reported with its key and size, and still served', async () => {
  const db = new TestCatalogDatabase();
  const errors: string[] = [];
  const original = console.error;
  console.error = (message: string) => { errors.push(message); };
  try {
    const big = 'x'.repeat(MAX_DERIVED_BYTES);
    assert.equal(await withDerivedCache(db, 'big').derive!('similar-candidates', async () => big), big);
    assert.match(errors[0], /^Derived result not stored: big:similar-candidates is 1900002 bytes, over 1900000/);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM derived_cache WHERE key NOT LIKE 'lease:%'").get()?.n, 0);
    const failing = { prepare: (sql: string) => db.prepare(sql), batch: async () => { throw new Error('D1_ERROR: row too big'); } };
    assert.equal(await withDerivedCache(failing, 'failing').derive!('quiz-candidates', async () => 'value'), 'value');
    assert.match(errors[1], /^Derived result not stored: failing:quiz-candidates \(7 bytes\): D1_ERROR: row too big/);
  } finally { console.error = original; db.sqlite.close(); }
});

test('tracking parameters redirect to the same address without them; real filters stay', () => {
  for (const key of ['utm_source', 'fbclid', 'gclid', 'srsltid', 'igshid']) assert.ok(TRACKING_PARAM.test(key), key);
  for (const key of ['origin', 'page', 'search', 'sort', 'slug', 'taste']) assert.ok(!TRACKING_PARAM.test(key), key);
  assert.doesNotThrow(() => dropTrackingParams('/kahveler', { origin: 'Kenya', page: '2' }));
  assert.doesNotThrow(() => dropTrackingParams('/kahveler'));
  const target = (params: Record<string, string | string[]>) => { try { dropTrackingParams('/kahveler', params); } catch (error) { return String((error as { digest?: string }).digest); } return null; };
  assert.match(target({ origin: 'Kenya', utm_source: 'mektup', fbclid: 'x' })!, /;\/kahveler\?origin=Kenya;308;?/);
  assert.match(target({ gclid: 'x' })!, /;\/kahveler;308;?/);
  assert.match(target({ taste: ['fruity', 'floral'], utm_medium: 'x' })!, /;\/kahveler\?taste=fruity&taste=floral;308;?/);
});

test('the edge purge uses the first handle that can purge and never throws', async () => {
  const calls: unknown[] = [];
  const working = { purge: async (options: unknown) => { calls.push(options); return { success: true }; } };
  assert.equal(await purgeEverything(undefined, null), false, 'no handle: 503, not a 500');
  // Local workerd exposes a cache object without purge(); calling it used to throw a TypeError (500).
  assert.equal(await purgeEverything({}, working), true);
  assert.deepEqual(calls, [{ purgeEverything: true }]);
  assert.equal(await purgeEverything({ purge: () => { throw new Error('sync'); } }), false);
  assert.equal(await purgeEverything({ purge: async () => { throw new Error('async'); } }), false);
  assert.equal(await purgeEverything({ purge: async () => ({ success: false }) }), false);
});

test('/api/since is never served past Istanbul midnight, not even stale', () => {
  // 23:00 Istanbul (20:00 UTC): one hour left, and no stale window that would carry yesterday's 30 days into today.
  assert.equal(untilIstanbulMidnight(Date.parse('2026-10-05T20:00:00Z')), 'public, max-age=3600, stale-if-error=86400');
  assert.equal(untilIstanbulMidnight(Date.parse('2026-10-05T03:00:00Z')), 'public, max-age=21600, stale-if-error=86400');
});
