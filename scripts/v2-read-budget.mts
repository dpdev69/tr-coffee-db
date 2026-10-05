/** Rows read per page view, endpoint call and nightly refresh, measured on a local D1 copy (never remote).
 *
 *   npx tsx scripts/v2-read-budget.mts [pages|refresh|all|sql|equivalence] [--persist .local/perf-d1] [--json out.json]
 *     pages [--verbose] [--live]   rows per uncached page view, through the derived cache unless --live
 *     refresh                      one unchanged night through the real ingestion code
 *     sql --q "SELECT …"           rows read by any statement
 *     equivalence --old <tree>     old and new reads on the same data; exits non-zero on any difference
 *
 * Load a dump first (docs/read-budget.md). `refresh` runs on a throwaway copy of the persist folder, because it writes.
 * Each page lists the catalog calls its server render makes, in the same shape as the page file; the numbers are
 * D1's own meta.rows_read, which local D1 reports the same way production does.
 */
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import type { CatalogDatabase, SqlValue, Statement } from '../shared/v2/database';
import { catalogChangesByDay, catalogFacts, getCatalogCounts, getCoffeeDetail, getCoffeeOfTheDay, getRoasterDetail, getSavedCoffees, getSimilarCoffees, listCatalog, listOrigins, listRoasters, type CatalogFilters } from '../shared/v2/catalog';
import { invalidateDerived, withDerivedCache } from '../shared/v2/read-cache';
import { rankQuizMatches } from '../shared/v2/quiz-rank';
import { roasterSiteUrl, handleOutbound } from '../shared/v2/outbound';
import { ARRIVAL_DAYS } from '../shared/v2/events';
import { beginCrawl, expireCrawls, ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { stableId } from '../shared/v2/identity';
import { listLandings, findLanding, landingFacts } from '../src/lib/catalog-landing';
import { catalogSitemap } from '../src/lib/sitemap-entries';
import { parseDiscoveryFilters } from '../src/components/v2/discovery-catalog';
import { parseQuizAnswers } from '../src/lib/quiz-filters';
import type { SourceCoffee } from '../shared/v2/types';
import { attentionNeeded } from './v2-refresh.mts';
import { applyCorrections } from './v2-apply-corrections.mts';

type D1Result = { results: Record<string, unknown>[]; success: boolean; meta?: { rows_read?: number; rows_written?: number } };
type D1Like = { prepare(sql: string): { bind(...v: SqlValue[]): { all(): Promise<D1Result> } }; batch(s: unknown[]): Promise<D1Result[]> };
export interface Tally { queries: number; rowsRead: number; rowsWritten: number; top: Map<string, { n: number; rows: number }> }

/** Wraps the D1 binding; every statement reports D1's own rows_read. */
export function counting(d1: D1Like) {
  const tally: Tally = { queries: 0, rowsRead: 0, rowsWritten: 0, top: new Map() };
  const note = (sql: string, meta?: D1Result['meta']) => {
    tally.queries++; tally.rowsRead += meta?.rows_read ?? 0; tally.rowsWritten += meta?.rows_written ?? 0;
    const key = sql.replace(/\s+/g, ' ').slice(0, 90);
    const entry = tally.top.get(key) ?? { n: 0, rows: 0 }; entry.n++; entry.rows += meta?.rows_read ?? 0; tally.top.set(key, entry);
  };
  const native = new WeakMap<Statement, { sql: string; values: SqlValue[] }>();
  const db: CatalogDatabase = {
    prepare(sql) {
      const make = (values: SqlValue[]): Statement => {
        const run = async () => { const result = await d1.prepare(sql).bind(...values).all(); note(sql, result.meta); return result; };
        const statement: Statement = { bind: (...next) => make(next), all: async <T,>() => ({ results: (await run()).results as T[], success: true }), first: async <T,>() => ((await run()).results[0] ?? null) as T | null };
        native.set(statement, { sql, values }); return statement;
      };
      return make([]);
    },
    async batch(statements) {
      const plain = statements.map(statement => native.get(statement)!);
      const results = await d1.batch(plain.map(({ sql, values }) => d1.prepare(sql).bind(...values)));
      results.forEach((result, index) => note(plain[index].sql, result.meta));
      return results;
    },
  };
  return { db, tally };
}

const since = (days: number, now: number) => new Date(Math.floor(now / 300000) * 300000 - days * 86400000).toISOString();
/** DiscoveryCatalog (src/components/v2/discovery-catalog.tsx): the list, roasters and origins for the form. */
async function discovery(db: CatalogDatabase, params: Record<string, string | string[]>, now: number, event?: CatalogFilters['event'], preset?: Record<string, string>) {
  const filters = parseDiscoveryFilters({ ...params, ...preset });
  if (event) { filters.event = event; filters.since = since(event === 'NEW' ? ARRIVAL_DAYS : 7, now); }
  // A page past the last one now redirects to the last page (its own address) instead of reading it here.
  await Promise.all([listCatalog(db, filters), listRoasters(db), listOrigins(db)]);
}

export function pageScenarios(sample: { coffee: string; roaster: string; offer: string; saved: string[] }) {
  const now = Date.now();
  const landing = findLanding('koken', 'etiyopya')!;
  return {
    'GET / (home)': async (db: CatalogDatabase) => { await Promise.all([getCatalogCounts(db), listCatalog(db, { event: 'NEW', since: since(ARRIVAL_DAYS, now), perPage: 4 }), listCatalog(db, { event: 'PRICE_DROP', since: since(7, now), perPage: 4 }), listCatalog(db, { event: 'RESTOCKED', since: since(7, now), perPage: 4 }), listRoasters(db), getCoffeeOfTheDay(db, now)]); },
    'GET /kahveler': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, {}, now)]); },
    'GET /kahveler?sort=price_asc': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, { sort: 'price_asc' }, now)]); },
    'GET /kahveler?page=10': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, { page: '10' }, now)]); },
    'GET /kahveler?taste=fruity&roast=light': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, { taste: 'fruity', roast: 'light' }, now)]); },
    'GET /kahveler?search=etiyopya': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, { search: 'etiyopya' }, now)]); },
    'GET /kahveler?priceMax=600': async (db: CatalogDatabase) => { await Promise.all([listLandings(db), discovery(db, { priceMax: '600' }, now)]); },
    'GET /kahveler/koken/etiyopya': async (db: CatalogDatabase) => { await landingFacts(db, landing); await discovery(db, {}, now, undefined, { origin: landing.value }); },
    'GET /yeni': async (db: CatalogDatabase) => discovery(db, {}, now, 'NEW'),
    'GET /yeni?event=RESTOCKED': async (db: CatalogDatabase) => discovery(db, { event: 'RESTOCKED' }, now, 'RESTOCKED'),
    'GET /firsatlar': async (db: CatalogDatabase) => discovery(db, {}, now, 'PRICE_DROP'),
    'GET /kahve/[slug]': async (db: CatalogDatabase) => { const coffee = await getCoffeeDetail(db, sample.coffee, now); if (coffee) await getSimilarCoffees(db, coffee); },
    'GET /kavurucu/[slug]': async (db: CatalogDatabase) => { await Promise.all([getRoasterDetail(db, sample.roaster), roasterSiteUrl(db, sample.roaster)]); },
    'GET /kavurucular': async (db: CatalogDatabase) => { await listRoasters(db); },
    'GET /quiz/sonuc?taste=fruity&brew=filter': async (db: CatalogDatabase) => { await rankQuizMatches(db, parseQuizAnswers({ taste: 'fruity', brew: 'filter' }), 8); },
    'GET /sitemap.xml': async (db: CatalogDatabase) => { await catalogSitemap(db); },
    'GET /api/catalog': async (db: CatalogDatabase) => { await Promise.all([getCatalogCounts(db), listCatalog(db, { page: 1, perPage: 24, origin: [], process: [], taste: [], roaster: [] })]); },
    'GET /api/quiz/match?taste=fruity&limit=4': async (db: CatalogDatabase) => { await rankQuizMatches(db, parseQuizAnswers(new URLSearchParams('taste=fruity')), 4); },
    'GET /api/saved (5 slugs)': async (db: CatalogDatabase) => { await getSavedCoffees(db, sample.saved, now); },
    'GET /api/since': async (db: CatalogDatabase) => { await catalogChangesByDay(db, now); },
    'GET /go/[offerId]': async (db: CatalogDatabase) => { await handleOutbound(new Request(`https://x.test/go/${sample.offer}`), sample.offer, db, {}); },
  };
}

async function samples(d1: D1Like) {
  const one = async (sql: string) => (await d1.prepare(sql).bind().all()).results;
  // A well-stocked coffee and roaster, so the numbers are not flattered by a near-empty page.
  const [coffee] = await one("SELECT c.slug FROM public_catalog_coffees c ORDER BY (SELECT count(*) FROM offers o WHERE o.coffee_id=c.id) DESC, c.id LIMIT 1");
  const [roaster] = await one('SELECT r.slug FROM roasters r JOIN public_catalog_coffees c ON c.roaster_id=r.id GROUP BY r.id ORDER BY count(*) DESC LIMIT 1');
  const [offer] = await one("SELECT o.id FROM current_offers o JOIN public_catalog_coffees c ON c.id=o.coffee_id WHERE o.in_stock=1 ORDER BY o.id LIMIT 1");
  const saved = (await one('SELECT slug FROM public_catalog_coffees ORDER BY id LIMIT 5')).map(row => String(row.slug));
  return { coffee: String(coffee.slug), roaster: String(roaster.slug), offer: String(offer.id), saved };
}

/** One night with nothing new: every active roaster that succeeded last time is crawled again and sees the same products.
 * This is the floor of a real run (new coffees or price changes add a few rows each), and the shape of every night. */
async function simulatedRefresh(db: CatalogDatabase, d1: D1Like) {
  const startedAt = new Date().toISOString();
  const roasters = (await d1.prepare("SELECT id,slug,name,website_url,city,adapter,trusted_hosts_json,last_success_at FROM roasters WHERE active=1 ORDER BY slug").bind().all()).results as Array<Record<string, string>>;
  // syncRoasters: one upsert per configured roaster, then the deactivation sweep.
  for (const r of roasters) await registerRoaster(db, { id: r.id, slug: r.slug, name: r.name, websiteUrl: r.website_url, city: r.city, adapter: r.adapter, active: true, trustedHosts: JSON.parse(r.trusted_hosts_json) }, startedAt);
  await expireCrawls(db, startedAt);
  await db.prepare('SELECT id,slug FROM roasters WHERE active=1 ORDER BY slug').all();
  let tick = 0;
  for (const r of roasters) {
    if (!r.last_success_at) continue;
    const jobKey = await stableId('job', r.id, startedAt);
    await db.prepare("SELECT id FROM crawl_runs WHERE job_key=? AND status='success' LIMIT 1").bind(jobKey).first();
    const mode = await db.prepare("SELECT id FROM crawl_runs WHERE roaster_id=? AND status='success' AND mode<>'import' LIMIT 1").bind(r.id).first() ? 'live' : 'baseline';
    const at = new Date(Date.parse(startedAt) + ++tick * 1000).toISOString();
    const id = await stableId('run', jobKey, at);
    await beginCrawl(db, { id, jobKey, roasterId: r.id, startedAt: at, mode, parserVersion: 'budget-sim' });
    const products = await unchangedSnapshot(d1, r.id, r.last_success_at);
    if (!products.length) continue;
    try { await ingestCrawl(db, { id, jobKey, roasterId: r.id, startedAt: at, completedAt: at, mode, parserVersion: 'budget-sim', status: 'success', products, diagnostics: [] }); }
    catch (error) { console.error(`  ${r.slug}: snapshot not replayable (${error instanceof Error ? error.message : error})`); }
  }
  await attentionNeeded(db, [], new Date().toISOString());
  // Second workflow step (scrape.yml): reviewed corrections and size-twin links.
  await applyCorrections(db, JSON.parse(await readFile(resolve('data/corrections.json'), 'utf8')));
}
/** The products and offers the roaster's last successful crawl saw, rebuilt as a source snapshot (read uncounted). */
async function unchangedSnapshot(d1: D1Like, roasterId: string, lastSuccess: string): Promise<SourceCoffee[]> {
  const coffees = (await d1.prepare('SELECT id,identity_key,source_product_id,canonical_url,name,raw_metadata_json,visibility FROM coffees WHERE roaster_id=? AND last_seen_at=?').bind(roasterId, lastSuccess).all()).results as Array<Record<string, string>>;
  const offers = (await d1.prepare('SELECT o.* FROM offers o JOIN coffees c ON c.id=o.coffee_id WHERE c.roaster_id=? AND o.last_seen_at=? AND o.retired_at IS NULL').bind(roasterId, lastSuccess).all()).results as Array<Record<string, string | number | null>>;
  const features = (await d1.prepare("SELECT f.* FROM coffee_feature_values f JOIN coffees c ON c.id=f.coffee_id WHERE c.roaster_id=? AND f.source_type<>'MANUAL'").bind(roasterId).all()).results as Array<Record<string, string | number | null>>;
  return coffees.map(c => ({
    sourceProductId: c.source_product_id, canonicalUrl: c.canonical_url, name: c.name,
    rawMetadata: JSON.parse(c.raw_metadata_json), visibility: c.visibility as SourceCoffee['visibility'],
    features: features.filter(f => f.coffee_id === c.id).map(f => ({ feature: String(f.feature), value: JSON.parse(String(f.value_json)), sourceType: f.source_type as 'ROASTER_DECLARED', confidence: f.confidence as number | null, version: String(f.version), sourceReference: f.source_reference as string | null })),
    offers: offers.filter(o => o.coffee_id === c.id).map(o => {
      const key = String(o.identity_key);
      return { sourceVariantId: key.startsWith('source:') ? key.slice(7) : null, identityKey: key.startsWith('options:') ? key.slice(8) : undefined, label: o.label as string | null, weightG: o.weight_g as number | null,
        price: o.current_price_minor === null ? null : Number(o.current_price_minor) / 100, compareAtPrice: o.compare_at_price_minor === null ? null : Number(o.compare_at_price_minor) / 100,
        currency: o.currency as string | null, inStock: o.in_stock === null ? null : o.in_stock === 1, purchaseUrl: String(o.purchase_url) };
    }),
  })).filter(c => c.offers.length);
}

/** Runs each read in the old tree and in this one (through the derived cache, twice, so the cached copy is compared too). */
async function equivalence(d1: D1Like, oldRoot: string) {
  const load = (path: string) => import(pathToFileURL(resolve(oldRoot, path)).href);
  const [oldCatalog, oldQuiz, oldLanding, oldSitemap] = await Promise.all([load('shared/v2/catalog.ts'), load('shared/v2/quiz-rank.ts'), load('src/lib/catalog-landing.tsx'), load('src/lib/sitemap-entries.ts')]);
  const plain = counting(d1).db;
  await plain.batch(invalidateDerived(plain));
  const cached = withDerivedCache(plain, 'equivalence');
  const now = Date.now();
  let failures = 0, checks = 0;
  const same = async (name: string, before: () => Promise<unknown>, after: (db: CatalogDatabase) => Promise<unknown>) => {
    const expected = JSON.stringify(await before());
    for (const pass of ['cold', 'warm']) {
      checks++;
      const actual = JSON.stringify(await after(cached));
      if (actual !== expected) { failures++; console.log(`DIFFERENT (${pass}): ${name}\n  old ${expected.slice(0, 300)}\n  new ${actual.slice(0, 300)}`); }
    }
  };
  await same('getCatalogCounts', () => oldCatalog.getCatalogCounts(plain), db => getCatalogCounts(db));
  await same('listRoasters', () => oldCatalog.listRoasters(plain), db => listRoasters(db));
  await same('listOrigins', () => oldCatalog.listOrigins(plain), db => listOrigins(db));
  await same('listLandings', () => oldLanding.listLandings(plain), db => listLandings(db));
  await same('catalogSitemap', () => oldSitemap.catalogSitemap(plain), db => catalogSitemap(db));
  for (const landing of [...await listLandings(plain), findLanding('koken', 'cin'), findLanding('koken', 'yemen'), findLanding('islem', 'islak-kabuk-soyma')].filter(item => item !== null)) {
    await same(`catalogFacts ${landing.path}`, () => oldCatalog.catalogFacts(plain, landing.filters), db => catalogFacts(db, landing.filters));
    await same(`landingFacts ${landing.path}`, () => oldCatalog.catalogFacts(plain, landing.filters), db => landingFacts(db, landing));
  }
  await same('catalogChangesByDay', () => oldCatalog.catalogChangesByDay(plain, now), db => catalogChangesByDay(db, now));
  for (let day = 0; day < 10; day++) await same(`getCoffeeOfTheDay +${day}d`, () => oldCatalog.getCoffeeOfTheDay(plain, now + day * 86400000), db => getCoffeeOfTheDay(db, now + day * 86400000));
  const roaster = String((await d1.prepare('SELECT r.slug FROM roasters r JOIN public_catalog_coffees c ON c.roaster_id=r.id GROUP BY r.id ORDER BY count(*) DESC LIMIT 1').bind().all()).results[0].slug);
  const lists: CatalogFilters[] = [{}, { origin: ['Ethiopia'] }, { origin: ['Etiyopya', 'Kenya'] }, { process: ['washed'] }, { process: ['natural'], taste: ['fruity'] }, { taste: ['chocolate'], roast: ['dark'] },
    { roaster: [roaster] }, { search: 'etiyopya' }, { search: 'gesha' }, { priceMin: 300 }, { priceMax: 600 }, { priceMin: 400, priceMax: 900 }, { brewMethod: ['espresso'] }, { variety: 'Bourbon' }, { altitude: '1800' },
    { traceability: 'available' }, { traceability: 'missing' }, { event: 'NEW', since: since(30, now) }, { event: 'PRICE_DROP', since: since(7, now) }, { event: 'RESTOCKED', since: since(7, now) }, { event: 'DEAL', since: since(7, now) }];
  for (const filters of lists) for (const sort of ['newest', 'price_asc', 'price_desc', 'unit_price_asc'] as const) for (const page of [1, 2, 5, 999]) {
    const query = { ...filters, sort, page };
    await same(`listCatalog ${JSON.stringify(query)}`, () => oldCatalog.listCatalog(plain, query, now), db => listCatalog(db, query, now));
  }
  const listed = (await d1.prepare('SELECT slug FROM public_catalog_coffees ORDER BY id').bind().all()).results.map(row => String(row.slug));
  for (const slug of listed) {
    const coffee = await getCoffeeDetail(plain, slug, now);
    if (coffee) for (const limit of [4, 12]) await same(`getSimilarCoffees ${slug} ${limit}`, () => oldCatalog.getSimilarCoffees(plain, coffee, limit), db => getSimilarCoffees(db, coffee, limit));
  }
  const values = { brew: ['', 'espresso', 'filter', 'turkish,espresso'], taste: ['', 'fruity', 'chocolate,nutty', 'floral,fruity,sweet'], roast: ['', 'light', 'dark', 'medium'], process: ['', 'washed', 'natural', 'honey,anaerobic'] };
  for (const brew of values.brew) for (const taste of values.taste) for (const roast of values.roast) for (const process of values.process) {
    const answers = parseQuizAnswers({ brew, taste, roast, process });
    for (const limit of [4, 8]) await same(`rankQuizMatches ${JSON.stringify(answers)} ${limit}`, () => oldQuiz.rankQuizMatches(plain, answers, limit), db => rankQuizMatches(db, answers, limit));
  }
  console.log(`${checks - failures}/${checks} identical`);
  return failures;
}

function print(name: string, tally: Tally, ms: number) {
  console.log(`${name.padEnd(44)} ${String(tally.queries).padStart(5)} q ${String(tally.rowsRead).padStart(10)} rows read ${String(tally.rowsWritten).padStart(8)} written ${String(ms).padStart(6)} ms`);
}
function worst(tally: Tally, count = 6) {
  for (const [sql, { n, rows }] of [...tally.top].sort((a, b) => b[1].rows - a[1].rows).slice(0, count)) console.log(`    ${String(rows).padStart(9)} rows  ${n}x  ${sql}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => !arg.startsWith('--') && !args[args.indexOf(arg) - 1]?.startsWith('--')) ?? 'all';
  const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const persist = resolve(option('--persist') ?? '.local/perf-d1');
  const out: Record<string, { queries: number; rowsRead: number; rowsWritten: number }> = {};
  const open = async (path: string) => getPlatformProxy<{ DB: D1Like }>({ configPath: 'wrangler.jsonc', persist: { path: resolve(path, 'v3') } });
  if (mode === 'pages' || mode === 'all') {
    const proxy = await open(persist);
    const sample = await samples(proxy.env.DB);
    console.log(`Sample coffee ${sample.coffee}, roaster ${sample.roaster}\n`);
    // As the Worker reads (src/lib/v2-runtime.ts): through the derived cache, unless --live asks for the bare queries.
    const live = args.includes('--live');
    const wrap = (db: CatalogDatabase) => live ? db : withDerivedCache(db, 'budget');
    if (!live) {
      const { db } = counting(proxy.env.DB); await db.batch(invalidateDerived(db));
      console.log('Derived results, computed once per refresh (first miss after the nightly invalidation):');
      const fills: Record<string, (db: CatalogDatabase) => Promise<unknown>> = { counts: getCatalogCounts, roasters: listRoasters, origins: listOrigins, 'landing facts': listLandings,
        'similar candidates': async db => getSimilarCoffees(db, (await getCoffeeDetail(db, sample.coffee))!, 0), 'quiz candidates': db => rankQuizMatches(db, parseQuizAnswers({}), 1), 'coffee of the day order': db => getCoffeeOfTheDay(db), sitemap: catalogSitemap };
      let total = 0;
      for (const [name, run] of Object.entries(fills)) { const { db, tally } = counting(proxy.env.DB); await run(wrap(db)); total += tally.rowsRead; print(`  ${name}`, tally, 0); }
      console.log(`  total ${total} rows read\n`);
      out['derived fill (once per refresh)'] = { queries: 0, rowsRead: total, rowsWritten: 0 };
    }
    for (const [name, run] of Object.entries(pageScenarios(sample))) {
      const { db, tally } = counting(proxy.env.DB);
      const started = performance.now(); await run(wrap(db)); const ms = Math.round(performance.now() - started);
      print(name, tally, ms); if (args.includes('--verbose')) worst(tally);
      out[name] = { queries: tally.queries, rowsRead: tally.rowsRead, rowsWritten: tally.rowsWritten };
    }
    await proxy.dispose();
  }
  if (mode === 'refresh' || mode === 'all') {
    const copy = `${persist}-refresh`;
    await rm(copy, { recursive: true, force: true }); await cp(persist, copy, { recursive: true });
    const proxy = await open(copy);
    const { db, tally } = counting(proxy.env.DB);
    const started = performance.now(); await simulatedRefresh(db, proxy.env.DB); const ms = Math.round(performance.now() - started);
    console.log(''); print('Nightly refresh (unchanged night)', tally, ms); worst(tally, 10);
    out['Nightly refresh (unchanged night)'] = { queries: tally.queries, rowsRead: tally.rowsRead, rowsWritten: tally.rowsWritten };
    await proxy.dispose(); await rm(copy, { recursive: true, force: true });
  }
  if (mode === 'sql') {
    // Ad hoc: rows read by each statement given with --q (repeatable); runs on the persist folder as is.
    const proxy = await open(persist);
    for (const [index, arg] of args.entries()) if (arg === '--q') {
      const result = await proxy.env.DB.prepare(args[index + 1]).bind().all();
      console.log(`${String(result.meta?.rows_read).padStart(9)} rows read, ${result.results.length} rows: ${JSON.stringify(result.results.slice(0, 3)).slice(0, 200)}`);
    }
    await proxy.dispose();
  }
  if (mode === 'equivalence') {
    // Old code (a tree from `git archive <ref> shared src scripts data`) and this tree on the same data; any difference fails.
    const old = resolve(option('--old') ?? '.local/old');
    const proxy = await open(persist);
    const failures = await equivalence(proxy.env.DB, old);
    await proxy.dispose();
    if (failures) process.exitCode = 1;
  }
  const json = option('--json'); if (json) await writeFile(json, JSON.stringify(out, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
