import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleOutbound, trustedReferralUrl } from '../shared/v2/outbound';
import type { AnalyticsEnvironment } from '../shared/v2/analytics';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const roasterId = '11111111-1111-4111-8111-111111111111';
async function setup(inStock: boolean | null = true) {
  const db = new TestCatalogDatabase(); const points: AnalyticsEngineDataPoint[] = [];
  await registerRoaster(db, { id: roasterId, slug: 'kimma', name: 'Kimma', websiteUrl: 'https://kimmacoffee.com', trustedHosts: ['shop.kimmacoffee.com'], adapter: 'test' });
  await ingestCrawl(db, { id: 'baseline', roasterId, startedAt: '2026-09-01T00:00:00Z', completedAt: '2026-09-01T00:01:00Z', status: 'success', mode: 'baseline', parserVersion: 'test', diagnostics: [], products: [
    { sourceProductId: 'p', canonicalUrl: 'https://shop.kimmacoffee.com/p', name: 'Coffee', visibility: 'public', rawMetadata: {}, offers: [{ sourceVariantId: 'sku', label: '250g', weightG: 250, price: 100, compareAtPrice: null, currency: 'TRY', inStock, purchaseUrl: 'https://shop.kimmacoffee.com/p?variant=456&attribute_size=250g&utm_source=old#secret' }] },
  ] });
  const offerId = String(db.sqlite.prepare('SELECT id FROM offers').get()?.id);
  const env: AnalyticsEnvironment = { DEPLOYMENT_STAGE: 'staging', ANALYTICS: { writeDataPoint(point) { if (point) points.push(point); } }, EVENT_LIMITER: { async limit() { return { success: true }; } } };
  return { db, offerId, env, points };
}
function request(id: string, headers: Record<string, string> = {}, query = 'source=detail', method = 'GET') { return new Request(`https://app.test/go/${id}?${query}`, { method, headers }); }

test('outbound uses a known offer and exact migrated shop host, preserves SKU options and adds only safe configured UTMs', async () => {
  const { db, offerId, env, points } = await setup();
  const result = await handleOutbound(request(offerId, {}, 'source=detail&url=https://evil.test&utm_source=attacker&utm_medium=attack'), offerId, db, env);
  assert.equal(result.status, 302); assert.equal(result.headers.get('cache-control'), 'no-store');
  const url = new URL(result.headers.get('location')!);
  assert.equal(url.hostname, 'shop.kimmacoffee.com'); assert.equal(url.searchParams.get('variant'), '456'); assert.equal(url.searchParams.get('attribute_size'), '250g');
  assert.equal(url.searchParams.get('utm_source'), 'kahvedrop'); assert.equal(url.searchParams.get('utm_medium'), 'referral'); assert.equal(url.searchParams.get('utm_content'), 'detail'); assert.equal(url.hash, '');
  assert.equal(points.length, 1); assert.equal(points[0].blobs?.[1], 'outbound_roaster_click'); assert.equal(points[0].blobs?.[5], roasterId); assert.equal(points[0].blobs?.[7], offerId);
  assert.doesNotMatch(JSON.stringify(points), /https|variant|attacker/); db.sqlite.close();
});
test('out-of-stock and unknown stock current offers retain redirects; hidden, retired, inactive or nonexistent records do not', async () => {
  const { db, offerId, env } = await setup(false);
  assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 302);
  db.sqlite.exec('UPDATE offers SET in_stock=NULL'); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 302);
  db.sqlite.exec("UPDATE coffees SET visibility='hidden'"); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 404);
  db.sqlite.exec("UPDATE coffees SET visibility='public'; UPDATE offers SET retired_at='2026-09-02'"); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 404);
  db.sqlite.exec('UPDATE offers SET retired_at=NULL; UPDATE roasters SET active=0'); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 404);
  assert.equal((await handleOutbound(request('missing'), 'missing', db, env)).status, 404);
  assert.equal((await handleOutbound(request(offerId, {}, '', 'POST'), offerId, db, env)).status, 405); db.sqlite.close();
});
test('destination policy rejects arbitrary hosts, userinfo, insecure URLs, custom ports and empty trust lists', async () => {
  for (const url of ['https://evil.test/p', 'https://shop.kimmacoffee.com.evil.test/p', 'https://user:pass@shop.kimmacoffee.com/p', 'http://shop.kimmacoffee.com/p', 'https://shop.kimmacoffee.com:8443/p', 'javascript:alert(1)', 'data:text/html,bad']) {
    assert.equal(trustedReferralUrl(url, ['shop.kimmacoffee.com'], 'detail'), null, url);
  }
  assert.equal(trustedReferralUrl('https://shop.kimmacoffee.com/p', [], 'detail'), null);
  assert.equal(new URL(trustedReferralUrl('https://www.kronotrop.com.tr/p', ['kronotrop.com.tr', 'www.kronotrop.com.tr'], 'detail')!).hostname, 'www.kronotrop.com.tr');
  const { db, offerId, env, points } = await setup();
  db.sqlite.exec("UPDATE offers SET purchase_url='https://evil.test/p'");
  const result = await handleOutbound(request(offerId), offerId, db, env);
  assert.equal(result.status, 404); assert.equal(result.headers.get('location'), null); assert.equal(points.length, 0); db.sqlite.close();
});
test('HEAD, prefetch, bots and fetch probes redirect without analytics; failures and rate limits never block a valid purchase', async () => {
  const { db, offerId, env, points } = await setup();
  for (const probe of [request(offerId, {}, '', 'HEAD'), request(offerId, { purpose: 'prefetch' }), request(offerId, { 'sec-purpose': 'prefetch;prerender' }), request(offerId, { 'user-agent': 'Googlebot' }), request(offerId, { 'sec-fetch-mode': 'cors' })]) {
    assert.equal((await handleOutbound(probe, offerId, db, env)).status, 302);
  }
  assert.equal(points.length, 0);
  for (const failing of [{}, { ...env, EVENT_LIMITER: { async limit() { return { success: false }; } } }, { ...env, EVENT_LIMITER: { async limit(): Promise<{ success: boolean }> { throw new Error('limiter'); } } }, { ...env, ANALYTICS: { writeDataPoint() { throw new Error('analytics'); } } }]) {
    assert.equal((await handleOutbound(request(offerId), offerId, db, failing)).status, 302);
  }
  assert.equal(points.length, 0); db.sqlite.close();
});
test('source context is enum-only and same-origin feed paths reduce to page enums without storing referrer queries', async () => {
  const { db, offerId, env, points } = await setup();
  await handleOutbound(request(offerId, { referer: 'https://app.test/firsatlar?search=private@example.com' }, 'source=feed'), offerId, db, env);
  assert.equal(points[0].blobs?.[3], 'deals');
  await handleOutbound(request(offerId, { referer: 'https://evil.test/yeni?email=private@example.com' }, 'source=private@example.com&event=private@example.com'), offerId, db, env);
  assert.equal(points[1].blobs?.[3], 'other'); assert.equal(points[1].blobs?.[4], 'unknown'); assert.equal(points[1].blobs?.[9], '');
  assert.doesNotMatch(JSON.stringify(points), /private|example\.com|https|search=/); db.sqlite.close();
});
test('a stale offer (unvalidated for over 7 days of its roaster\'s successful crawls) has no redirect until it is observed again', async () => {
  const { db, offerId, env } = await setup();
  const offer = (sku: string, currency = 'TRY') => ({ sourceVariantId: sku, label: '250g', weightG: 250, price: 100, compareAtPrice: null, currency, inStock: true, purchaseUrl: `https://shop.kimmacoffee.com/p?variant=${sku}` });
  const crawl = (day: string, currency: string) => ingestCrawl(db, { id: `live-${day}`, roasterId, startedAt: `2026-09-${day}T00:00:00Z`, completedAt: `2026-09-${day}T00:01:00Z`, status: 'success', parserVersion: 'test', diagnostics: [], products: [
    { sourceProductId: 'p', canonicalUrl: 'https://shop.kimmacoffee.com/p', name: 'Coffee', visibility: 'public', rawMetadata: {}, offers: [offer('sku', currency), offer('other')] }] });
  await crawl('08', 'TL'); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 302, 'seven days is still current');
  await crawl('09', 'TL'); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 404);
  await crawl('10', 'TRY'); assert.equal((await handleOutbound(request(offerId), offerId, db, env)).status, 302);
  db.sqlite.close();
});
