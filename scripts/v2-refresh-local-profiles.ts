/** Feature maintenance from an already-observed capture. No ingestion, fetch, new runs or observations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { canonicalizeUrl, offerIdentity, toMinorUnits } from '../shared/v2/identity';
import type { FeatureValue, SourceCoffee } from '../shared/v2/types';

const SOURCE_SLUGS = ['petra', 'daphne', 'parsa'] as const;
export const PROFILE_KEYS = ['normalized_origin', 'process_family', 'roast_classification', 'flavor_notes_normalized', 'flavor_families', 'normalized_variety', 'brew_compatibility', 'is_decaf'] as const;
const profileSet = new Set<string>(PROFILE_KEYS);
const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
type Row = Record<string, string | number | null>;
export interface ProfileCapture { sha256: string; file: string; summary: { slug: string; startedAt: string; completedAt: string }; snapshot: { complete: boolean; parserVersion: string; products: SourceCoffee[] } }
interface FeatureRow extends Record<string, string | number | null> { coffee_id: string; feature: string; value_json: string; source_type: string; confidence: number | null; version: string; source_reference: string | null; created_at: string; updated_at: string }
const owned = (row: FeatureRow) => row.source_type === 'RULE_INFERRED' && profileSet.has(row.feature);
const featureTuple = (row: FeatureRow) => [row.feature, JSON.parse(row.value_json), row.source_type, row.confidence, row.version, row.source_reference];
const desiredTuple = (feature: FeatureValue) => [feature.feature, feature.value, feature.sourceType, feature.confidence, feature.version, feature.sourceReference ?? null];
export function planProfileRefresh(sqlite: DatabaseSync, captures: ProfileCapture[]) {
  const seen = new Set<string>();
  return captures.map(capture => {
    assert(SOURCE_SLUGS.some(slug => slug === capture.summary.slug), 'Source is not an applied local baseline');
    assert(capture.snapshot.complete && capture.snapshot.products.length > 0, 'A complete nonempty capture is required');
    assert.equal(capture.snapshot.parserVersion, 'v2-source-3-profile');
    const observedAt = new Date(capture.summary.startedAt).toISOString();
    const roaster = sqlite.prepare('SELECT id FROM roasters WHERE slug=?').get(capture.summary.slug) as Row | undefined;
    assert(roaster, 'Roaster missing');
    const baseline = sqlite.prepare("SELECT id FROM crawl_runs WHERE roaster_id=? AND started_at=? AND status='success' AND mode='baseline'").get(roaster.id, observedAt);
    assert(baseline, `Original successful baseline is missing: ${capture.summary.slug}`);
    const products = capture.snapshot.products.map(product => {
      const matches = sqlite.prepare('SELECT * FROM coffees WHERE roaster_id=? AND source_product_id=? AND canonical_url=?').all(roaster.id, product.sourceProductId, canonicalizeUrl(product.canonicalUrl)) as Row[];
      assert.equal(matches.length, 1, `Capture identity mismatch: ${product.name}`);
      const current = matches[0]; const id = String(current.id); assert(!seen.has(id), 'Duplicate capture coffee'); seen.add(id);
      assert.equal(current.last_seen_at, observedAt, `Newer/different observation: ${product.name}`);
      assert.equal(current.name, product.name.trim(), `Current name changed: ${product.name}`);
      assert.equal(current.visibility, product.visibility ?? 'unclassified', `Eligibility differs: ${product.name}`);
      assert.equal(current.discontinued_at, null, `Coffee discontinued: ${product.name}`);
      const rawHash = hash(JSON.stringify(product.rawMetadata));
      assert.equal(hash(current.raw_metadata_json), rawHash, `Raw capture hash differs: ${product.name}`);
      const offers = sqlite.prepare('SELECT * FROM offers WHERE coffee_id=? AND retired_at IS NULL').all(id) as Row[];
      const sourceTuple = product.offers.map(offer => [offerIdentity(offer), offer.sourceVariantId, offer.label, offer.weightG, offer.currency?.trim().toUpperCase() ?? null, toMinorUnits(offer.price), toMinorUnits(offer.compareAtPrice), offer.inStock == null ? null : Number(offer.inStock), canonicalizeUrl(offer.purchaseUrl)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const actualTuple = offers.map(offer => [offer.identity_key, offer.source_variant_id, offer.label, offer.weight_g, offer.currency, offer.current_price_minor, offer.compare_at_price_minor, offer.in_stock, offer.purchase_url]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      assert.deepEqual(actualTuple, sourceTuple, `Current offers differ from captured observation: ${product.name}`);
      assert(offers.every(offer => offer.last_seen_at === observedAt), 'Current offer observation timestamp differs');
      const allFeatures = sqlite.prepare('SELECT * FROM coffee_feature_values WHERE coffee_id=? ORDER BY feature,source_type').all(id) as FeatureRow[];
      const eligibility = allFeatures.find(feature => feature.feature === 'catalog_eligibility' && feature.source_type === 'RULE_INFERRED');
      const capturedEligibility = product.features?.find(feature => feature.feature === 'catalog_eligibility');
      assert(eligibility && capturedEligibility, 'Eligibility evidence missing');
      assert.deepEqual(featureTuple(eligibility), desiredTuple(capturedEligibility), 'Eligibility evidence changed');
      assert((product.features ?? []).every(feature => feature.sourceType !== 'MANUAL'), 'Capture cannot supply MANUAL features');
      const desired = (product.features ?? []).filter(feature => profileSet.has(feature.feature)).sort((a, b) => a.feature.localeCompare(b.feature));
      assert.equal(new Set(desired.map(feature => feature.feature)).size, desired.length, 'Duplicate profile feature');
      for (const feature of desired) {
        assert.equal(feature.sourceType, 'RULE_INFERRED'); assert.equal(feature.confidence, null);
        assert.equal(feature.version, 'v2-profile-1'); assert.equal(feature.sourceReference, product.canonicalUrl);
      }
      const previous = allFeatures.filter(owned).sort((a, b) => a.feature.localeCompare(b.feature));
      const changed = JSON.stringify(previous.map(featureTuple)) !== JSON.stringify(desired.map(desiredTuple));
      return { coffeeId: id, name: product.name, rawHash, changed, beforeFeatures: previous.length, afterFeatures: desired.length, desired };
    });
    return { slug: capture.summary.slug, file: capture.file, sha256: capture.sha256, observedAt, products };
  });
}
function immutableHash(sqlite: DatabaseSync, targets: string[]): string {
  const targetIds = new Set(targets);
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name<>'coffee_feature_values' ORDER BY name").all();
  const rows = tables.map(table => [table.name, sqlite.prepare(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort()]);
  const protectedFeatures = (sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY coffee_id,feature,source_type').all() as FeatureRow[]).filter(row => !owned(row) || !targetIds.has(row.coffee_id));
  return hash([rows, protectedFeatures]);
}
/** Applies only inside one transaction; caller must make the local backup before invoking. */
export function applyProfileRefresh(sqlite: DatabaseSync, captures: ProfileCapture[], maintainedAt = new Date().toISOString()) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const plan = planProfileRefresh(sqlite, captures); const targets = plan.flatMap(source => source.products.map(product => product.coffeeId)); const before = immutableHash(sqlite, targets);
    let changedProducts = 0;
    for (const source of plan) for (const product of source.products) if (product.changed) {
      changedProducts++;
      const old = sqlite.prepare('SELECT * FROM coffee_feature_values WHERE coffee_id=?').all(product.coffeeId) as FeatureRow[];
      sqlite.prepare(`DELETE FROM coffee_feature_values WHERE coffee_id=? AND source_type='RULE_INFERRED' AND feature IN (${PROFILE_KEYS.map(() => '?').join(',')})`).run(product.coffeeId, ...PROFILE_KEYS);
      for (const feature of product.desired) {
        const previous = old.find(row => owned(row) && row.feature === feature.feature);
        sqlite.prepare('INSERT INTO coffee_feature_values VALUES(?,?,?,?,?,?,?,?,?)').run(product.coffeeId, feature.feature, JSON.stringify(feature.value), 'RULE_INFERRED', null, feature.version, feature.sourceReference ?? null, previous?.created_at ?? maintainedAt, maintainedAt);
      }
    }
    assert.equal(immutableHash(sqlite, targets), before, 'A protected table or feature changed');
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    const replay = planProfileRefresh(sqlite, captures); assert(replay.every(source => source.products.every(product => !product.changed)), 'Refresh is not idempotent');
    sqlite.exec('COMMIT'); return { changedProducts, immutableHash: before, plan };
  } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
}
function loadCaptures(root: string): ProfileCapture[] {
  const directory = realpathSync(resolve(root, '.local/v2/crawls')) + sep;
  const manifest = JSON.parse(readFileSync(resolve(directory, 'qualification.json'), 'utf8')) as { qualified: Array<{ slug: string; captureFile: string }> };
  return SOURCE_SLUGS.map(slug => {
    const entries = manifest.qualified.filter(entry => entry.slug === slug); assert.equal(entries.length, 1);
    const file = realpathSync(entries[0].captureFile); assert(file.startsWith(directory), 'Capture must be local to this project');
    const text = readFileSync(file, 'utf8'); const capture = JSON.parse(text) as ProfileCapture;
    assert.equal(capture.summary.slug, slug); return { ...capture, file, sha256: hash(text) };
  });
}
export function refreshLocalProfiles(path: string, apply = false, root = process.cwd()) {
  const directory = realpathSync(resolve(root, '.wrangler')) + sep;
  assert(existsSync(path), 'Existing local database required');
  const databasePath = realpathSync(path); assert(databasePath.startsWith(directory) && databasePath.endsWith('.sqlite'), 'Only this project existing .wrangler SQLite is accepted');
  const captures = loadCaptures(root);
  const sqlite = new DatabaseSync(databasePath, { readOnly: !apply });
  try {
    const plan = planProfileRefresh(sqlite, captures); // Validate every product before any write/backup.
    let backupPath: string | null = null;
    let applied: ReturnType<typeof applyProfileRefresh> | null = null;
    if (apply) {
      backupPath = resolve(root, '.local/v2', `wrangler-before-profile-refresh-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
      sqlite.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`); chmodSync(backupPath, 0o600);
      applied = applyProfileRefresh(sqlite, captures);
    }
    return { mode: apply ? 'apply' : 'dry-run', databasePath, backupPath, checkedAt: new Date().toISOString(),
      changedProducts: applied?.changedProducts ?? plan.flatMap(source => source.products).filter(product => product.changed).length,
      products: plan.flatMap(source => source.products).length, beforeFeatures: plan.flatMap(source => source.products).reduce((sum, product) => sum + product.beforeFeatures, 0), afterFeatures: plan.flatMap(source => source.products).reduce((sum, product) => sum + product.afterFeatures, 0),
      immutableHash: applied?.immutableHash ?? immutableHash(sqlite, plan.flatMap(source => source.products.map(product => product.coffeeId))), newObservations: 0, newRuns: 0, newEvents: 0, sourceRequests: 0, remoteWrites: 0, plan };
  } finally { sqlite.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); assert(args.every((value, index) => value === '--apply' || value === '--local-db' || args[index - 1] === '--local-db'), 'Use --local-db <path> [--apply]');
  const index = args.indexOf('--local-db'); assert(index >= 0 && args[index + 1], 'Required: --local-db <existing local Wrangler SQLite file> [--apply]');
  const report = refreshLocalProfiles(resolve(args[index + 1]), args.includes('--apply'));
  writeFileSync(resolve('.local/v2', `profile-refresh-${report.mode}.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
