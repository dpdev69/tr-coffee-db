import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { coffeeMetadata, listingMetadata, catalogLanding, pageMetadata, roasterDescription, SITE_CARD } from '../src/lib/page-metadata';
import { JsonLd, productJsonLd } from '../src/components/layout/json-ld';
import { findLanding, listLandings, originLanding, processLanding } from '../src/lib/catalog-landing';
import { catalogSitemap } from '../src/lib/sitemap-entries';
import { absoluteUrl } from '../src/lib/site';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { CatalogCoffee, CatalogOffer } from '../shared/v2/catalog';
import type { CrawlInput, SourceCoffee } from '../shared/v2/types';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const offer: CatalogOffer = { id: 'o250', coffeeId: 'c', sourceVariantId: 'sku', label: '250 g', weightG: 250, currency: 'TRY', priceMinor: 95000, compareAtMinor: null, inStock: true, purchaseUrl: 'https://cdn.shopify.com/p', unitPriceTry: 380, firstSeenAt: '2026-09-01T00:00:00Z', lastSeenAt: '2026-10-01T00:00:00Z', lastPriceChangeAt: null, variantOfferIds: ['o250'] };
function coffee(override: Partial<CatalogCoffee> = {}): CatalogCoffee {
  return { id: 'c', name: 'Guji Hambela', slug: 'guji-hambela', canonicalUrl: 'https://shop.test/guji', sourceUrl: null, sourceProductId: 'p', roaster: { id: 'r', slug: 'parsa', name: 'Parsa', websiteUrl: 'https://shop.test', city: 'İstanbul' },
    rawMetadata: { country: 'Ethiopia', process: 'natural', roast: 'light', tastingNotes: ['yaban mersini', 'bergamot', 'kakao', 'şeftali'], imageUrl: 'https://cdn.shopify.com/guji.jpg' }, features: [], offers: [{ ...offer }], latestEvents: [],
    firstSeenAt: '2026-09-01T00:00:00Z', lastSeenAt: '2026-10-01T00:00:00Z', discontinuedAt: null, stale: false, ...override };
}

test('a full coffee is described from its own facts, with its image and the shown package price', () => {
  const meta = coffeeMetadata(coffee());
  assert.equal(meta.description, 'Parsa kavurucusundan Guji Hambela. Etiyopya kökenli, natürel işlemli ve açık kavrumlu. Tadım notları: yaban mersini, bergamot ve kakao. 250 g paketi 950 TL.');
  assert.equal(meta.title, 'Guji Hambela · Etiyopya · Parsa', 'the origin joins a title that does not name it');
  assert.deepEqual(meta.image, { url: 'https://cdn.shopify.com/guji.jpg', alt: 'Guji Hambela · Parsa' });
  assert.equal(coffeeMetadata(coffee({ name: 'Ethiopia Guji' })).title, 'Ethiopia Guji · Parsa', 'a name that already says the origin keeps it once');
});

test('a sparse coffee says only what is known, and nothing is invented to fill the gap', () => {
  const meta = coffeeMetadata(coffee({ name: 'Ev Harmanı', rawMetadata: { roast: 'filter, espresso', imageUrl: 'https://evil.test/x.jpg' }, offers: [] }));
  assert.equal(meta.description, 'Parsa kavurucusundan Ev Harmanı. Paketlerini incele, siparişini doğrudan kavurucudan ver.');
  assert.doesNotMatch(meta.description, /kökenli|işlemli|kavrumlu|Tadım|TL/);
  assert.equal(meta.title, 'Ev Harmanı · Parsa');
  assert.equal(meta.image, SITE_CARD, 'an image from a host the page cannot show falls back to the site card');
  const soldOut = coffeeMetadata(coffee({ rawMetadata: {}, offers: [{ ...offer, weightG: null, inStock: false }] }));
  assert.equal(soldOut.description, 'Parsa kavurucusundan Guji Hambela. Paket fiyatı 950 TL; şu an tükendi.');
});

test('quotes in a name are escaped once in the rendered head, never twice', () => {
  const meta = coffeeMetadata(coffee({ name: 'Liberica "Honey Mosto"' }));
  assert.match(meta.description, /Liberica "Honey Mosto"\./);
  const html = renderToStaticMarkup(createElement('meta', { name: 'description', content: meta.description }));
  assert.match(html, /Liberica &quot;Honey Mosto&quot;\./);
  assert.doesNotMatch(html, /&amp;quot;/);
});

test('product data carries only catalog fields: no rating, review or guessed stock', () => {
  const full = productJsonLd(coffee({ offers: [{ ...offer }, { ...offer, id: 'o1k', label: null, weightG: 1000, priceMinor: 300000, inStock: null }] }));
  assert.deepEqual(Object.keys(full).sort(), ['@type', 'brand', 'image', 'name', 'offers', 'url']);
  const offers = full.offers as Array<Record<string, unknown>>;
  assert.deepEqual(offers.map(item => [item.name, item.price, item.availability]), [['250 g', '950.00', 'https://schema.org/InStock'], ['1 kg', '3000.00', undefined]]);
  const sparse = productJsonLd(coffee({ rawMetadata: { imageUrl: 'https://evil.test/x.jpg' }, offers: [{ ...offer, priceMinor: null }] }));
  assert.deepEqual(Object.keys(sparse).sort(), ['@type', 'brand', 'name', 'url']);
  assert.doesNotMatch(JSON.stringify(full), /aggregateRating|review|ratingValue/i);
  const markup = renderToStaticMarkup(createElement(JsonLd, { data: productJsonLd(coffee({ name: '</script><b>' })) }));
  assert.doesNotMatch(markup, /<\/script><b>/);
  assert.equal(JSON.parse(markup.replace(/^<script[^>]*>|<\/script>$/g, '')).name, '</script><b>');
});

test('pages name their own share image and type; a long title drops the brand suffix', () => {
  const meta = pageMetadata('Guji', 'd', '/kahve/guji', { type: 'product', image: { url: 'https://cdn.shopify.com/g.jpg', alt: 'Guji' } });
  assert.equal((meta.openGraph as { type?: string }).type, 'product');
  assert.deepEqual(meta.openGraph?.images, [{ url: 'https://cdn.shopify.com/g.jpg', alt: 'Guji' }]);
  assert.deepEqual(meta.twitter?.images, [{ url: 'https://cdn.shopify.com/g.jpg', alt: 'Guji' }]);
  assert.deepEqual(pageMetadata('Kahveler', 'd', '/kahveler').openGraph?.images, [SITE_CARD]);
  assert.equal(pageMetadata('Kahveler', 'd', '/kahveler').title, 'Kahveler');
  const long = 'Santa Monica Jairo Arcila Cherry Cherry Lady · Coffee Department';
  assert.deepEqual(pageMetadata(long, 'd', '/x').title, { absolute: long });
});

test('catalog canonicals: plain pages index, one origin or process points at its landing page, every other combination stays out', () => {
  const meta = (params: Record<string, string | string[]>, path = '/kahveler') => { const m = listingMetadata('Kahveler', 'd', path, params, path === '/kahveler' ? catalogLanding : undefined); return { canonical: m.alternates?.canonical, robots: m.robots, title: m.title }; };
  assert.deepEqual(meta({}), { canonical: '/kahveler', robots: undefined, title: 'Kahveler' });
  assert.deepEqual(meta({ page: '2' }), { canonical: '/kahveler?page=2', robots: undefined, title: 'Kahveler · Sayfa 2' });
  // The filter form submits every field, most of them empty, and the default sort.
  assert.deepEqual(meta({ search: '', origin: 'Ethiopia', roaster: '', priceMin: '', sort: 'newest', utm_source: 'mektup' }), { canonical: '/kahveler/koken/etiyopya', robots: undefined, title: 'Kahveler' });
  assert.equal(meta({ origin: 'Etiyopya', page: '3' }).canonical, '/kahveler/koken/etiyopya?page=3');
  assert.equal(meta({ process: 'natural' }).canonical, '/kahveler/islem/naturel');
  for (const params of [{ sort: 'price_asc' }, { origin: ['Ethiopia', 'Kenya'] }, { origin: 'Ethiopia', taste: 'Fruity' }, { search: 'gesha' }, { roaster: 'parsa' }, { origin: 'Atlantis' }, { process: 'carbonic' }, { priceMax: '800', page: '2' }]) {
    assert.deepEqual(meta(params), { canonical: '/kahveler', robots: { index: false, follow: true }, title: 'Kahveler' }, JSON.stringify(params));
  }
  assert.deepEqual(meta({ event: 'RESTOCKED' }, '/yeni'), { canonical: '/yeni', robots: { index: false, follow: true }, title: 'Kahveler' });
  assert.deepEqual(meta({ page: '2', taste: 'Floral' }, '/kahveler/koken/etiyopya'), { canonical: '/kahveler/koken/etiyopya', robots: { index: false, follow: true }, title: 'Kahveler' });
  assert.equal(meta({ page: '2' }, '/kahveler/koken/etiyopya').canonical, '/kahveler/koken/etiyopya?page=2');
});

test('landing addresses round-trip and only the canonical spelling resolves', () => {
  assert.equal(originLanding('Etiyopya')?.path, '/kahveler/koken/etiyopya');
  assert.equal(originLanding('Costa Rica')?.path, '/kahveler/koken/kosta-rika');
  assert.equal(originLanding('Cuba')?.path, '/kahveler/koken/kuba');
  assert.equal(originLanding('Brazil Cerrado'), null, 'only whole countries from the translation table');
  assert.equal(processLanding('Natürel')?.path, '/kahveler/islem/naturel');
  assert.equal(processLanding('semi_washed')?.path, '/kahveler/islem/yari-yikanmis');
  assert.equal(processLanding('unknown'), null);
  assert.deepEqual(findLanding('koken', 'kosta-rika')?.filters, { origin: ['Costa Rica'] });
  assert.deepEqual(findLanding('islem', 'yikanmis')?.filters, { process: ['washed'] });
  for (const [facet, slug] of [['koken', 'ethiopia'], ['koken', 'Etiyopya'], ['islem', 'natural'], ['bolge', 'etiyopya'], ['koken', 'atlantis']]) assert.equal(findLanding(facet, slug), null, `${facet}/${slug}`);
});

const pack = (id: string, inStock: boolean | null = true) => ({ sourceVariantId: `sku-${id}`, label: '250g', weightG: 250, price: 500, compareAtPrice: null, currency: 'TRY', inStock, purchaseUrl: `https://shop.test/${id}` });
const product = (id: string, rawMetadata: SourceCoffee['rawMetadata'], override: Partial<SourceCoffee> = {}): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Kahve ${id}`, visibility: 'public', rawMetadata, offers: [pack(id)], ...override });
const crawl = (roasterId: string, products: SourceCoffee[]): CrawlInput => ({ id: `run-${roasterId}`, roasterId, startedAt: '2026-10-01T00:00:00.000Z', completedAt: '2026-10-01T00:01:00.000Z', status: 'success', parserVersion: 'test', products, diagnostics: [] });
async function catalogDb() {
  const db = new TestCatalogDatabase();
  for (const id of ['live', 'gone', 'empty']) await registerRoaster(db, { id, slug: id, name: `Kavurucu ${id}`, websiteUrl: 'https://shop.test', adapter: 'test' });
  await ingestCrawl(db, crawl('live', [product('parent', { country: 'Ethiopia', process: 'natural' }), product('child', { country: 'Ethiopia' }), product('kenya', { country: 'Kenya', process: 'washed' }), product('hidden', { country: 'Kenya' }, { visibility: 'hidden' }), product('soldout', { country: 'Peru' }, { offers: [pack('soldout', false)] })]));
  await ingestCrawl(db, crawl('gone', [product('inactive', { country: 'Ethiopia' })]));
  await ingestCrawl(db, crawl('empty', [product('only-soldout', { country: 'Ethiopia' }, { offers: [pack('only-soldout', false)] })]));
  // A grouped size twin points at its parent; a deactivated roaster leaves the catalog.
  db.sqlite.exec("UPDATE coffees SET canonical_coffee_id=(SELECT id FROM coffees WHERE source_product_id='parent') WHERE source_product_id='child'");
  db.sqlite.exec("UPDATE roasters SET active=0 WHERE id='gone'");
  const slug = (source: string) => String(db.sqlite.prepare('SELECT slug FROM coffees WHERE source_product_id=?').get(source)?.slug);
  return { db, slug };
}

test('the sitemap lists listed coffees and listed roasters only, plus landing pages with coffees', async () => {
  const { db, slug } = await catalogDb();
  const urls = (await catalogSitemap(db)).map(entry => entry.url.replace(absoluteUrl('/'), '/'));
  assert.deepEqual(urls.filter(url => url.startsWith('/kahve/')).sort(), [`/kahve/${slug('kenya')}`, `/kahve/${slug('parent')}`].sort(), 'no grouped child, hidden, sold-out or inactive-roaster coffee');
  assert.deepEqual(urls.filter(url => url.startsWith('/kavurucu/')), ['/kavurucu/live'], 'an inactive roaster and one with nothing listed are left out');
  assert.deepEqual(urls.filter(url => url.startsWith('/kahveler/')).sort(), ['/kahveler/islem/naturel', '/kahveler/islem/yikanmis', '/kahveler/koken/etiyopya', '/kahveler/koken/kenya']);
  assert.ok(urls.includes('/') && urls.includes('/kahveler'));
  assert.equal(new Set(urls).size, urls.length);
});

test('landing facts and roaster copy come from the same catalog counts the pages show', async () => {
  const { db } = await catalogDb();
  const landings = await listLandings(db);
  assert.deepEqual(landings.map(item => [item.path, item.coffees, item.roasters]), [['/kahveler/koken/etiyopya', 1, 1], ['/kahveler/koken/kenya', 1, 1], ['/kahveler/islem/yikanmis', 1, 1], ['/kahveler/islem/naturel', 1, 1]]);
  assert.equal(roasterDescription({ name: 'Parsa', city: 'İstanbul', coffeeCount: 0 }, []), 'Parsa (İstanbul) kavurucusunun şu an satışta doğrulanmış bir kahvesi yok. Yeniden satışa çıkan kahveleri bu sayfada gösteriyoruz.');
  const shown = [coffee(), coffee({ id: 'b' }), coffee({ id: 'k', rawMetadata: { country: 'Kenya' } }), coffee({ id: 'x', rawMetadata: {} })];
  assert.equal(roasterDescription({ name: 'Parsa', city: null, coffeeCount: 12 }, shown), 'Parsa kavurucusunun satıştaki 12 kahvesi; kökenler arasında Etiyopya ve Kenya var. Paketlerini ve fiyatlarını incele, siparişini doğrudan kavurucudan ver.');
});
