import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogDatabase } from '../shared/v2/database';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { catalogFactsMany, getRoasterDetail, listCatalog, listIndex, type CatalogFilters } from '../shared/v2/catalog';
import type { CrawlInput, SourceCoffee } from '../shared/v2/types';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

/** The Worker's database: derived results computed once and read back as stored JSON. Counts what it runs. */
function derivedDb(db: TestCatalogDatabase) {
  const memo = new Map<string, Promise<unknown>>();
  const statements: string[] = [];
  const derived: CatalogDatabase = {
    prepare: sql => { statements.push(sql); return db.prepare(sql); },
    batch: list => db.batch(list),
    derive: <T>(name: string, compute: () => Promise<T>) => {
      if (!memo.has(name)) memo.set(name, compute().then(value => JSON.parse(JSON.stringify(value))));
      return memo.get(name) as Promise<T>;
    },
  };
  return { db: derived, statements };
}

type Offer = SourceCoffee['offers'][number];
const offer = (id: string, price: number | null, override: Partial<Offer> = {}): Offer => ({ sourceVariantId: id, label: '250g', weightG: 250, price, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${id}`, ...override });
const coffee = (id: string, rawMetadata: SourceCoffee['rawMetadata'], offers: Offer[], features: SourceCoffee['features'] = []): SourceCoffee =>
  ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Coffee ${id}`, visibility: 'public', rawMetadata, features, offers });
const run = (roasterId: string, day: number, products: SourceCoffee[], mode?: CrawlInput['mode']): CrawlInput =>
  ({ id: `${roasterId}-run${day}`, roasterId, startedAt: `2026-01-0${day}T00:00:00.000Z`, completedAt: `2026-01-0${day}T00:01:00.000Z`, status: 'success', parserVersion: 'test', products, diagnostics: [], ...(mode ? { mode } : {}) });
const inferred = (feature: string, value: unknown) => ({ feature, value: value as never, sourceType: 'RULE_INFERRED' as const, confidence: null, version: '1' });

async function catalog() {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'r1', slug: 'alpha', name: 'Alpha', websiteUrl: 'https://shop.test', adapter: 'test' });
  await registerRoaster(db, { id: 'r2', slug: 'beta', name: 'Beta', websiteUrl: 'https://shop.test', adapter: 'test' });
  const first = [
    coffee('a', { country: 'Ethiopia', process: 'washed', roast: 'light', tastingNotes: ['Bergamot'] }, [offer('a1', 900), offer('a2', 3200, { weightG: 1000 })], [inferred('flavor_categories', ['Floral', 'Fruity'])]),
    coffee('b', { country: ['Colombia', 'Brazil'], process: 'natural' }, [offer('b1', 650)], [inferred('brew_methods', ['filter', 'espresso'])]),
    // A reviewed MANUAL origin replaces the raw one: Kenya, not Ethiopia.
    coffee('c', { country: 'Ethiopia', roast: 'dark' }, [offer('c1', 650)], [inferred('normalized_origin', 'Ethiopia')]),
    // No TRY price in stock: last in price sorts, out of every price filter.
    coffee('d', { country: 'Etiyopya', process: 'honey' }, [offer('d1', 700, { currency: 'USD' }), offer('d2', 400, { inStock: false })]),
    coffee('e', { country: 'Brazil', process: 'natural', roast: 'medium_dark' }, [offer('e1', 650, { weightG: null })], [inferred('normalized_origin', ['Brazil', 12, null]), inferred('process', { unmatched: 'washed' })]),
  ];
  await ingestCrawl(db, run('r1', 1, first, 'baseline'));
  // Day 2: e sells out; day 3: e is back (RESTOCKED) and a is cheaper (PRICE_DROP).
  const day2 = first.map(item => item.sourceProductId === 'e' ? { ...item, offers: item.offers.map(o => ({ ...o, inStock: false })) } : item);
  const day3 = first.map(item => item.sourceProductId === 'a' ? { ...item, offers: item.offers.map(o => o.sourceVariantId === 'a1' ? { ...o, price: 800, compareAtPrice: 900 } : o) } : item);
  await ingestCrawl(db, run('r1', 2, [...day2, coffee('f', { country: 'Kenya', process: 'washed', tastingNotes: ['Fruity'] }, [offer('f1', 1200)])]));
  await ingestCrawl(db, run('r1', 3, [...day3, coffee('f', { country: 'Kenya', process: 'washed', tastingNotes: ['Fruity'] }, [offer('f1', 1200)]), coffee('g', { country: 'Colombia', process: 'washed' }, [offer('g1', 650), offer('g2', 1500, { weightG: 500 })])]));
  await ingestCrawl(db, run('r2', 3, [coffee('h', { country: 'Ethiopia', process: 'natural', tastingNotes: ['Fruity', 'Chocolate'] }, [offer('h1', 850)], [inferred('brew_compatibility', 'filter')]),
    coffee('i', {}, [offer('i1', 500)]), coffee('j', { country: 'Colombia' }, [offer('j1', 650)])], 'baseline'));
  // A reviewed correction (applyCorrections writes these): MANUAL origin and roast on c.
  for (const [feature, value] of [['origin_country', '"Kenya"'], ['roast_level', '["medium"]']])
    db.sqlite.prepare("INSERT INTO coffee_feature_values(coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at) SELECT id,?,?,'MANUAL',NULL,'1',NULL,'2026-01-04','2026-01-04' FROM coffees WHERE source_product_id='c'").run(feature, value);
  return db;
}

const FILTERS: CatalogFilters[] = [{}, { origin: ['Ethiopia'] }, { origin: ['Etiyopya'] }, { origin: [' Kenya ', ''] }, { origin: ['Colombia', 'Brazil'] }, { origin: ['Atlantis'] }, { origin: ['["Colombia","Brazil"]'] },
  { process: ['washed'] }, { process: ['natural', 'honey'] }, { roast: ['light', 'dark'] }, { roast: ['medium'] }, { origin: ['Kenya'], roast: ['dark'] }, { taste: ['Fruity'] }, { taste: ['Floral'], process: ['washed'] }, { brewMethod: ['filter'] },
  { roaster: ['beta'] }, { roaster: ['alpha'], origin: ['Ethiopia'] }, { roaster: ['nobody'] }, { priceMin: 650 }, { priceMax: 650 }, { priceMin: 600, priceMax: 900 }, { priceMin: -5 }, { origin: [] },
  ...(['NEW', 'PRICE_DROP', 'RESTOCKED', 'DEAL', 'OUT_OF_STOCK'] as const).flatMap(event => [{ event }, { event, since: '2026-01-02T12:00:00.000Z' }, { event, since: '2026-01-03T00:00:00.000Z' }, { event, since: 'not a date' }, { event, since: '2027-01-01T00:00:00Z', origin: ['Kenya'] }])];

test('the list index answers every closed filter, sort and page exactly as the list query', async () => {
  const db = await catalog();
  const { db: derived } = derivedDb(db);
  let compared = 0;
  for (const filters of FILTERS) for (const sort of [undefined, 'newest', 'price_asc', 'price_desc', 'unit_price_asc'] as const) for (const [page, perPage] of [[1, 24], [1, 3], [2, 3], [3, 3], [9, 3], [undefined, undefined]]) {
    const query = { ...filters, sort, page, perPage };
    assert.deepEqual(await listCatalog(derived, query), await listCatalog(db, query), JSON.stringify(query));
    compared++;
  }
  assert.ok(compared > 600);
  // The fixture exercises what matters: arrivals ahead in the newest order, MANUAL facts deciding alone, unpriced coffees last.
  const ids = async (filters: CatalogFilters) => (await listCatalog(db, filters)).coffees.map(c => c.sourceProductId);
  assert.deepEqual((await ids({})).slice(0, 2), ['g', 'f']);
  assert.deepEqual(await ids({ origin: ['Kenya'] }), ['f', 'c']);
  assert.ok(!(await ids({ origin: ['Ethiopia'] })).includes('c'));
  assert.equal((await ids({ sort: 'price_asc' })).at(-1), 'd');
  assert.deepEqual(await ids({ event: 'NEW' }), ['g', 'f']);
  assert.deepEqual(await ids({ event: 'RESTOCKED' }), ['e']);
  assert.deepEqual(await ids({ event: 'PRICE_DROP' }), ['a']);
  assert.deepEqual(await ids({ event: 'NEW', since: '2026-01-03T00:00:00.000Z' }), ['g']);
  assert.deepEqual((await listCatalog(db, {})).coffees.map(c => c.sourceProductId).sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 'd has no TRY price in stock but is listed through its USD offer');
  // Landing facts and roaster pages from the same index.
  assert.deepEqual(await catalogFactsMany(derived, FILTERS), await catalogFactsMany(db, FILTERS));
  for (const slug of ['alpha', 'beta', 'nobody']) assert.deepEqual(await getRoasterDetail(derived, slug), await getRoasterDetail(db, slug), slug);
  db.sqlite.close();
});

test('a list from the index reads only its page of coffees; free text and traceability read live', async () => {
  const db = await catalog();
  const { db: derived, statements } = derivedDb(db);
  await listIndex(derived);
  statements.length = 0;
  await listCatalog(derived, { origin: ['Ethiopia'], sort: 'price_asc', perPage: 2 });
  assert.ok(!statements.some(sql => /count\(\*\) OVER\(\)/.test(sql)), 'no scan of the catalog');
  assert.match(statements[0], /WHERE c\.id IN \(\?,\?\)/, 'the page coffees by id');
  for (const filters of [{ search: 'kenya' }, { farm: 'x' }, { variety: 'Gesha' }, { altitude: '1800' }, { producer: 'y' }, { traceability: 'available' as const }, { event: 'NEW' as const, search: 'kenya' }]) {
    statements.length = 0;
    assert.deepEqual(await listCatalog(derived, filters), await listCatalog(db, filters), JSON.stringify(filters));
    assert.ok(statements.some(sql => /count\(\*\) OVER\(\)/.test(sql)), `${JSON.stringify(filters)} reads live`);
  }
  // Whitespace-only free text is no filter at all, as in the query.
  statements.length = 0;
  await listCatalog(derived, { search: '  ', event: 'BOGUS' as never });
  assert.ok(!statements.some(sql => /count\(\*\) OVER\(\)/.test(sql)));
  db.sqlite.close();
});

test('the stored index stays small and keeps every sort', async () => {
  const db = await catalog();
  const index = await listIndex(db);
  assert.equal(index.coffees.length, 10);
  for (const order of Object.values(index.order)) assert.deepEqual([...order].sort((a, b) => a - b), index.coffees.map((_, at) => at));
  assert.ok(JSON.stringify(index).length < 300 * index.coffees.length);
  db.sqlite.close();
});
