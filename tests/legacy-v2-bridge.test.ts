import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations } from './helpers/v2-sqlite';
import type { CatalogDatabase, SqlValue, Statement } from '../shared/v2/database';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { CrawlInput, SourceCoffee } from '../shared/v2/types';
import { archiveForCoffee, archivedJourney, legacyCatalogDatabase, legacyCoffees, legacyCoffeeDetail, legacyRankingRows, legacyRoasters, toLegacyCoffee } from '../src/lib/v2-legacy';
import { rankCoffees } from '../src/lib/coffee-rankings';

class SQLite implements CatalogDatabase {
  db = new DatabaseSync(':memory:');
  constructor() { applyMigrations(this.db); }
  prepare(sql: string): Statement { return new Prepared(this, sql); }
  async batch(statements: Statement[]) { this.db.exec('BEGIN'); try { const results = statements.map(s => { const p = s as Prepared; return this.db.prepare(p.sql).run(...p.values); }); this.db.exec('COMMIT'); return results; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
}
class Prepared implements Statement {
  values: SqlValue[] = []; constructor(readonly owner: SQLite, readonly sql: string) {}
  bind(...values: SqlValue[]) { this.values = values; return this; }
  async first<T>() { return (this.owner.db.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  async all<T>() { return { results: this.owner.db.prepare(this.sql).all(...this.values) as T[], success: true }; }
}
const product = (id: string, overrides: Partial<SourceCoffee> = {}): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Çiçek ${id}`, visibility: 'public', rawMetadata: { tastingNotes: ['Jasmine'] },
  offers: [{ sourceVariantId: `sku-${id}`, label: '250g', weightG: 250, price: 100, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${id}` }], ...overrides });
const run = (day: number, products: SourceCoffee[]): CrawlInput => ({ id: `run${day}`, roasterId: 'r', startedAt: `2026-09-0${day}T00:00:00Z`, completedAt: `2026-09-0${day}T00:01:00Z`, status: 'success', parserVersion: 'test', products, diagnostics: [], mode: 'baseline' });
async function setup() { const db = new SQLite(); await registerRoaster(db, { id: 'r', slug: 'roaster', name: 'Roaster', websiteUrl: 'https://shop.test', adapter: 'test', city: 'İstanbul' }); return db; }
function archive(db: SQLite, table: string, id: string, row: object) { db.db.prepare('INSERT INTO legacy_traceability VALUES(?,?,?,?)').run(table, id, JSON.stringify(row), '2026-09-01T00:00:00Z'); }

test('Workers detection only falls back for unavailable runtime, never for a missing DB or runtime failure', async () => {
  const db = await setup();
  assert.equal(await legacyCatalogDatabase(async () => ({ DB: db }) as unknown as CloudflareEnv), db);
  await assert.rejects(legacyCatalogDatabase(async () => ({}) as CloudflareEnv), /binding unavailable/);
  await assert.rejects(legacyCatalogDatabase(async () => { throw new Error('DB failed'); }), /DB failed/);
  assert.equal(await legacyCatalogDatabase(async () => { throw Object.assign(new Error("Received protocol 'cloudflare:'"), { code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME' }); }), null);
  assert.equal(await legacyCatalogDatabase(), null);
  db.db.close();
});
test('current tuple and old slug stay coherent after new observations, archived prices never leak back', async () => {
  const db = await setup(); const a = product('a');
  a.offers.push({ ...a.offers[0], sourceVariantId: 'bulk', label: '1kg', weightG: 1000, price: 350 });
  await ingestCrawl(db, run(1, [a])); const current = (await legacyCoffees(db)).coffees[0];
  archive(db, 'coffees', 'old', { id: 'old', green_lot_id: 'lot', price_amount: 9, weight_grams: 42, click_count: 990 });
  db.db.prepare('INSERT INTO legacy_id_map VALUES(?,?,?,?,?,?)').run('supabase', 'coffee', 'old', current.id, 'hash', '2026-09-01T00:00:00Z');
  db.db.prepare('INSERT INTO coffee_aliases VALUES(?,?,?,?,?)').run('r', 'slug', 'old-slug', current.id, '2026-09-01T00:00:00Z');
  a.offers[0].price = null; a.offers[0].weightG = null; a.offers[0].inStock = null;
  a.offers[1].inStock = false;
  await ingestCrawl(db, run(2, [a]));
  assert.equal((await legacyCoffees(db)).total, 0);
  const detail = await legacyCoffeeDetail(db, 'old-slug'); assert.ok(detail); assert.equal(detail.green_lot_id, 'lot');
  assert.equal(detail.click_count, 0); assert.notEqual(detail.price_amount, 9); assert.notEqual(detail.weight_grams, 42);
  assert.equal((await archiveForCoffee(db, current.id))?.click_count, 990);
  const sku = detail.v2_source.offers.find(o => o.id === detail.offer_id)!;
  assert.equal(detail.price_amount, sku.priceMinor == null ? null : sku.priceMinor / 100);
  assert.equal(detail.weight_grams, sku.weightG); assert.equal(detail.stock_status, sku.inStock);
  assert.equal(detail.decaf_status, null); assert.equal(detail.price_per_100g, sku.unitPriceTry);
  assert.equal(await legacyCoffeeDetail(db, 'missing'), null); db.db.close();
});
test('retained filters use current public rows and inferred classifications without promoting them to source facts', async () => {
  const db = await setup();
  const a = product('a', { features: [{ feature: 'origin_country', value: 'Ethiopia', sourceType: 'RULE_INFERRED', confidence: null, version: 'legacy' }, { feature: 'brew_compatibility', value: ['filter'], sourceType: 'RULE_INFERRED', confidence: null, version: 'legacy' }, { feature: 'flavor_categories', value: ['Floral'], sourceType: 'RULE_INFERRED', confidence: null, version: 'legacy' }] });
  await ingestCrawl(db, run(1, [a, product('hidden', { visibility: 'hidden' }), product('decaf', { rawMetadata: { decaf: false } })]));
  const filtered = await legacyCoffees(db, { origin: ['Ethiopia'], brewMethod: ['filter'], flavorCategory: ['Floral'], city: ['istanbul'], search: 'cicek' });
  assert.equal(filtered.total, 1); assert.equal(filtered.coffees[0].origin_country, 'Ethiopia');
  const declared = toLegacyCoffee(filtered.coffees[0].v2_source, null, true);
  assert.equal(declared.origin_country, null); assert.deepEqual(declared.flavor_categories, []); assert.deepEqual(declared.flavor_notes, ['Jasmine']);
  assert.equal((await legacyCoffees(db, { isDecaf: false })).total, 1); // unknown is not false
  assert.equal((await legacyRoasters(db))[0].coffees[0].count, 2);
  assert.equal((await legacyCoffees(db, { perPage: 1, page: 2 })).totalPages, 2);
  db.db.close();
});
test('public archived traceability survives raw metadata replacement; ranking never treats old clicks as current interest', async () => {
  const db = await setup(); await ingestCrawl(db, run(1, [product('a')])); const coffee = (await legacyCoffees(db)).coffees[0];
  archive(db, 'coffees', 'old', { green_lot_id: 'lot', sca_score: 88, click_count: 999 });
  db.db.prepare('INSERT INTO legacy_id_map VALUES(?,?,?,?,?,?)').run('supabase', 'coffee', 'old', coffee.id, 'hash', '2026-09-01T00:00:00Z');
  archive(db, 'coffee_lots', 'lot', { id: 'lot', traceability_score: 70, validation_status: 'document_verified', is_public: true });
  archive(db, 'trace_sources', 'source', { id: 'source', lot_id: 'lot', is_public: true });
  archive(db, 'trace_events', 'event', { id: 'event', lot_id: 'lot', sequence_number: 10, is_public: true });
  archive(db, 'trace_events', 'private', { id: 'private', lot_id: 'lot', sequence_number: 1, is_public: false });
  archive(db, 'coffee_claims', 'claim', { id: 'claim', subject_type: 'coffee_lot', subject_id: 'lot', confidence: 1, is_public: true });
  archive(db, 'coffee_assessments', 'assessment', { id: 'assessment', lot_id: 'lot', score: 88, is_public: true });
  archive(db, 'coffee_certifications', 'certification', { id: 'certification', lot_id: 'lot', is_public: true });
  await ingestCrawl(db, run(2, [product('a', { rawMetadata: {} })]));
  const journey = await archivedJourney(db, 'lot'); assert.ok(journey); assert.equal(journey.usesFallback, false);
  assert.equal(journey.events.length, 1); assert.equal(journey.sources.length, 1); assert.equal(journey.claims.length, 1); assert.equal(journey.assessments.length, 1); assert.equal(journey.certifications.length, 1);
  const ranked = rankCoffees(await legacyRankingRows(db)); assert.equal(ranked.traceability[0].traceabilityScore, 70); assert.equal(ranked.qualityEvidence[0].sca_score, 88); assert.equal(ranked.marketInterest.length, 0);
  db.db.close();
});
