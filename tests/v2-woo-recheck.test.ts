import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { crawlRoaster } from '../scrapers/src/v2/crawl.ts';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs.ts';

// Store API responses recorded 2026-10-20 with the crawler's own User-Agent, trimmed to a few products per shop and to the
// fields the parser reads (descriptions cut to 500 characters). These six shops were listed in TODOS.md (2026-05-21) as
// returning zero products; the current crawler reads all of them.
const fixture = JSON.parse(await readFile(new URL('./fixtures/v2/woo-recheck-2026-10-20.json', import.meta.url), 'utf8')) as
  Record<string, { products: { id: number }[]; variations: { id: number }[] }>;
const config = (slug: string) => ALL_ROASTER_CONFIGS.find(c => c.slug === slug)!;

async function crawl(slug: string) {
  const urls: string[] = [], sleeps: number[] = [];
  const result = await crawlRoaster(config(slug), { requestDelayMs: 0, sleep: async ms => { sleeps.push(ms); }, fetch: async url => {
    urls.push(String(url));
    const params = new URL(String(url)).searchParams;
    if (params.get('type') === 'variation') {
      const ids = params.get('include')!.split(',');
      return new Response(JSON.stringify(fixture[slug].variations.filter(v => ids.includes(String(v.id)))));
    }
    return new Response(JSON.stringify(fixture[slug].products), { headers: { 'x-wp-totalpages': '1' } });
  } });
  const summary = result.products.map(p => [p.name, p.offers.map(o => [o.weightG, o.price, o.inStock])]);
  return { result, summary, urls, sleeps };
}

describe('WooCommerce shops once listed as zero-product are read completely', () => {
  it('Coffeemamma: coffees kept, the grinder skipped before any variation request', async () => {
    const { result, summary, urls } = await crawl('coffeemamma');
    assert.equal(result.complete, true);
    assert.deepEqual(summary.map(([name]) => name), ['Colombia Armenia Quindio', 'Espresso Napolitan Blend']);
    assert.deepEqual(summary[1], ['Espresso Napolitan Blend', [[250, 425, true], [1000, 1650, true]]]);
    // The shop names no bag size on this coffee's grind options: unknown stays unknown.
    assert.ok((summary[0][1] as unknown[][]).every(([weight, price]) => weight === null && price === 1100));
    assert.equal(urls.length, 2);
    assert.ok(!urls[1].includes('5976'), 'grinder variations are never requested');
  });

  it('Old Java: a simple product and a sold-out variable coffee are both kept, the kettle is not', async () => {
    const { result, summary } = await crawl('old-java');
    assert.equal(result.complete, true);
    assert.deepEqual(summary, [['Kenya / Nduma ( organik )', [[null, 580, false]]], ['Cold Brew', [[null, 320, true]]]]);
  });

  it('Poka: bottled ready-to-drink cold brew is skipped', async () => {
    const { result, summary } = await crawl('poka');
    assert.equal(result.complete, true);
    assert.deepEqual(summary, [
      ['BREZİLYA FAZENDA INES ANAEROBİK', [[1000, 2300, true], [250, 600, true]]],
      ['TÜRK KAHVESİ HARMANI', [[250, 400, true], [500, 800, true], [1000, 1500, true]]],
    ]);
  });

  it('Baristocrat: prices in kuruş, the mug skipped', async () => {
    const { result, summary } = await crawl('baristocrat');
    assert.equal(result.complete, true);
    assert.deepEqual(summary, [['Kenya – Kibugu', [[250, 950, true]]], ['Baristocrat Blend – Türk Kahvesi', [[250, 275, true], [250, 275, true]]]]);
  });

  it('Daphne: every "Paket" size is its own offer', async () => {
    const { result, summary } = await crawl('daphne');
    assert.equal(result.complete, true);
    assert.deepEqual(summary, [
      ['Ethiopia Yaye', [[100, 410, true], [250, 975, true]]],
      ['Endonezya Arjuna', [[1000, 2600, true], [250, 850, true], [100, 400, true]]],
    ]);
  });

  it('Williams: robots.txt Crawl-delay 3 holds even when the caller asks for no delay', async () => {
    const { result, summary, sleeps } = await crawl('williams');
    assert.equal(result.complete, true);
    assert.equal(summary.length, 1);
    assert.equal((summary[0][1] as unknown[]).length, 18);
    assert.deepEqual(sleeps, [3000]);
  });
});

describe('Ordinarius', () => {
  it('is off: its robots.txt Crawl-delay of 30 seconds cannot fit a complete crawl in the nightly job', () => {
    assert.equal(config('ordinarius').active, false);
  });
});
