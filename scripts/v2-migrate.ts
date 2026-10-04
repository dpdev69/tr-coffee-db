import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { canonicalizeUrl, productIdentity, stableId, stableSlug, toMinorUnits } from '../shared/v2/identity';
import { CATALOG_NAME_EXCLUSION_PATTERNS } from '../src/lib/catalog-rules';
import type { SqlValue } from '../shared/v2/database';
import { analyzeSource } from './v2-quality';
import { readSourceSnapshot, type SourceRow, type SourceSnapshot } from './v2-export';

const VERSION = 'legacy-import-v1';
type Row = Record<string, SqlValue>;
interface PlannedRow { table: string; values: Row }
export interface MigrationPlan {
  sourceHash: string;
  sourceCompletedAt: string;
  rows: PlannedRow[];
  coffeeMappings: Array<{ legacyId: string; canonicalId: string; offerId: string; observationId: string; priceMinor: number | null; weightG: number | null; currency: string | null; sourceProductId: string }>;
  warnings: Array<{ code: string; legacyIds: string[] }>;
  expected: Record<string, number>;
}
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const json = (value: unknown) => JSON.stringify(value);
const hash = (value: unknown) => createHash('sha256').update(json(value)).digest('hex');
const date = (value: unknown, fallback: string) => text(value) && Number.isFinite(Date.parse(String(value))) ? new Date(String(value)).toISOString() : fallback;
const present = (value: unknown) => value != null && value !== 'unknown' && value !== '' && (!Array.isArray(value) || value.length > 0);
export function excludedLegacyProductName(name: string) {
  const lower = name.toLocaleLowerCase('tr-TR');
  return CATALOG_NAME_EXCLUSION_PATTERNS.some(pattern => pattern === '%cafec%'
    ? /(?:^|[^\p{L}\p{N}])cafec(?:$|[^\p{L}\p{N}])/u.test(lower)
    : lower.includes(pattern.slice(1, -1).toLocaleLowerCase('tr-TR')));
}
const featureFields: Record<string, string> = {
  name_normalized: 'name_normalized', origin_country: 'origin_country', process: 'process_family',
  roast_level: 'roast_classification', variety: 'normalized_variety', flavor_notes_normalized: 'flavor_notes_normalized',
  flavor_categories: 'flavor_categories', brew_methods: 'brew_compatibility', is_decaf: 'is_decaf',
};

export async function createMigrationPlan(source: SourceSnapshot): Promise<MigrationPlan> {
  const quality = analyzeSource(source);
  const sourceHash = hash({ version: VERSION, project: source.projectRef, tableHashes: source.tableSha256 });
  const plan: MigrationPlan = { sourceHash, sourceCompletedAt: source.completedAt, rows: [], coffeeMappings: [], warnings: [], expected: {} };
  const add = (table: string, values: Row) => { plan.rows.push({ table, values }); plan.expected[table] = (plan.expected[table] ?? 0) + 1; };
  const map = (entityType: string, legacyId: string, canonicalId: string, row: unknown) => add('legacy_id_map', {
    source_system: 'supabase', entity_type: entityType, legacy_id: legacyId, canonical_id: canonicalId,
    source_hash: hash(row), imported_at: source.completedAt,
  });
  const byRoaster = new Map(source.tables.roasters.map((row) => [String(row.id), row]));
  const quarantine = new Set(quality.duplicateUrls.flatMap((rows) => rows.map((row) => String(row.id))));
  for (const rows of quality.duplicateUrls) plan.warnings.push({ code: 'duplicate_url_quarantined', legacyIds: rows.map((row) => String(row.id)) });
  const slugs = new Map<string, SourceRow[]>();
  for (const row of source.tables.coffees) slugs.set(String(row.slug), [...(slugs.get(String(row.slug)) ?? []), row]);
  const activeIds = new Set(quality.active.map((row) => String(row.id)));
  const aliasWinners = new Map<string, string>();
  for (const [slug, rows] of slugs) {
    const candidates = rows.length === 1 ? rows : rows.filter((row) => activeIds.has(String(row.id)) && !quarantine.has(String(row.id)));
    if (candidates.length === 1) aliasWinners.set(slug, String(candidates[0].id));
    if (rows.length > 1) plan.warnings.push({ code: candidates.length === 1 ? 'duplicate_slug_current_winner' : 'ambiguous_legacy_slug_omitted', legacyIds: rows.map((row) => String(row.id)) });
  }
  for (const roaster of source.tables.roasters) {
    const id = String(roaster.id);
    const health = quality.byRoaster.find((row) => row.roaster.id === roaster.id)!;
    const trustedHosts = new Set<string>();
    for (const url of [roaster.website_url, roaster.shop_url]) {
      if (!text(url)) continue;
      const host = new URL(canonicalizeUrl(String(url))).hostname;
      trustedHosts.add(host); trustedHosts.add(host.replace(/^www\./, '')); trustedHosts.add(`www.${host.replace(/^www\./, '')}`);
    }
    add('roasters', { id, slug: String(roaster.slug), name: String(roaster.name), website_url: canonicalizeUrl(String(roaster.website_url)),
      city: text(roaster.city), adapter: String(roaster.platform), trusted_hosts_json: json([...trustedHosts].sort()),
      active: roaster.is_active === true ? 1 : 0, last_attempt_at: health.lastAttempt ? date(health.lastAttempt, source.completedAt) : null,
      last_success_at: health.lastSuccess ? date(health.lastSuccess, source.completedAt) : null,
      crawl_health: health.runs[0]?.status === 'success' ? 'success' : health.runs.length ? 'failed' : 'unknown', revision: 0,
      created_at: date(roaster.created_at, source.startedAt), updated_at: date(roaster.updated_at, source.startedAt) });
    map('roaster', id, id, roaster);
  }
  for (const legacy of source.tables.coffees) {
    const legacyId = String(legacy.id);
    const roasterId = String(legacy.roaster_id);
    const roaster = byRoaster.get(roasterId);
    if (!roaster) throw new Error(`Unmapped legacy roaster for coffee ${legacyId}`);
    const canonicalUrl = canonicalizeUrl(String(legacy.product_url));
    const oldSourceId = text(legacy.external_id);
    if (!oldSourceId) throw new Error(`Legacy coffee has no stable external ID: ${legacyId}`);
    // Proven adapter transformation: Parsa embedded catalog emits native N; legacy adapter prefixed catalog-N.
    const sourceProductId = roaster.slug === 'parsa' && /^catalog-\d+$/.test(oldSourceId) ? oldSourceId.slice('catalog-'.length) : oldSourceId;
    const identityKey = productIdentity({ sourceProductId, canonicalUrl });
    const canonicalId = await stableId('coffee', roasterId, identityKey);
    const offerKey = `options:legacy:${legacyId}`;
    const offerId = await stableId('offer', canonicalId, offerKey);
    const observationId = await stableId('legacy-observation', legacyId);
    const runId = await stableId('legacy-observation-run', legacyId);
    const observed = date(legacy.last_seen_at, date(legacy.last_scraped_at, ''));
    if (!observed) throw new Error(`No genuine observation timestamp for legacy coffee ${legacyId}`);
    const firstSeen = date(legacy.created_at, observed);
    const priceMinor = typeof legacy.price_amount === 'number' && legacy.price_amount > 0 ? toMinorUnits(legacy.price_amount) : null;
    const weightG = typeof legacy.weight_grams === 'number' && Number.isSafeInteger(legacy.weight_grams) && legacy.weight_grams > 0 ? legacy.weight_grams : null;
    const currency = text(legacy.price_currency)?.toUpperCase() ?? null;
    if (currency !== null && !/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid legacy currency: ${legacyId}`);
    const inStock = typeof legacy.is_available === 'boolean' ? Number(legacy.is_available) : null;
    const excludedProductType = excludedLegacyProductName(String(legacy.name));
    const visibility = !quarantine.has(legacyId) && !excludedProductType && legacy.is_public === true && legacy.specialty_status === 'specialty' ? 'public' : 'hidden';
    const raw = {
      region: text(legacy.origin_region), producer: text(legacy.origin_producer), farm: text(legacy.origin_farm), altitude: text(legacy.origin_altitude),
      process: text(legacy.process_detail), tastingNotes: Array.isArray(legacy.flavor_notes) ? legacy.flavor_notes : [],
      harvestYear: text(legacy.harvest_year), roastDate: text(legacy.roast_date), imageUrl: text(legacy.image_url),
      brewRecipes: Array.isArray(legacy.brew_recipes) ? legacy.brew_recipes : [],
      sourceData: { legacySource: 'supabase', legacyId, legacy: legacy, importWarnings: quarantine.has(legacyId) ? ['duplicate_url_identity_requires_review'] : [],
        fieldProvenance: 'Legacy extracted source fields; not independently verified. Normalized fields retained separately as legacy rule features.' },
    };
    add('coffees', { id: canonicalId, roaster_id: roasterId, source_product_id: sourceProductId, identity_key: identityKey,
      canonical_url: canonicalUrl, name: String(legacy.name), slug: stableSlug(String(legacy.name), canonicalId), raw_metadata_json: json(raw), visibility,
      first_seen_at: firstSeen, last_seen_at: observed, discontinued_at: null, created_at: firstSeen, updated_at: date(legacy.updated_at, observed) });
    const alias = (type: 'source' | 'url' | 'slug', value: string) => add('coffee_aliases', { roaster_id: roasterId, alias_type: type, alias: value, coffee_id: canonicalId, created_at: source.completedAt });
    alias('source', sourceProductId);
    if (oldSourceId !== sourceProductId) alias('source', oldSourceId);
    if (!quarantine.has(legacyId)) alias('url', canonicalUrl);
    if (text(legacy.slug) && aliasWinners.get(String(legacy.slug)) === legacyId && !quarantine.has(legacyId)) alias('slug', String(legacy.slug));
    add('offers', { id: offerId, coffee_id: canonicalId, source_variant_id: null, identity_key: offerKey, label: 'Legacy package — SKU unverified',
      weight_g: weightG, currency, current_price_minor: priceMinor, compare_at_price_minor: null, in_stock: inStock,
      purchase_url: canonicalUrl, first_seen_at: firstSeen, last_seen_at: observed, last_price_change_at: null, retired_at: null,
      created_at: firstSeen, updated_at: date(legacy.updated_at, observed) });
    add('crawl_runs', { id: runId, roaster_id: roasterId, started_at: observed, completed_at: observed, status: 'success', mode: 'import',
      parser_version: VERSION, products_seen: 1, offers_seen: 1,
      diagnostics_json: json([{ stage: 'migration', code: 'legacy_flattened_offer', message: 'One source snapshot; exact SKU and earlier price history unknown.' }]),
      input_hash: hash(legacy), created_at: source.completedAt });
    add('price_observations', { id: observationId, offer_id: offerId, crawl_run_id: runId, price_minor: priceMinor, compare_at_minor: null,
      currency, weight_g: weightG, in_stock: inStock, observed_at: observed, source: 'import' });
    for (const [column, feature] of Object.entries(featureFields)) if (present(legacy[column])) add('coffee_feature_values', {
      coffee_id: canonicalId, feature, value_json: json(legacy[column]), source_type: 'RULE_INFERRED', confidence: null,
      version: 'legacy-unversioned-v1', source_reference: `supabase:coffees:${legacyId}:${column}`, created_at: observed, updated_at: observed,
    });
    map('coffee', legacyId, canonicalId, legacy);
    map('offer', legacyId, offerId, { legacyId, oldSourceId, weightG, uncertainty: 'no source variant ID retained' });
    plan.coffeeMappings.push({ legacyId, canonicalId, offerId, observationId, priceMinor, weightG, currency, sourceProductId });
  }
  // Preserve evidence and operational history without claiming these were new successful crawls.
  for (const [table, rows] of Object.entries(source.tables)) {
    // Current raw_metadata_json changes on source crawls; the original coffee payload needs its own archive too.
    for (const row of rows) {
      const id = table === 'lot_organizations' ? json([row.lot_id, row.organization_id, row.role]) : String(row.id);
      add('legacy_traceability', { source_table: table, legacy_id: id, payload_json: json(row), imported_at: source.completedAt });
    }
  }
  map('snapshot', 'catalog-seed-v1', sourceHash, { version: VERSION, project: source.projectRef, tableHashes: source.tableSha256 });
  plan.expected.coffee_events = 0;
  if (new Set(plan.coffeeMappings.map((row) => row.canonicalId)).size !== plan.coffeeMappings.length) throw new Error('Source normalization would merge distinct coffee identities');
  return plan;
}

export function sqlLiteral(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Nonfinite SQL number'); return String(value); }
  if (value.includes('\0')) throw new Error('NUL bytes are unsupported in SQL import');
  return `'${value.replace(/'/g, "''")}'`;
}
export function migrationSql(plan: MigrationPlan) {
  const quotedHash = sqlLiteral(plan.sourceHash);
  const guard = `INSERT INTO ingestion_guards(run_id,valid) VALUES('legacy-seed-import',CASE WHEN EXISTS(SELECT 1 FROM legacy_id_map WHERE source_system='supabase' AND entity_type='snapshot' AND legacy_id='catalog-seed-v1' AND canonical_id=${quotedHash}) OR (NOT EXISTS(SELECT 1 FROM legacy_id_map WHERE entity_type='snapshot') AND NOT EXISTS(SELECT 1 FROM coffees)) THEN 1 ELSE 0 END);`;
  const inserts = plan.rows.map(({ table, values }) => `INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.values(values).map(sqlLiteral).join(',')}) ON CONFLICT DO NOTHING;`);
  // D1's bulk import provides its transaction; explicit BEGIN/COMMIT are intentionally omitted from this artifact.
  return [`-- ${VERSION}; source checksum ${plan.sourceHash}; preserve private ignored artifact`, guard, ...inserts,
    "DELETE FROM ingestion_guards WHERE run_id='legacy-seed-import';", ''].join('\n');
}

/** Additive repair for the already imported seed. Apply as one atomic D1 bulk import. */
export function coffeeArchiveBackfillSql(plan: MigrationPlan) {
  const guard = `INSERT INTO ingestion_guards(run_id,valid) VALUES('legacy-coffee-archive',CASE WHEN EXISTS(SELECT 1 FROM legacy_id_map WHERE source_system='supabase' AND entity_type='snapshot' AND legacy_id='catalog-seed-v1' AND canonical_id=${sqlLiteral(plan.sourceHash)}) THEN 1 ELSE 0 END);`;
  const inserts = plan.rows.filter(row => row.table === 'legacy_traceability' && row.values.source_table === 'coffees')
    .map(({ values }) => `INSERT INTO legacy_traceability (${Object.keys(values).join(',')}) VALUES (${Object.values(values).map(sqlLiteral).join(',')}) ON CONFLICT DO NOTHING;`);
  return [`-- Additive original coffee archive; source checksum ${plan.sourceHash}`, guard, ...inserts,
    "DELETE FROM ingestion_guards WHERE run_id='legacy-coffee-archive';", ''].join('\n');
}

/** Reviewed single-record repair. The persistent marker prevents replay overwriting later decisions. */
export function descafecolVisibilityRepairSql(plan: MigrationPlan) {
  const legacyId = 'b2c54bd1-f95f-43a3-9aa9-a6fe40ba1fed';
  const mapping = plan.coffeeMappings.find(row => row.legacyId === legacyId);
  if (!mapping) return '-- Reviewed DESCAFECOL record is not present in this snapshot; no repair.\n';
  const coffee = plan.rows.find(row => row.table === 'coffees' && row.values.id === mapping.canonicalId)!.values;
  const archive = plan.rows.find(row => row.table === 'legacy_traceability' && row.values.source_table === 'coffees' && row.values.legacy_id === legacyId)!.values;
  const legacy = JSON.parse(String(archive.payload_json));
  if (legacy.name !== 'DESCAFECOL DECAF' || legacy.external_id !== '8278173483194' || legacy.is_public !== true || legacy.specialty_status !== 'specialty' || coffee.visibility !== 'public') throw new Error('Reviewed visibility repair source evidence changed');
  const repairId = 'descafecol-cafec-boundary-v1';
  const marker = `EXISTS(SELECT 1 FROM legacy_id_map WHERE source_system='supabase' AND entity_type='repair' AND legacy_id=${sqlLiteral(repairId)} AND canonical_id=${sqlLiteral(mapping.canonicalId)})`;
  const eligible = `EXISTS(SELECT 1 FROM coffees WHERE id=${sqlLiteral(mapping.canonicalId)} AND source_product_id='8278173483194' AND name='DESCAFECOL DECAF' AND raw_metadata_json=${sqlLiteral(coffee.raw_metadata_json)} AND updated_at=${sqlLiteral(coffee.updated_at)} AND visibility IN ('hidden','public'))`;
  return [
    `-- Reviewed CAFEC word-boundary correction; source checksum ${plan.sourceHash}; atomic import required.`,
    `INSERT INTO ingestion_guards(run_id,valid) VALUES('descafecol-visibility-repair',CASE WHEN EXISTS(SELECT 1 FROM legacy_id_map WHERE source_system='supabase' AND entity_type='snapshot' AND legacy_id='catalog-seed-v1' AND canonical_id=${sqlLiteral(plan.sourceHash)}) AND (${marker} OR ${eligible}) THEN 1 ELSE 0 END);`,
    `UPDATE coffees SET visibility='public' WHERE id=${sqlLiteral(mapping.canonicalId)} AND visibility='hidden' AND NOT ${marker};`,
    `INSERT INTO legacy_id_map(source_system,entity_type,legacy_id,canonical_id,source_hash,imported_at) VALUES('supabase','repair',${sqlLiteral(repairId)},${sqlLiteral(mapping.canonicalId)},${sqlLiteral(plan.sourceHash)},${sqlLiteral(plan.sourceCompletedAt)}) ON CONFLICT DO NOTHING;`,
    "DELETE FROM ingestion_guards WHERE run_id='descafecol-visibility-repair';", '',
  ].join('\n');
}

export function applyMigrationPlan(db: DatabaseSync, plan: MigrationPlan) {
  db.exec('BEGIN IMMEDIATE');
  try { db.exec(migrationSql(plan)); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function initializeLocalSchema(db: DatabaseSync) {
  db.exec('PRAGMA foreign_keys=ON');
  const hasCatalog = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roasters'").get();
  db.exec('CREATE TABLE IF NOT EXISTS local_source_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)');
  for (const file of readdirSync(resolve('migrations/d1')).filter((name) => name.endsWith('.sql')).sort()) {
    const content = readFileSync(resolve('migrations/d1', file), 'utf8');
    const digest = createHash('sha256').update(content).digest('hex');
    const previous = db.prepare('SELECT sha256 FROM local_source_migrations WHERE name=?').get(file);
    if (previous) { if (previous.sha256 !== digest) throw new Error(`Applied local migration changed: ${file}`); continue; }
    // Compatibility for this tool's first 0001-only local staging run. Never applies to a remote database.
    if (!(hasCatalog && file === '0001_catalog.sql')) db.exec(content);
    db.prepare('INSERT INTO local_source_migrations(name,sha256) VALUES(?,?)').run(file, digest);
  }
}

export function reconcileMigration(db: DatabaseSync, plan: MigrationPlan) {
  const counts = Object.fromEntries(Object.keys(plan.expected).map((table) => [table, Number(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count)]));
  const repairLedgerCount = Number(db.prepare("SELECT count(*) AS count FROM legacy_id_map WHERE source_system='supabase' AND entity_type='repair'").get()!.count);
  for (const [table, planned] of Object.entries(plan.expected)) {
    const expected = planned + (table === 'legacy_id_map' ? repairLedgerCount : 0);
    if (counts[table] !== expected) throw new Error(`Reconciliation count mismatch ${table}: expected ${expected}, got ${counts[table]}`);
  }
  const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeys.length) throw new Error('Foreign key reconciliation failed');
  for (const mapping of plan.coffeeMappings) {
    const coffee = db.prepare('SELECT source_product_id,raw_metadata_json FROM coffees WHERE id=?').get(mapping.canonicalId);
    const offer = db.prepare('SELECT current_price_minor,weight_g,currency FROM offers WHERE id=?').get(mapping.offerId);
    const observation = db.prepare('SELECT price_minor,weight_g,currency,source FROM price_observations WHERE id=?').get(mapping.observationId);
    const legacyId = coffee ? JSON.parse(String(coffee.raw_metadata_json)).sourceData.legacyId : null;
    const retainedLegacy = coffee ? JSON.parse(String(coffee.raw_metadata_json)).sourceData.legacy : null;
    const sourceMap = db.prepare("SELECT source_hash FROM legacy_id_map WHERE source_system='supabase' AND entity_type='coffee' AND legacy_id=?").get(mapping.legacyId);
    if (legacyId !== mapping.legacyId || coffee?.source_product_id !== mapping.sourceProductId || offer?.current_price_minor !== mapping.priceMinor || offer?.weight_g !== mapping.weightG || offer?.currency !== mapping.currency
      || hash(retainedLegacy) !== sourceMap?.source_hash || observation?.price_minor !== mapping.priceMinor || observation?.weight_g !== mapping.weightG || observation?.currency !== mapping.currency || observation?.source !== 'import') throw new Error(`Source sample reconciliation mismatch: ${mapping.legacyId}`);
  }
  for (const row of plan.rows.filter((row) => row.table === 'legacy_traceability')) {
    const stored = db.prepare('SELECT payload_json FROM legacy_traceability WHERE source_table=? AND legacy_id=?').get(row.values.source_table, row.values.legacy_id);
    if (stored?.payload_json !== row.values.payload_json) throw new Error(`Archived source payload mismatch: ${row.values.source_table}:${row.values.legacy_id}`);
  }
  const queryPlans = {
    offers: db.prepare("EXPLAIN QUERY PLAN SELECT * FROM offers WHERE coffee_id=? AND in_stock=1 AND retired_at IS NULL").all(plan.coffeeMappings[0]?.canonicalId ?? ''),
    history: db.prepare('EXPLAIN QUERY PLAN SELECT * FROM price_observations WHERE offer_id=? ORDER BY observed_at DESC').all(plan.coffeeMappings[0]?.offerId ?? ''),
    events: db.prepare("EXPLAIN QUERY PLAN SELECT * FROM coffee_events WHERE type='PRICE_DROP' ORDER BY created_at DESC LIMIT 20").all(),
  };
  return { counts, canonicalCurrent: db.prepare('SELECT * FROM catalog_counts').get(), foreignKeyViolations: foreignKeys.length,
    reconciledCoffeeSamples: plan.coffeeMappings.length, repairLedgerCount, sourceHash: plan.sourceHash, warnings: plan.warnings, queryPlans };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) => { const index = args.indexOf(name); return resolve(index < 0 ? fallback : args[index + 1]); };
  const sourcePath = option('--source', '.local/v2/source.json');
  const databasePath = option('--database', '.local/v2/migration.sqlite');
  const sqlPath = option('--sql', '.local/v2/import.sql');
  const reportPath = option('--report', '.local/v2/migration-report.json');
  const archiveSqlPath = option('--archive-sql', '.local/v2/coffee-archive-backfill.sql');
  const repairSqlPath = option('--repair-sql', '.local/v2/descafecol-visibility-repair.sql');
  for (const path of [databasePath, sqlPath, reportPath, archiveSqlPath, repairSqlPath]) if (!path.startsWith(resolve('.local') + '/')) throw new Error('Migration output must stay inside ignored .local/');
  const source = readSourceSnapshot(sourcePath);
  const plan = await createMigrationPlan(source);
  for (const path of [databasePath, sqlPath, reportPath, archiveSqlPath, repairSqlPath]) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  try {
    initializeLocalSchema(db);
    applyMigrationPlan(db, plan);
    if (args.includes('--repair-visibility')) {
      db.exec('BEGIN IMMEDIATE');
      try { db.exec(descafecolVisibilityRepairSql(plan)); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    const first = reconcileMigration(db, plan);
    applyMigrationPlan(db, plan);
    const second = reconcileMigration(db, plan);
    if (JSON.stringify(first.counts) !== JSON.stringify(second.counts)) throw new Error('Replay changed migration counts');
    writeFileSync(sqlPath, migrationSql(plan), { mode: 0o600 });
    writeFileSync(archiveSqlPath, coffeeArchiveBackfillSql(plan), { mode: 0o600 });
    writeFileSync(repairSqlPath, descafecolVisibilityRepairSql(plan), { mode: 0o600 });
    writeFileSync(reportPath, json({ sourceCompletedAt: source.completedAt, verifiedAt: new Date().toISOString(),
      sqlSha256: createHash('sha256').update(migrationSql(plan)).digest('hex'),
      archiveSqlPath, archiveSqlSha256: createHash('sha256').update(coffeeArchiveBackfillSql(plan)).digest('hex'),
      repairSqlPath, repairSqlSha256: createHash('sha256').update(descafecolVisibilityRepairSql(plan)).digest('hex'),
      migrations: db.prepare('SELECT * FROM local_source_migrations ORDER BY name').all(), first, second, replayUnchanged: true }) + '\n', { mode: 0o600 });
    console.log(json({ databasePath, sqlPath, reportPath, counts: second.counts, current: second.canonicalCurrent, samples: second.reconciledCoffeeSamples, replayUnchanged: true }));
  } finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error: Error) => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
