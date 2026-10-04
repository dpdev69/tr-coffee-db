import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitProductEvent, handleProductEvent, type AnalyticsEnvironment } from '../shared/v2/analytics';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const roasterId = '11111111-1111-4111-8111-111111111111';
const filtered = { event: 'feed_filter_change', page: 'catalog', source: 'catalog', filterKeys: ['taste', 'origin', 'taste'] };
function request(body: unknown = filtered, headers: Record<string, string> = {}) {
  return new Request('https://app.test/api/events', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function environment() {
  const points: AnalyticsEngineDataPoint[] = []; const keys: string[] = [];
  const env: AnalyticsEnvironment = { DEPLOYMENT_STAGE: 'staging', ANALYTICS: { writeDataPoint(point) { if (point) points.push(point); } }, EVENT_LIMITER: { async limit({ key }) { keys.push(key); return { success: true }; } } };
  return { env, points, keys };
}
async function setup() {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: roasterId, slug: 'shop', name: 'Shop', websiteUrl: 'https://shop.test', adapter: 'test' });
  await ingestCrawl(db, { id: 'baseline', roasterId, startedAt: '2026-09-01T00:00:00Z', completedAt: '2026-09-01T00:01:00Z', status: 'success', mode: 'baseline', parserVersion: 'test', diagnostics: [], products: [
    { sourceProductId: 'p', canonicalUrl: 'https://shop.test/p', name: 'Coffee', visibility: 'public', rawMetadata: {}, offers: [{ sourceVariantId: 'sku', label: '250g', weightG: 250, price: 100, compareAtPrice: null, currency: 'TRY', inStock: false, purchaseUrl: 'https://shop.test/p' }] },
  ] });
  return { db, coffeeId: String(db.sqlite.prepare('SELECT id FROM coffees').get()?.id) };
}

test('event intake stores fixed dimensions only and resolves actual visible coffee IDs independently of stock', async () => {
  const { db, coffeeId } = await setup(); const { env, points, keys } = environment();
  assert.equal((await handleProductEvent(request(filtered, { 'cf-connecting-ip': '203.0.113.8', 'referer': 'https://app.test/kahveler?search=private@example.com' }), env, db)).status, 204);
  assert.deepEqual(points[0].blobs, ['v1', 'feed_filter_change', 'staging', 'catalog', 'catalog', '', '', '', 'origin|taste', '']);
  assert.deepEqual(points[0].doubles, [1, 2]); assert.deepEqual(points[0].indexes, ['feed_filter_change']);
  assert.equal(keys[0], 'events:203.0.113.8');
  assert.doesNotMatch(JSON.stringify(points), /203\.0\.113|private@|search=/);
  assert.equal((await handleProductEvent(request({ event: 'coffee_detail_view', page: 'coffee', source: 'detail', coffeeId }), env, db)).status, 204);
  assert.equal(points[1].blobs?.[5], roasterId); assert.equal(points[1].blobs?.[6], coffeeId);
  db.sqlite.exec("UPDATE coffees SET visibility='hidden'");
  assert.equal((await handleProductEvent(request({ event: 'coffee_detail_view', page: 'coffee', source: 'detail', coffeeId }), env, db)).status, 404);
  assert.equal(points.length, 2); db.sqlite.close();
});
test('event intake rejects free text, PII, fake server events, unknown dimensions and invalid identifiers without writes', async () => {
  const db = new TestCatalogDatabase(); const { env, points } = environment();
  for (const body of [
    { ...filtered, email: 'private@example.com' }, { ...filtered, url: 'https://evil.test' }, { ...filtered, referrer: '/?email=private' },
    { ...filtered, source: 'private@example.com' }, { ...filtered, filterKeys: ['search=private@example.com'] },
    { ...filtered, event: 'newsletter_signup_success' }, { ...filtered, event: 'outbound_roaster_click' },
    { event: 'coffee_detail_view', page: 'coffee', source: 'detail' },
    { ...filtered, coffeeId: 'private@example.com' }, { ...filtered, roasterId }, [], null,
  ]) assert.equal((await handleProductEvent(request(body), env, db)).status, 400, JSON.stringify(body));
  assert.equal(points.length, 0); db.sqlite.close();
});
test('intake applies origin, bounded streaming body and method validation; no reflected unsafe errors', async () => {
  const db = new TestCatalogDatabase(); const { env, points } = environment();
  assert.equal((await handleProductEvent(new Request('https://app.test/api/events'), env, db)).status, 405);
  assert.equal((await handleProductEvent(request(filtered, { origin: 'https://evil.test' }), env, db)).status, 403);
  assert.equal((await handleProductEvent(request(filtered, { 'sec-fetch-site': 'cross-site' }), env, db)).status, 403);
  assert.equal((await handleProductEvent(request(filtered, { 'content-type': 'text/plain' }), env, db)).status, 415);
  for (const input of [request({ ...filtered, padding: 'x'.repeat(4096) }), request(filtered, { 'content-length': '5000' })]) {
    const result = await handleProductEvent(input, env, db); assert.equal(result.status, 413); assert.equal(await result.text(), '');
  }
  assert.equal((await handleProductEvent(new Request('https://app.test/api/events', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: '{' }), env, db)).status, 400);
  assert.equal(points.length, 0); db.sqlite.close();
});
test('intake suppresses bots and prefetch, limits abuse and reports unavailable sinks without throwing', async () => {
  const db = new TestCatalogDatabase(); const { env, points } = environment();
  const probes: Record<string, string>[] = [{ purpose: 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' }, { 'user-agent': 'Googlebot/2.1' }, { 'next-router-prefetch': '1' }];
  for (const headers of probes) {
    assert.equal((await handleProductEvent(request(filtered, headers), env, db)).status, 204);
  }
  assert.equal(points.length, 0);
  const limited = await handleProductEvent(request(), { ...env, EVENT_LIMITER: { async limit() { return { success: false }; } } }, db);
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal((await handleProductEvent(request(), { ANALYTICS: env.ANALYTICS }, db)).status, 503);
  assert.equal((await handleProductEvent(request(), { ...env, ANALYTICS: { writeDataPoint() { throw new Error('sink failure'); } } }, db)).status, 503);
  assert.equal(points.length, 0); db.sqlite.close();
});
test('server emitter permits signup acceptance but rejects accidental extra/private fields and catches a failing sink', () => {
  const { env, points } = environment();
  const event = { event: 'newsletter_signup_success', page: 'home', source: 'home-hero' } as const;
  assert.equal(emitProductEvent(env, event), true); assert.equal(points[0].blobs?.[1], 'newsletter_signup_success');
  assert.equal(emitProductEvent(env, { ...event, email: 'private@example.com' } as typeof event), false);
  assert.equal(emitProductEvent({}, event), false);
  assert.equal(emitProductEvent({ ANALYTICS: { writeDataPoint() { throw new Error('unavailable'); } } }, event), false);
});

test('advanced filter telemetry accepts names only and rejects altitude or traceability values',async()=>{
  const db=new TestCatalogDatabase();const {env,points}=environment();
  assert.equal((await handleProductEvent(request({...filtered,filterKeys:['altitude','traceability']}),env,db)).status,204);
  assert.equal(points[0].blobs?.[8],'altitude|traceability');
  for(const body of [{...filtered,altitude:'1800'},{...filtered,traceability:'available'},{...filtered,filterKeys:['altitude=1800']}])assert.equal((await handleProductEvent(request(body),env,db)).status,400);
  assert.equal(points.length,1);db.sqlite.close();
});
