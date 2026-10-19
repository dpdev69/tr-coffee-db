import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DataPage from '../src/app/veri/page';
import { CatalogNumbers, datasetJsonLd } from '../src/components/v2/catalog-numbers';
import { coffeeSides } from '../src/components/v2/comparison-links';
import { webPage } from '../src/components/layout/json-ld';
import { MIN_SIZE_COFFEES, STATS_JSON_PATH, bagSize, computeCatalogStats, statsDescription, statsFigures, statsJson, statsTitle, summariseBags, type CatalogStats } from '../src/lib/catalog-stats';
import { COMPARISONS, comparisonDescription, comparisonsFor } from '../src/lib/comparisons';
import { canonicalQuery } from '../src/lib/canonical-address';
import { pageMetadata } from '../src/lib/page-metadata';
import { catalogSitemap, staticSitemap } from '../src/lib/sitemap-entries';
import { absoluteUrl } from '../src/lib/site';
import { guard, type GuardEnv } from '../workers/miss-guard';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { CatalogCoffee } from '../shared/v2/catalog';
import type { CrawlInput, SourceCoffee, SourceOffer } from '../shared/v2/types';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

/** Every way a page could quote a price per 100 g (owner decision: none, anywhere). A bag size such as "100 g paket" is not one. */
const PER_100G = /100\s?g(?:r|ram)?\s?(?:fiyat|başına)|\/\s?100\s?g|başına\s?100|birim fiyat|price_?per_?100|unit_?price|per\s?100\s?g/i;

const pack = (id: string, weightG: number, price: number, inStock: boolean | null = true): SourceOffer => ({ sourceVariantId: `sku-${id}-${weightG}`, label: `${weightG}g`, weightG, price, compareAtPrice: null, currency: 'TRY', inStock, purchaseUrl: `https://shop.test/${id}/${weightG}` });
const product = (id: string, rawMetadata: SourceCoffee['rawMetadata'], offers: SourceOffer[]): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Kahve ${id}`, visibility: 'public', rawMetadata, offers });
const day = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
const run = (d: number, products: SourceCoffee[], mode: CrawlInput['mode']): CrawlInput => ({ id: `run-${d}`, roasterId: 'k', startedAt: day(d), completedAt: new Date(Date.UTC(2026, 9, d, 0, 1)).toISOString(), status: 'success', mode, parserVersion: 'p1', products, diagnostics: [] });
const NOW = Date.UTC(2026, 9, 12, 12);

/** Day 10: the roaster's first crawl (a baseline: nothing in it is "new"). Day 11: one coffee arrives and one 250 g price drops. */
async function catalogDb() {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'k', slug: 'kronotrop', name: 'Kronotrop', websiteUrl: 'https://shop.test', city: 'İstanbul', adapter: 'test' });
  const shelf = (aPrice: number) => [
    product('a', { country: 'Ethiopia', process: 'natural' }, [pack('a', 250, aPrice), pack('a', 1000, 2500)]),
    product('b', { country: 'Ethiopia', process: 'washed' }, [pack('b', 250, 600)]),
    product('c', { country: 'Colombia', process: 'washed' }, [pack('c', 250, 650), pack('c', 1000, 2000)]),
    product('d', { country: 'Colombia', process: 'natural' }, [pack('d', 250, 900)]),
    product('e', { country: 'Kenya', process: 'washed' }, [pack('e', 250, 1000)]),
    product('f', { country: 'Brazil' }, [pack('f', 250, 500)]),
    // Sold out: not listed, so in no count and no price.
    product('h', { country: 'Peru', process: 'washed' }, [pack('h', 250, 300, false)]),
  ];
  await ingestCrawl(db, run(10, shelf(800), 'baseline'));
  await ingestCrawl(db, run(11, [...shelf(700), product('g', { country: 'Colombia', process: 'washed' }, [pack('g', 250, 750)])], 'live'));
  return db;
}

test('the catalog numbers count what the catalog lists, with the /yeni and /firsatlar rules and package prices per bag size', async () => {
  const db = await catalogDb();
  const stats = await computeCatalogStats(db, NOW);
  assert.deepEqual([stats.coffees, stats.roasters, stats.packages], [7, 1, 9], 'seven listed coffees, nine in-stock packages');
  assert.equal(stats.refreshedAt, day(11), 'the newest successful crawl');
  assert.deepEqual(stats.origins.map(item => [item.label, item.coffees, item.path]), [['Kolombiya', 3, '/kahveler/koken/kolombiya'], ['Etiyopya', 2, '/kahveler/koken/etiyopya'], ['Brezilya', 1, '/kahveler/koken/brezilya'], ['Kenya', 1, '/kahveler/koken/kenya']]);
  assert.deepEqual(stats.processes.map(item => [item.label, item.coffees]), [['Yıkanmış', 4], ['Natürel', 2]]);
  assert.deepEqual(stats.newArrivals, { days: 30, coffees: 1 }, 'the day-11 coffee is a genuine arrival; the baseline is not');
  assert.deepEqual(stats.priceDrops, { days: 7, coffees: 1 });
  assert.deepEqual(stats.bagPrices, [{ weightG: 250, coffees: 7, min: 500, median: 700, max: 1000 }], `1 kg is sold by fewer than ${MIN_SIZE_COFFEES} coffees; the sold-out 300 TL bag is left out`);
  db.sqlite.close();
});

test('bag prices are summarised per bag size, never mixed across sizes or turned into a unit price', () => {
  const rows: Array<Array<[number, number]>> = [[[250, 400], [1000, 1200]], [[250, 600]], [[250, 500], [1000, 1500]], [[250, 700]], [[250, 900], [1000, 1300]]];
  assert.deepEqual(summariseBags(rows), [{ weightG: 250, coffees: 5, min: 400, median: 600, max: 900 }]);
  assert.deepEqual(summariseBags(rows, 3), [{ weightG: 250, coffees: 5, min: 400, median: 600, max: 900 }, { weightG: 1000, coffees: 3, min: 1200, median: 1300, max: 1500 }]);
  assert.deepEqual(summariseBags([[[250, 500]], [[250, 601]]], 2)[0].median, 551, 'an even count takes the middle two, rounded');
  assert.deepEqual([bagSize(250), bagSize(1000), bagSize(1500)], ['250 g', '1 kg', '1,5 kg']);
});

const STATS: CatalogStats = {
  at: '2026-10-19T00:20:00.000Z', refreshedAt: '2026-10-19T00:02:00.000Z', coffees: 1234, roasters: 42, packages: 2345,
  origins: [{ value: 'Ethiopia', label: 'Etiyopya', path: '/kahveler/koken/etiyopya', coffees: 300, roasters: 30 }, { value: 'Colombia', label: 'Kolombiya', path: '/kahveler/koken/kolombiya', coffees: 250, roasters: 28 }],
  processes: [{ value: 'washed', label: 'Yıkanmış', path: '/kahveler/islem/yikanmis', coffees: 600, roasters: 40 }],
  newArrivals: { days: 30, coffees: 15 }, priceDrops: { days: 7, coffees: 4 },
  bagPrices: [{ weightG: 100, coffees: 6, min: 250, median: 300, max: 420 }, { weightG: 250, coffees: 400, min: 380, median: 690.5, max: 2400 }, { weightG: 1000, coffees: 90, min: 1500, median: 2600, max: 7000 }],
};

test('every figure is a dated sentence that can be quoted as it stands', () => {
  const figures = statsFigures(STATS);
  assert.deepEqual(figures.map(figure => figure.id), ['katalog', 'koken', 'islem', 'yeni', 'dusus', 'paket-100', 'paket-250', 'paket-1000']);
  for (const figure of figures) assert.match(figure.sentence, /^19 Ekim 2026 itibarıyla /, figure.id);
  assert.equal(figures[0].sentence, '19 Ekim 2026 itibarıyla KahveDrop kataloğunda 42 bağımsız kavurucudan 1.234 nitelikli kahve ve 2.345 paket satışta.');
  assert.match(figures.find(figure => figure.id === 'paket-250')!.sentence, /250 g paketi olan 400 kahvenin paket fiyatı 380 TL ile 2\.400 TL arasında, ortancası 690,5 TL\.$/);
  assert.doesNotMatch(figures.map(figure => figure.sentence).join('\n'), PER_100G);
});

test('the numbers page credits every figure, states the licence, offers the JSON copy and a link to paste, and quotes no unit price', () => {
  const html = renderToStaticMarkup(createElement(CatalogNumbers, { stats: STATS }));
  for (const figure of statsFigures(STATS)) assert.ok(html.includes(figure.sentence), figure.id);
  assert.equal(html.match(/Kaynak: KahveDrop · <a[^>]*rel="license"[^>]*>CC BY 4\.0<\/a>/g)?.length, statsFigures(STATS).length + 3, 'each figure, the price table and both split tables');
  assert.match(html, /Son güncelleme: <time datetime="2026-10-19T00:02:00.000Z">19 Ekim 2026<\/time>/i);
  assert.ok(html.includes(`href="${STATS_JSON_PATH}"`));
  assert.ok(html.includes(`&lt;a href=&quot;${absoluteUrl('/veri')}&quot;&gt;Kaynak: KahveDrop&lt;/a&gt; (CC BY 4.0)`), 'the copy-paste link');
  assert.match(html, /href="\/kahveler\/koken\/etiyopya"/);
  assert.match(html, /href="\/karsilastir\/etiyopya-vs-kolombiya"/);
  assert.doesNotMatch(html, PER_100G);
  const dataset = datasetJsonLd(STATS);
  assert.equal(dataset['@type'], 'Dataset');
  assert.equal(dataset.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(dataset.dateModified, STATS.refreshedAt);
  assert.equal(dataset.publisher.parentOrganization['@id'], 'https://hellobasalt.dev/#org');
  assert.deepEqual(dataset.distribution, [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: absoluteUrl(STATS_JSON_PATH) }]);
  assert.ok(dataset.description.length >= 50);
});

test('the open JSON copy holds the same numbers with credit, licence and dates, and no unit price', () => {
  const json = statsJson(STATS);
  assert.equal(json.schemaVersion, 1);
  assert.deepEqual([json.source, json.license, json.asOf], ['KahveDrop', 'CC BY 4.0', '2026-10-19']);
  assert.equal(json.attribution, `Kaynak: KahveDrop (${absoluteUrl('/veri')})`);
  assert.deepEqual(json.catalog, { coffees: 1234, roasters: 42, packages: 2345 });
  assert.deepEqual(json.bagPrices[1], { weightG: 250, coffees: 400, minTRY: 380, medianTRY: 690.5, maxTRY: 2400 });
  assert.deepEqual(json.origins[0], { name: 'Etiyopya', country: 'Ethiopia', coffees: 300, roasters: 30, url: absoluteUrl('/kahveler/koken/etiyopya') });
  assert.doesNotMatch(JSON.stringify(json), PER_100G);
});

test('the numbers page fits a search result and shows an outage notice, not zeros, when the catalog cannot be read', async () => {
  const meta = pageMetadata(statsTitle(STATS), statsDescription(STATS), '/veri');
  assert.equal(meta.title, 'Kahve kataloğu rakamları · Ekim 2026');
  assert.ok(`${meta.title} | KahveDrop`.length <= 60);
  for (const stats of [STATS, { ...STATS, coffees: 99999, roasters: 9999, refreshedAt: '2026-08-15T00:00:00.000Z' }, null]) assert.ok(statsDescription(stats).length <= 155, statsDescription(stats));
  const html = renderToStaticMarkup(await DataPage());
  assert.match(html, /role="alert"/);
  assert.match(html, /Rakamlar şu an yüklenemiyor/);
  assert.doesNotMatch(html, /\b0 kahve|itibarıyla/);
});

test('the numbers page and its JSON copy have one address each, are counted as single pages, and answer refusals in their own format', async () => {
  const canonical = (address: string) => { const url = new URL(address, 'https://kahvedrop.test'); return canonicalQuery(url.pathname, url.searchParams); };
  assert.equal(canonical('/veri?utm_source=x&ay=2026-10'), '');
  assert.equal(canonical(`${STATS_JSON_PATH}?fbclid=y`), '');
  const keys: string[] = [];
  const env: GuardEnv = { PAGE_LIMITER: { async limit({ key }: { key: string }) { keys.push(key); return { success: false }; } } };
  const request = (path: string) => new Request(`https://kahvedrop.test${path}`, { headers: { 'cf-connecting-ip': '203.0.113.9' } });
  const page = await guard(request('/veri'), env, { waitUntil() {} }) as Response;
  assert.equal(page.status, 429);
  assert.match(await page.text(), /<html lang="tr">/);
  const json = await guard(request(STATS_JSON_PATH), env, { waitUntil() {} }) as Response;
  assert.equal(json.status, 429);
  assert.match((await json.json() as { error: string }).error, /yavaşlayalım/);
  assert.equal(keys.length, 2);
});

test('the nightly warm-up builds the numbers, the edge keeps the page, and the sitemap and llms.txt list it', async () => {
  const warm = readFileSync('scripts/warm-cache.mts', 'utf8');
  assert.match(warm, /warm\('\/veri', html\)/);
  assert.match(warm, /warm\('\/veri\/v1\/ozet\.json', \{\}\)/);
  assert.match(warm, /'catalog-stats'\]/);
  assert.match(readFileSync('next.config.ts', 'utf8'), /"\/veri"\]/);
  const route = readFileSync('src/app/veri/v1/ozet.json/route.ts', 'utf8');
  assert.match(route, /EDGE_CACHE_HEADERS/);
  assert.doesNotMatch(route, /prepare\(/, 'the JSON copy reads only the derived result');
  const llms = readFileSync('public/llms.txt', 'utf8');
  for (const path of ['/veri)', '/veri/v1/ozet.json)', '/karsilastir)']) assert.ok(llms.includes(path), path);
  assert.ok(staticSitemap().some(entry => entry.url === absoluteUrl('/veri')));
  const db = await catalogDb();
  const entries = await catalogSitemap(db);
  const at = (path: string) => entries.find(entry => entry.url === absoluteUrl(path))?.lastModified;
  assert.ok(at('/veri') instanceof Date, 'the numbers page changes with the catalog');
  assert.ok(at('/kahveler/koken/kolombiya') instanceof Date, 'so do landing pages');
  assert.deepEqual(at('/guide'), new Date('2026-10-19'), 'the guide carries the date its copy changed');
  db.sqlite.close();
});

test('comparison descriptions fit a search result for every pair, even with four-digit counts', () => {
  for (const item of COMPARISONS) for (const counts of [[9999, 9999] as [number, number], null]) {
    const description = comparisonDescription(item, counts);
    assert.ok(description.length <= 155, `${item.slug}: ${description.length}`);
    assert.doesNotMatch(description, PER_100G);
  }
});

test('catalog pages are published by KahveDrop under the shared Basalt node, with the date their data last changed', () => {
  const page = webPage('Etiyopya kahve çekirdekleri', 'd', '/kahveler/koken/etiyopya', { type: 'CollectionPage', dateModified: '2026-10-19T00:02:00.000Z' });
  assert.equal(page['@type'], 'CollectionPage');
  assert.equal(page.dateModified, '2026-10-19T00:02:00.000Z');
  assert.equal(page.publisher.name, 'KahveDrop');
  assert.equal(page.publisher.parentOrganization['@id'], 'https://hellobasalt.dev/#org');
  assert.equal('dateModified' in webPage('Bülten', 'd', '/bulten'), false, 'no date when none is known');
  for (const [path, marker] of [['src/app/kahveler/[facet]/[slug]/page.tsx', /dateModified: refreshedAt/], ['src/app/karsilastir/page.tsx', /dateModified: data\?\.at/], ['src/app/karsilastir/[pair]/page.tsx', /dateModified: data\.at/], ['src/app/guide/page.tsx', /dateModified: GUIDE_UPDATED/]] as const) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, marker, path);
    assert.match(source, /Son güncelleme/, path);
  }
});

test('a coffee page links to the comparisons its own origin, process and roaster are a side of', () => {
  const coffee = (rawMetadata: CatalogCoffee['rawMetadata'], features: CatalogCoffee['features'] = [], roaster = 'kronotrop') => ({ roaster: { slug: roaster }, rawMetadata, features } as unknown as CatalogCoffee);
  const slugs = (value: CatalogCoffee) => comparisonsFor(coffeeSides(value)).map(item => item.slug);
  assert.deepEqual(slugs(coffee({ country: 'Kenya', process: 'natural' })), ['kenya-vs-kolombiya', 'kenya-vs-etiyopya', 'naturel-vs-yikanmis', 'kronotrop-vs-petra', 'kronotrop-vs-montag']);
  // The roaster's own statement wins over an inferred fact, as on the page.
  const inferred = [{ feature: 'normalized_origin', value: 'Ethiopia', sourceType: 'RULE_INFERRED', confidence: 0.6, version: 'v', sourceReference: null }] as CatalogCoffee['features'];
  assert.deepEqual(slugs(coffee({ country: 'Peru' }, inferred, 'parsa')), []);
  assert.deepEqual(slugs(coffee({}, inferred, 'parsa')), ['etiyopya-vs-kolombiya', 'kenya-vs-etiyopya']);
  assert.ok(readFileSync('src/app/kahve/[slug]/page.tsx', 'utf8').includes('<ComparisonLinks side={coffeeSides(coffee)}'));
});

test('every comparison has three or more links in from the site and three or more out', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  // In: the index lists every pair, every pair page lists every other pair, and the home page and guide link pairs by slug.
  assert.match(read('src/app/karsilastir/page.tsx'), /COMPARISONS\.filter\(item => item\.group === group\)/);
  assert.match(read('src/app/karsilastir/[pair]/page.tsx'), /COMPARISONS\.filter\(other => other\.slug !== item\.slug\)/);
  assert.ok(COMPARISONS.length - 1 >= 2, 'with the index, three or more links in for every pair');
  for (const path of ['src/app/page.tsx', 'src/app/guide/page.tsx', 'src/components/v2/catalog-numbers.tsx']) assert.match(read(path), /\/karsilastir/, path);
  // Side pages: origin and process landings, roaster pages and coffee pages carry the "Karşılaştır" links.
  for (const path of ['src/app/kahveler/[facet]/[slug]/page.tsx', 'src/app/kavurucu/[slug]/page.tsx', 'src/app/kahve/[slug]/page.tsx']) assert.match(read(path), /<ComparisonLinks /, path);
  // The numbers page: in from home, guide, the comparison index and pages, landings and llms.txt.
  for (const path of ['src/app/page.tsx', 'src/app/guide/page.tsx', 'src/app/karsilastir/page.tsx', 'src/app/karsilastir/[pair]/page.tsx', 'src/app/kahveler/[facet]/[slug]/page.tsx']) assert.match(read(path), /href="\/veri"/, path);
});
