import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { currentBadges, preferredOffer, tasteSummary, OfferPrice, DiscoveryCard } from '../src/components/v2/discovery-card';
import { DiscoveryDetail } from '../src/components/v2/discovery-detail';
import { parseDiscoveryFilters } from '../src/components/v2/discovery-catalog';
import type { CatalogCoffee, CatalogOffer } from '../shared/v2/catalog';
import type { CoffeeEvent } from '../shared/v2/types';

const now = Date.parse('2026-09-15T12:00:00Z');
const offer: CatalogOffer = { id: 'offer-250', coffeeId: 'coffee', sourceVariantId: 'sku-250', label: '250 g', weightG: 250, currency: 'TRY', priceMinor: 90000, compareAtMinor: 120000, inStock: true, purchaseUrl: 'https://example.com/coffee', unitPriceTry: 360, firstSeenAt: '2026-09-01T12:00:00Z', lastSeenAt: '2026-09-15T12:00:00Z', lastPriceChangeAt: '2026-09-15T12:00:00Z', variantOfferIds: ['offer-250'] };
function coffee(events: CoffeeEvent[] = []): CatalogCoffee {
  return { id: 'coffee', name: 'Example coffee', slug: 'example-coffee', sourceProductId: 'native-id', canonicalUrl: 'https://example.com/coffee', sourceUrl: 'https://example.com/coffee', roaster: { id: 'roaster', slug: 'example', name: 'Example', websiteUrl: 'https://example.com', city: null }, rawMetadata: {}, features: [], offers: [{ ...offer }], latestEvents: events, firstSeenAt: '2026-09-01T12:00:00Z', lastSeenAt: '2026-09-15T12:00:00Z', discontinuedAt: null, stale: false };
}
const deal: CoffeeEvent = { id: 'deal', coffeeId: 'coffee', offerId: offer.id, type: 'DEAL', createdAt: '2026-09-15T10:00:00Z', before: { priceMinor: 100000, currency: 'TRY', weightG: 250 }, after: { priceMinor: 90000, currency: 'TRY', weightG: 250 }, idempotencyKey: 'deal', observationId: 'observation' };

test('discovery badges require a current matching offer; compare-at alone is never a deal', () => {
  assert.deepEqual(currentBadges(coffee(), now), []);
  assert.equal(currentBadges(coffee([deal]), now)[0]?.type, 'DEAL');
  for (const change of [{ priceMinor: 95000 }, { weightG: 1000 }, { currency: 'EUR' }, { inStock: false }, { inStock: null }]) {
    const value = coffee([deal]); Object.assign(value.offers[0], change);
    assert.deepEqual(currentBadges(value, now), [], JSON.stringify(change));
  }
});
test('badges expire and reject invalid or future evidence', () => {
  for (const createdAt of ['2026-09-07T10:00:00Z', 'invalid', '2026-09-16T10:00:00Z']) {
    assert.deepEqual(currentBadges(coffee([{ ...deal, createdAt }]), now), []);
  }
  const restock: CoffeeEvent = { ...deal, type: 'RESTOCKED', after: { inStock: true } };
  const value = coffee([restock]); value.offers[0].inStock = null;
  assert.deepEqual(currentBadges(value, now), []);
});
test('card price belongs to an available package and taste shorthand uses recorded categories only', () => {
  const value = coffee();
  value.offers = [{ ...offer, id: 'sold', inStock: false, priceMinor: 1000 }, { ...offer, id: 'large', weightG: 1000 }, { ...offer, id: 'available' }];
  assert.equal(preferredOffer(value)?.id, 'available');
  assert.deepEqual(tasteSummary(value), []);
  value.features = [{ feature: 'flavor_categories', value: ['Fruity', 'Floral', 'invented'], sourceType: 'RULE_INFERRED', confidence: null, version: 'legacy', sourceReference: null }];
  assert.deepEqual(tasteSummary(value), ['Meyvemsi', 'Çiçeksi']);
});
test('catalog accepts legacy redirect query arrays and safely bounds invalid numeric filters', () => {
  const value = parseDiscoveryFilters({ roaster: ['one', 'two'], taste: ['Fruity', 'Floral'], roast: ['light'], brewMethod: 'v60', priceMin: 'NaN', priceMax: 'Infinity', page: '-4', sort: 'malformed' });
  assert.deepEqual(value.roaster, ['one', 'two']); assert.deepEqual(value.taste, ['Fruity', 'Floral']);
  assert.deepEqual(value.roast, ['light']); assert.deepEqual(value.brewMethod, ['v60']);
  assert.equal(value.priceMin, undefined); assert.equal(value.priceMax, undefined);
  assert.equal(value.page, 1); assert.equal(value.sort, 'newest');
});

test('advanced query contract preserves source altitude text and ignores retired archive filters',()=>{
  const filters=parseDiscoveryFilters({altitude:'  1800–2200 m  ',traceability:'available'});
  assert.equal(filters.altitude,'1800–2200 m');assert.equal(filters.traceability,undefined);
  assert.equal(parseDiscoveryFilters({traceability:'missing'}).traceability,undefined);
  assert.equal(parseDiscoveryFilters({traceability:'score-100'}).traceability,undefined);
  assert.equal(parseDiscoveryFilters({altitude:'x'.repeat(300)}).altitude?.length,80);
});


test('a unit price is shown only for a package with its own weight and is computed from that package alone', () => {
  // The stored unitPriceTry is deliberately wrong: the card divides this package's own price by its own weight.
  const html = renderToStaticMarkup(createElement(OfferPrice, { offer: { ...offer, unitPriceTry: 999 } }));
  assert.match(html, /900 TL/);
  assert.match(html, /250 g/);
  assert.match(html, /₺360 \/ 100 g/);
  assert.doesNotMatch(html, /999|Birim fiyat/);
  assert.match(renderToStaticMarkup(createElement(OfferPrice, { offer: { ...offer, weightG: 1000, priceMinor: 250000 } })), /₺250 \/ 100 g/);
  const foreign = renderToStaticMarkup(createElement(OfferPrice, { offer: { ...offer, currency: 'EUR', priceMinor: 2200, unitPriceTry: null } }));
  assert.match(foreign, /22 EUR/);
  assert.doesNotMatch(foreign, /100 g/);
  const unknownWeight = renderToStaticMarkup(createElement(OfferPrice, { offer: { ...offer, weightG: null, label: 'Kavurucu paketi', unitPriceTry: 360 } }));
  assert.match(unknownWeight, /Kavurucu paketi/);
  assert.doesNotMatch(unknownWeight, /100 g|250 g|₺/);
});


test('public coffee renders omit internal maintenance dates while preserving roaster coffee facts', () => {
  const value = coffee();
  value.rawMetadata = { roastDate: '2026-08-14', harvestYear: '2025', scaScore: 87.5 };
  const cardHtml = renderToStaticMarkup(createElement(DiscoveryCard, { coffee: value }));
  const detailHtml = renderToStaticMarkup(createElement(DiscoveryDetail, { coffee: value }));
  for (const html of [cardHtml, detailHtml]) {
    assert.doesNotMatch(html, /2026-09-01|2026-09-15|datetime=|kontrol edildi|ilk görülme|Kontrol tarihi|Son gözlemler|Fiyatın hikâyesi/);
  }
  assert.match(detailHtml, /2026-08-14/);
  assert.match(detailHtml, /2025/);
  assert.match(detailHtml, /SCA · kavurucu beyanı/);
  assert.match(detailHtml, /87,5/);
});


test('legacy migration package placeholders stay out of public price labels', () => {
  const html = renderToStaticMarkup(createElement(OfferPrice, { offer: { ...offer, weightG: null, label: 'Legacy package — SKU unverified' } }));
  assert.doesNotMatch(html, /Legacy|SKU|unverified/);
  assert.match(html, /Paket ağırlığı belirtilmemiş/);
});

test('the coffee scene slot carries quiz option ids and omits unknown values', () => {
  const value = coffee();
  assert.match(renderToStaticMarkup(createElement(DiscoveryDetail, { coffee: value })), /<div class="coffee-scene-slot[^"]*" data-scene-slot="coffee" aria-hidden="true">/);
  value.rawMetadata = { roast: 'Medium Light' };
  value.features = [{ feature: 'flavor_families', value: ['fruity', 'chocolatey', 'invented'], sourceType: 'RULE_INFERRED', confidence: null, version: 'v', sourceReference: null }];
  assert.match(renderToStaticMarkup(createElement(DiscoveryDetail, { coffee: value })), /data-scene-slot="coffee" data-roast="medium_light" data-taste="Fruity,Chocolate"/);
});
