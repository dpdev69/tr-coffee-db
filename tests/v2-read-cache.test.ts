import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DERIVED_CACHE_TABLE, invalidateDerived, TRACKING_PARAM, withDerivedCache } from '../shared/v2/read-cache';
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
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM derived_cache WHERE key<>'invalidated'").get()?.n, 1, 'invalidation dropped the old rows');
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
