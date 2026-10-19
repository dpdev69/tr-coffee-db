import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPARISONS, comparisonFacts, comparisonQuestion, comparisonTitle, comparisonsFor, findComparison, indexable, questionParticle, SHOWN, sideHref, sideKey } from '../src/lib/comparisons';
import { canonicalQuery } from '../src/lib/canonical-address';
import { catalogSitemap } from '../src/lib/sitemap-entries';
import { absoluteUrl } from '../src/lib/site';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { CrawlInput, SourceCoffee, SourceOffer } from '../shared/v2/types';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

test('the comparison list is fixed, each address is clean and each side links to a page that exists', () => {
  assert.equal(new Set(COMPARISONS.map(item => item.slug)).size, COMPARISONS.length);
  for (const item of COMPARISONS) {
    assert.match(item.slug, /^[a-z]+-vs-[a-z]+$/, item.slug);
    assert.equal(findComparison(item.slug), item);
    for (const side of [item.a, item.b]) assert.match(sideHref(side), /^\/(?:kavurucu\/[a-z-]+|kahveler\/(?:koken|islem)\/[a-z-]+|kahveler\?brewMethod=(?:espresso|filter))$/, sideKey(side));
    assert.ok(comparisonTitle(item).length <= 60, comparisonTitle(item));
  }
  for (const slug of ['petra-vs-kronotrop', 'etiyopya-vs-atlantis', 'ETIYOPYA-vs-kolombiya', '']) assert.equal(findComparison(slug), null, slug);
});

test('questions follow Turkish vowel harmony', () => {
  assert.deepEqual(['Kolombiya', 'Natürel', 'Kronotrop', 'Espresso', 'Yıkanmış', 'Filtre', 'Türk', 'Göz'].map(questionParticle), ['mı', 'mi', 'mu', 'mu', 'mı', 'mi', 'mü', 'mü']);
  assert.equal(comparisonQuestion(findComparison('etiyopya-vs-kolombiya')!), 'Etiyopya mı, Kolombiya mı?');
  assert.equal(comparisonQuestion(findComparison('naturel-vs-yikanmis')!), 'Natürel mi, Yıkanmış mı?');
  assert.equal(comparisonQuestion(findComparison('kronotrop-vs-petra')!), 'Kronotrop mu, Petra mı?');
  assert.equal(comparisonTitle(findComparison('espresso-vs-filtre')!), 'Espresso mu filtre mi? Çekirdek karşılaştırması');
});

test('roaster, origin and process pages link only to comparisons they are a side of', () => {
  assert.deepEqual(comparisonsFor({ roaster: 'kronotrop' }).map(item => item.slug), ['kronotrop-vs-petra', 'kronotrop-vs-montag']);
  assert.deepEqual(comparisonsFor({ origin: 'Etiyopya' }).map(item => item.slug), ['etiyopya-vs-kolombiya', 'kenya-vs-etiyopya']);
  assert.deepEqual(comparisonsFor({ process: 'natural' }).map(item => item.slug), ['naturel-vs-yikanmis']);
  assert.deepEqual(comparisonsFor({ roaster: 'coffeerem' }), []);
});

test('comparison addresses take no query, so tracking tags cannot split the edge cache', () => {
  const canonical = (address: string) => { const url = new URL(address, 'https://kahvedrop.test'); return canonicalQuery(url.pathname, url.searchParams); };
  assert.equal(canonical('/karsilastir?utm_source=x'), '');
  assert.equal(canonical('/karsilastir/etiyopya-vs-kolombiya?coffee=a&page=2'), '');
});

const pack = (id: string, weightG: number, price: number, inStock: boolean | null = true): SourceOffer => ({ sourceVariantId: `sku-${id}-${weightG}-${price}`, label: `${weightG}g`, weightG, price, compareAtPrice: null, currency: 'TRY', inStock, purchaseUrl: `https://shop.test/${id}/${weightG}` });
const product = (id: string, rawMetadata: SourceCoffee['rawMetadata'], offers: SourceOffer[]): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Kahve ${id}`, visibility: 'public', rawMetadata: { description: 'Uzun açıklama', ...rawMetadata }, offers });
const crawl = (roasterId: string, products: SourceCoffee[]): CrawlInput => ({ id: `run-${roasterId}`, roasterId, startedAt: '2026-10-01T00:00:00.000Z', completedAt: '2026-10-01T00:01:00.000Z', status: 'success', parserVersion: 'test', products, diagnostics: [] });
async function catalogDb() {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'k', slug: 'kronotrop', name: 'Kronotrop', websiteUrl: 'https://shop.test', city: 'İstanbul', adapter: 'test' });
  await registerRoaster(db, { id: 'p', slug: 'petra', name: 'Petra Coffee', websiteUrl: 'https://shop.test', city: 'İstanbul', adapter: 'test' });
  await ingestCrawl(db, crawl('k', [
    product('k1', { country: 'Ethiopia', process: 'natural' }, [pack('k1', 250, 800), pack('k1', 1000, 2500)]),
    product('k2', { country: 'Colombia', process: 'washed' }, [pack('k2', 250, 600)]),
    // 1 kg only: counted as a coffee, never in the 250 g prices.
    product('k3', { country: 'Ethiopia', process: 'washed' }, [pack('k3', 1000, 2000)]),
  ]));
  await ingestCrawl(db, crawl('p', [
    product('p1', { country: 'Colombia', process: 'natural' }, [pack('p1', 250, 700), pack('p1', 250, 650, false)]),
    product('p2', { country: 'Brazil', process: 'natural' }, [pack('p2', 250, 500)]),
    product('p3', { country: 'Colombia' }, [pack('p3', 250, 900)]),
    product('p4', { country: 'Kenya', process: 'washed' }, [pack('p4', 250, 1000)]),
  ]));
  return db;
}

test('comparison facts count the catalog the cards show, and price only in-stock 250 g packages', async () => {
  const data = await comparisonFacts(await catalogDb());
  const k = data.sides['roaster:kronotrop'], p = data.sides['roaster:petra'];
  assert.equal(k.coffees, 3);
  assert.equal(k.city, 'İstanbul');
  assert.deepEqual(k.price250, { coffees: 2, min: 600, median: 700, max: 800 }, 'the 1 kg packages are left out');
  assert.deepEqual(p.price250, { coffees: 4, min: 500, median: 800, max: 1000 }, 'the sold-out 650 TL package is left out');
  assert.equal(p.cheapest250?.price, 500);
  assert.deepEqual(k.origins.map(share => [share.label, share.count]), [['Etiyopya', 2], ['Kolombiya', 1]]);
  assert.deepEqual(p.processes.map(share => [share.label, share.count]), [['Natürel', 2], ['Yıkanmış', 1]]);
  assert.equal(p.stated.process, 3, 'one coffee states no process');
  const colombia = data.sides['origin:Colombia'];
  assert.equal(colombia.coffees, 3);
  assert.equal(colombia.roasters, 2);
  assert.equal(data.sides['process:natural'].coffees, 3);
  assert.ok(p.shown.length <= SHOWN);
  assert.equal(p.shown[0].rawMetadata.description, undefined, 'the stored cards drop the long fields');
  assert.ok(indexable(data, findComparison('kronotrop-vs-petra')!));
  assert.ok(!indexable(data, findComparison('kronotrop-vs-montag')!), 'Montag has no coffees here');
  assert.ok(!indexable(data, findComparison('kenya-vs-etiyopya')!), 'one Kenya coffee is too few');
});

test('the sitemap lists the comparison index and only the comparisons with enough coffees on both sides', async () => {
  const urls = (await catalogSitemap(await catalogDb())).map(entry => entry.url.replace(absoluteUrl('/'), '/'));
  assert.deepEqual(urls.filter(url => url.startsWith('/karsilastir')).sort(), ['/karsilastir', '/karsilastir/kronotrop-vs-petra', '/karsilastir/naturel-vs-yikanmis'], 'two Ethiopian coffees are too few for etiyopya-vs-kolombiya');
});
