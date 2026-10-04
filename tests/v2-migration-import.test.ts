import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { applyMigrationPlan, coffeeArchiveBackfillSql, createMigrationPlan, descafecolVisibilityRepairSql, excludedLegacyProductName, initializeLocalSchema, migrationSql, reconcileMigration } from '../scripts/v2-migrate';
import type { SourceRow, SourceSnapshot } from '../scripts/v2-export';

const observed = '2026-09-13T12:00:00.000Z';
const captured = '2026-09-14T12:00:00.000Z';
function source(coffees: SourceRow[] = []): SourceSnapshot {
  const tables = { roasters: [{ id: 'roaster-one', slug: 'parsa', name: 'Roaster', website_url: 'https://shop.test', shop_url: 'https://shop.test', platform: 'custom', is_active: true, created_at: observed }],
    coffees: coffees.length ? coffees : [coffee('one')], scrape_logs: [{ id: 'run', roaster_id: 'roaster-one', status: 'success', started_at: observed, completed_at: observed }],
    coffee_lots: [{ id: 'lot', is_public: true, display_name: 'Original lot' }], coffee_claims: [], trace_events: [], trace_sources: [],
    coffee_assessments: [], coffee_certifications: [], supply_chain_organizations: [], lot_organizations: [], coffee_specialty_overrides: [] };
  return { format: 'coffeedb-legacy-v1', projectRef: 'orwpmyuqkqvlqjhtotou', startedAt: captured, completedAt: captured,
    consistency: 'ordered-paginated-count-verified-not-transactional', exclusions: [], redactedValues: 0, tables,
    tableCounts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
    tableSha256: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, createHash('sha256').update(JSON.stringify(rows)).digest('hex')])) };
}
function coffee(id: string): SourceRow { return { id, roaster_id: 'roaster-one', external_id: id, slug: `legacy-${id}`, name: `Kahve ${id}`,
  product_url: `https://shop.test/${id}?utm_source=old`, origin_country: 'Ethiopia', process: 'natural', process_detail: 'Natural sun dried',
  flavor_categories: ['Fruity'], flavor_notes: ['Peach'], flavor_notes_normalized: ['Şeftali'], price_amount: 105.99,
  weight_grams: 250, price_currency: 'TRY', is_available: true, is_public: true, specialty_status: 'specialty',
  created_at: '2026-08-01T00:00:00Z', last_seen_at: observed, updated_at: observed }; }
function database() { const db = new DatabaseSync(':memory:'); initializeLocalSchema(db); return db; }

test('real SQLite import repeats without new rows/events and reconciles exact money, source IDs and raw/inferred boundary', async () => {
  const db = database();
  try {
    const plan = await createMigrationPlan(source([coffee('one'), { ...coffee('two'), weight_grams: null, price_amount: 0 }]));
    applyMigrationPlan(db, plan);
    const first = reconcileMigration(db, plan);
    applyMigrationPlan(db, plan);
    assert.deepEqual(reconcileMigration(db, plan), first);
    assert.equal(first.counts.coffee_events, 0);
    assert.equal(first.counts.price_observations, 2);
    assert.equal(first.foreignKeyViolations, 0);
    assert.equal(plan.coffeeMappings[0].priceMinor, 10599);
    assert.equal(plan.coffeeMappings[1].priceMinor, null);
    assert.equal(plan.coffeeMappings[1].weightG, null);
    const raw = JSON.parse(String(db.prepare('SELECT raw_metadata_json FROM coffees WHERE id=?').get(plan.coffeeMappings[0].canonicalId)?.raw_metadata_json));
    assert.equal(raw.country, undefined);
    assert.equal(raw.process, 'Natural sun dried');
    assert.equal(raw.sourceData.legacy.origin_country, 'Ethiopia');
    const feature = db.prepare("SELECT source_type,confidence FROM coffee_feature_values WHERE feature='origin_country' LIMIT 1").get();
    assert.equal(feature?.source_type, 'RULE_INFERRED');
    assert.equal(feature?.confidence, null);
    assert.equal(db.prepare('SELECT last_success_at FROM roasters').get()?.last_success_at, observed);
    assert.equal(db.prepare("SELECT count(*) AS n FROM coffee_aliases WHERE alias='legacy-one'").get()?.n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM legacy_traceability WHERE source_table='coffee_lots'").get()?.n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM legacy_traceability WHERE source_table='coffees'").get()?.n, 2);
  } finally { db.close(); }
});

test('changed snapshot refuses replay before mutation and source SQL metacharacters remain data', async () => {
  const db = database();
  try {
    const dangerous = { ...coffee('one'), name: "Kahve'); DELETE FROM coffees; --" };
    const initial = await createMigrationPlan(source([dangerous]));
    applyMigrationPlan(db, initial);
    assert.equal(db.prepare('SELECT name FROM coffees').get()?.name, dangerous.name);
    const changed = await createMigrationPlan(source([{ ...dangerous, price_amount: 50 }, coffee('two')]));
    assert.throws(() => applyMigrationPlan(db, changed), /CHECK constraint/);
    assert.equal(reconcileMigration(db, initial).counts.coffees, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ingestion_guards').get()?.n, 0);
    assert.doesNotMatch(migrationSql(initial), /^BEGIN|^COMMIT/m);
  } finally { db.close(); }
});

test('duplicate URLs remain distinct hidden source identities and ambiguous slugs do not route arbitrarily', async () => {
  const db = database();
  try {
    const plan = await createMigrationPlan(source([coffee('one'), { ...coffee('two'), slug: 'legacy-one', product_url: coffee('one').product_url }]));
    applyMigrationPlan(db, plan);
    assert.equal(reconcileMigration(db, plan).counts.coffees, 2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM coffees WHERE visibility='hidden'").get()?.n, 2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM coffee_aliases WHERE alias_type IN ('url','slug')").get()?.n, 0);
    assert.equal(db.prepare('SELECT count(DISTINCT slug) AS n FROM coffees').get()?.n, 2);
    assert.ok(plan.warnings.some((warning) => warning.code === 'duplicate_url_quarantined'));
  } finally { db.close(); }
});

test('Parsa catalog-prefixed IDs map native IDs and duplicated old slug maps only its sole current public record', async () => {
  const db = database();
  try {
    const plan = await createMigrationPlan(source([{ ...coffee('one'), external_id: 'catalog-101', slug: 'same' },
      { ...coffee('two'), slug: 'same', is_available: false, last_seen_at: '2026-01-01T00:00:00Z' }]));
    applyMigrationPlan(db, plan);
    assert.equal(plan.coffeeMappings[0].sourceProductId, '101');
    assert.equal(db.prepare("SELECT coffee_id FROM coffee_aliases WHERE alias='same'").get()?.coffee_id, plan.coffeeMappings[0].canonicalId);
    assert.equal(db.prepare("SELECT coffee_id FROM coffee_aliases WHERE alias='catalog-101'").get()?.coffee_id, plan.coffeeMappings[0].canonicalId);
    assert.equal(reconcileMigration(db, plan).counts.price_observations, 2);
  } finally { db.close(); }
});

test('replay preserves later stock/price updates and retirement; imported observations are immutable', async () => {
  const db = database();
  try {
    const plan = await createMigrationPlan(source());
    applyMigrationPlan(db, plan);
    db.prepare('UPDATE offers SET retired_at=?,current_price_minor=999,in_stock=0 WHERE id=?').run(captured, plan.coffeeMappings[0].offerId);
    const before = db.prepare('SELECT * FROM offers').all();
    applyMigrationPlan(db, plan);
    assert.deepEqual(db.prepare('SELECT * FROM offers').all(), before);
    assert.throws(() => db.exec('UPDATE price_observations SET price_minor=999'), /immutable price observation/);
    assert.throws(() => db.exec('DELETE FROM price_observations'), /immutable price observation/);
    assert.equal(db.prepare('SELECT price_minor FROM price_observations').get()?.price_minor, 10599);
  } finally { db.close(); }
});

test('missing genuine observation time or colliding normalized native identities stop planning', async () => {
  await assert.rejects(createMigrationPlan(source([{ ...coffee('one'), last_seen_at: null, last_scraped_at: null }])), /No genuine observation/);
  await assert.rejects(createMigrationPlan(source([{ ...coffee('one'), external_id: 'catalog-101' }, { ...coffee('two'), external_id: '101' }])), /merge distinct/);
});

test('additive original coffee archive repairs old seeds and replays after baseline metadata replacement', async () => {
  const db = database();
  const unseeded = database();
  try {
    const original = source();
    const plan = await createMigrationPlan(original);
    // Reproduce the initial seed artifact that did not archive the coffee table.
    applyMigrationPlan(db, { ...plan, rows: plan.rows.filter(row => !(row.table === 'legacy_traceability' && row.values.source_table === 'coffees')) });
    db.exec(`UPDATE coffees SET raw_metadata_json='{"description":"Fresh source capture"}'`);
    const before = db.prepare('SELECT * FROM coffees').all();
    const applyArchive = (database: DatabaseSync, sql: string) => {
      database.exec('BEGIN');
      try { database.exec(sql); database.exec('COMMIT'); } catch (error) { database.exec('ROLLBACK'); throw error; }
    };
    const sql = coffeeArchiveBackfillSql(plan);
    applyArchive(db, sql);
    const archived = db.prepare("SELECT * FROM legacy_traceability WHERE source_table='coffees'").all();
    assert.equal(archived.length, 1);
    assert.deepEqual(JSON.parse(String(archived[0].payload_json)), original.tables.coffees[0]);
    applyArchive(db, sql);
    applyMigrationPlan(db, plan);
    assert.deepEqual(db.prepare('SELECT * FROM coffees').all(), before);
    assert.deepEqual(db.prepare("SELECT * FROM legacy_traceability WHERE source_table='coffees'").all(), archived);
    assert.throws(() => applyArchive(unseeded, sql), /CHECK constraint/);
    const changed = await createMigrationPlan(source([{ ...coffee('one'), name: 'Changed' }]));
    assert.throws(() => applyArchive(db, coffeeArchiveBackfillSql(changed)), /CHECK constraint/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ingestion_guards').get()?.n, 0);
    assert.doesNotMatch(sql, /^BEGIN|^COMMIT/m);
  } finally { db.close(); unseeded.close(); }
});

test('CAFEC is a brand boundary, and reviewed repair is guarded, price-preserving and one-time', async () => {
  assert.equal(excludedLegacyProductName('DESCAFECOL DECAF'), false);
  assert.equal(excludedLegacyProductName('CAFEC filtre kağıdı'), true);
  assert.equal(excludedLegacyProductName('Coffee (CAFEC)'), true);
  const legacy = { ...coffee('b2c54bd1-f95f-43a3-9aa9-a6fe40ba1fed'), name: 'DESCAFECOL DECAF', external_id: '8278173483194' };
  const plan = await createMigrationPlan(source([legacy]));
  const oldPlan = { ...plan, rows: plan.rows.map(row => row.table === 'coffees' ? { ...row, values: { ...row.values, visibility: 'hidden' } } : row) };
  const db = database(); const changedDb = database(); const empty = database();
  const atomic = (target: DatabaseSync, sql: string) => {
    target.exec('BEGIN');
    try { target.exec(sql); target.exec('COMMIT'); } catch (error) { target.exec('ROLLBACK'); throw error; }
  };
  try {
    applyMigrationPlan(db, oldPlan);
    const observations = db.prepare('SELECT * FROM price_observations').all();
    const offers = db.prepare('SELECT * FROM offers').all();
    const sql = descafecolVisibilityRepairSql(plan);
    atomic(db, sql);
    assert.equal(db.prepare('SELECT visibility FROM coffees').get()?.visibility, 'public');
    assert.equal(reconcileMigration(db, plan).repairLedgerCount, 1);
    assert.deepEqual(db.prepare('SELECT * FROM price_observations').all(), observations);
    assert.deepEqual(db.prepare('SELECT * FROM offers').all(), offers);
    // A later manual decision is not undone by replaying the correction.
    db.exec("UPDATE coffees SET visibility='hidden',updated_at='2026-09-15T00:00:00Z'");
    atomic(db, sql);
    assert.equal(db.prepare('SELECT visibility FROM coffees').get()?.visibility, 'hidden');
    applyMigrationPlan(changedDb, oldPlan);
    changedDb.exec("UPDATE coffees SET updated_at='2026-09-15T00:00:00Z'");
    assert.throws(() => atomic(changedDb, sql), /CHECK constraint/);
    assert.throws(() => atomic(empty, sql), /CHECK constraint/);
    assert.equal(changedDb.prepare('SELECT visibility FROM coffees').get()?.visibility, 'hidden');
  } finally { db.close(); changedDb.close(); empty.close(); }
});
