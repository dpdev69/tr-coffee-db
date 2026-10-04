import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDigest, escapeHtml, kitDraftRequest } from '../scripts/v2-digest.mts';
import type { CatalogCoffee, CatalogOffer } from '../shared/v2/catalog';
import type { CoffeeEvent } from '../shared/v2/types';

const now = new Date('2026-10-05T03:00:00Z');
const offer = (id: string, priceMinor = 90000): CatalogOffer => ({ id, coffeeId: id, sourceVariantId: null, label: null, weightG: 250, currency: 'TRY', priceMinor, compareAtMinor: null, inStock: true, purchaseUrl: null, unitPriceTry: null, firstSeenAt: '2026-09-01T00:00:00Z', lastSeenAt: '2026-10-04T00:00:00Z', lastPriceChangeAt: null, variantOfferIds: [`${id}-sku`] });
const event = (coffeeId: string, type: CoffeeEvent['type'], before: number, after: number): CoffeeEvent => ({ id: `${coffeeId}-${type}`, coffeeId, offerId: `${coffeeId}-sku`, type, createdAt: '2026-10-03T00:00:00Z', before: { priceMinor: before, currency: 'TRY', weightG: 250 }, after: { priceMinor: after, currency: 'TRY', weightG: 250 }, idempotencyKey: type, observationId: 'obs' });
function coffee(id: string, name = `Kahve ${id}`, events: CoffeeEvent[] = []): CatalogCoffee {
  return { id, name, slug: `kahve-${id}`, canonicalUrl: `https://shop.test/${id}`, sourceUrl: null, sourceProductId: id, roaster: { id: 'r', slug: 'r', name: 'Kavurucu & Co', websiteUrl: 'https://shop.test', city: null },
    rawMetadata: { country: 'Ethiopia', process: 'washed' }, features: [{ feature: 'flavor_categories', value: ['Fruity'], sourceType: 'RULE_INFERRED', confidence: null, version: 'v', sourceReference: null }],
    offers: [offer(id)], latestEvents: events, firstSeenAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-04T00:00:00Z', discontinuedAt: null, stale: false };
}

test('digest orders sections, dedupes drops, escapes names and tags links', () => {
  const both = coffee('a', '<script>alert(1)</script> & Co', [event('a', 'DEAL', 120000, 90000), event('a', 'PRICE_DROP', 120000, 90000)]);
  const digest = buildDigest({ DEAL: [both], PRICE_DROP: [both, coffee('b', 'B', [event('b', 'PRICE_DROP', 100000, 90000)])], NEW: [coffee('n')], RESTOCKED: [] }, { siteUrl: 'https://kahvedrop.test/', now });
  assert.equal(digest.itemCount, 3);
  assert.deepEqual(digest.sections, [{ title: 'Fiyatı düşenler', count: 2 }, { title: 'Yeni gelenler', count: 1 }]);
  assert.match(digest.subject, /2 fiyatı düşen, 1 yeni$/);
  assert.doesNotMatch(digest.html, /Tekrar raflarda/);
  assert.ok(digest.html.indexOf('Fiyatı düşenler') < digest.html.indexOf('Yeni gelenler'));
  assert.doesNotMatch(digest.html, /<script>/);
  assert.match(digest.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Co/);
  assert.match(digest.html, /Kavurucu &amp; Co/);
  assert.match(digest.html, /href="https:\/\/kahvedrop\.test\/kahve\/kahve-a\?utm_source=kit&amp;utm_medium=email&amp;utm_campaign=haftalik-drop-2026-10-05"/);
  assert.match(digest.text, /https:\/\/kahvedrop\.test\/kahve\/kahve-n\?utm_source=kit&utm_medium=email&utm_campaign=haftalik-drop-2026-10-05/);
  assert.match(digest.html, /Doğrulanmış fırsat: 1\.200 TL → 900 TL/);
  assert.match(digest.text, /Fiyatı düştü: 1\.000 TL → 900 TL/);
  assert.match(digest.text, /Etiyopya · Yıkanmış\nMeyvemsi\n/);
  assert.match(digest.html, /<!-- Kit/);
  assert.doesNotMatch(digest.html, /unsubscribe_url|abonelikten/i);
});

test('stale drop prices and empty weeks print nothing misleading', () => {
  const stale = coffee('s', 'S', [event('s', 'PRICE_DROP', 100000, 80000)]);
  const digest = buildDigest({ DEAL: [], PRICE_DROP: [stale], NEW: [], RESTOCKED: [] }, { siteUrl: 'https://kahvedrop.test', now });
  assert.doesNotMatch(digest.text, /→/);
  assert.equal(buildDigest({ DEAL: [], PRICE_DROP: [], NEW: [], RESTOCKED: [] }, { siteUrl: 'https://kahvedrop.test', now }).itemCount, 0);
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('Kit request is an unscheduled private draft that never follows redirects', () => {
  const digest = buildDigest({ DEAL: [], PRICE_DROP: [], NEW: [coffee('n')], RESTOCKED: [] }, { siteUrl: 'https://kahvedrop.test', now });
  const { url, init } = kitDraftRequest(digest, 'test-key');
  assert.equal(url, 'https://api.kit.com/v4/broadcasts');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  assert.equal((init.headers as Record<string, string>)['X-Kit-Api-Key'], 'test-key');
  const body = JSON.parse(init.body as string);
  assert.equal(body.send_at, null);
  assert.equal(body.public, false);
  assert.equal(body.subject, digest.subject);
  assert.equal(body.content, digest.html);
  assert.equal(body.preview_text, digest.previewText);
});
