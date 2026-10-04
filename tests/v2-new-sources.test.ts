import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { crawlRoaster } from '../scrapers/src/v2/crawl.ts';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs.ts';
import { coffeeExclusionReason } from '../shared/v2/coffee-eligibility.ts';
import { isQualifiedSource } from '../shared/v2/qualified-sources.ts';

// Real endpoint responses recorded 2026-10-05, trimmed to a few products (tests/fixtures/v2/new-sources).
const json = async (name: string) => JSON.parse(await readFile(new URL(`./fixtures/v2/new-sources/${name}`, import.meta.url), 'utf8'));
const config = (slug: string) => ALL_ROASTER_CONFIGS.find(c => c.slug === slug)!;
const respond = (body: unknown, headers?: Record<string, string>) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers });
const noWait = { requestDelayMs: 0, sleep: async () => {} };
const summary = (products: Awaited<ReturnType<typeof crawlRoaster>>['products']) => products.map(p => [p.name, p.offers.map(o => [o.weightG, o.price, o.inStock])]);

/** Serves the IKAS storefront page (public config only; the API key is a placeholder) and one catalog page. */
async function crawlIkas(slug: string, file: string) {
  const fixture = await json(file);
  return crawlRoaster(config(slug), { ...noWait, fetch: async (_, init) => init?.body
    ? respond({ data: { searchProducts: fixture.searchProducts } })
    : respond(`<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { configJson: fixture.context } } })}</script>`) });
}

describe('wave-2 sources are proven offline from recorded responses', () => {
  it('Coffee Sapiens (Shopify): coffee parsed, grinder left to the eligibility rule', async () => {
    const fixture = await json('coffee-sapiens-shopify.json');
    const result = await crawlRoaster(config('coffee-sapiens'), { ...noWait, fetch: async () => respond({ products: fixture.products }) });
    assert.equal(result.complete, true);
    assert.deepEqual(summary(result.products).slice(0, 2), [
      ['INDONESIA MAS IYAN GIGI JERUK', [[250, 1150, true], [250, 1150, true]]],
      ['KOLOMBİYA SUPREMO HUILA', [[250, 555, true], [1000, 2000, true]]],
    ]);
    const grinder = result.products.find(p => /Wilfa/.test(p.name))!;
    assert.equal(coffeeExclusionReason(grinder), 'non_coffee_equipment_or_service');
  });

  it('Lot Coffee (WooCommerce): single origins filed only under "Specialty" are kept, filter paper is not', async () => {
    const fixture = await json('lot-woocommerce.json');
    const result = await crawlRoaster(config('lot-coffee'), { ...noWait, fetch: async url => new URL(String(url)).searchParams.get('type') === 'variation'
      ? respond(fixture.variations) : respond(fixture.products, { 'x-wp-totalpages': '1' }) });
    assert.equal(result.complete, true);
    assert.deepEqual(summary(result.products), [['Kenya Gakuyuini', [[250, 925, true], [1000, 3200, true]]]]);
  });

  it('Caffe Di Toee (IKAS)', async () => {
    const result = await crawlIkas('caffe-di-toee', 'caffe-di-toee-ikas.json');
    assert.equal(result.complete, true);
    assert.deepEqual(summary(result.products).find(([name]) => name === 'Morbido Blend'), ['Morbido Blend', [[250, 550, true], [1000, 1900, true]]]);
    assert.equal(result.products.length, 3);
  });

  it('Mayard (IKAS): keeps sold-out coffees as unavailable instead of dropping them', async () => {
    const result = await crawlIkas('mayard', 'mayard-ikas.json');
    assert.equal(result.complete, true);
    assert.equal(result.products.length, 3);
    assert.deepEqual(result.products.find(p => /Uganda/.test(p.name))!.offers.map(o => o.inStock), [false]);
    assert.deepEqual(result.products.find(p => /Clabelina/.test(p.name))!.offers.map(o => [o.weightG, o.price, o.inStock]), [[250, 610, true], [1000, 2080, true]]);
  });

  it('Vitus (IKAS): stock counts of zero at the storefront warehouse read as out of stock', async () => {
    const result = await crawlIkas('vitus', 'vitus-ikas.json');
    assert.equal(result.complete, true);
    assert.deepEqual(summary(result.products)[0], ['Italian Espresso Blend', [[250, 435, false], [1000, 1566, false]]]);
  });

  it('are configured, unique and still awaiting qualification', () => {
    const added = ['coffee-sapiens', 'lot-coffee', 'caffe-di-toee', 'mayard', 'vitus'];
    assert.equal(new Set(ALL_ROASTER_CONFIGS.map(c => c.slug)).size, ALL_ROASTER_CONFIGS.length);
    for (const slug of added) { assert.ok(config(slug), slug); assert.equal(isQualifiedSource(slug), false, slug); }
    assert.equal(config('caffe-di-toee').city, 'Ankara');
    assert.equal(config('lot-coffee').city, null);
  });
});
