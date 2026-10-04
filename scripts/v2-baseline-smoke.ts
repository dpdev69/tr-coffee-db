/** Offline P5 acceptance: real ingestion on a disposable copy; no network or credentials. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import type { CatalogDatabase, SqlValue, Statement } from '../shared/v2/database';
import type { CrawlInput, SourceCoffee } from '../shared/v2/types';
import { beginCrawl, ingestCrawl } from '../shared/v2/ingestion';
import { getCatalogCounts, listCatalog, listRoasters } from '../shared/v2/catalog';
import { offerIdentity, stableId, toMinorUnits, unitPriceTry } from '../shared/v2/identity';
import { initializeLocalSchema } from './v2-migrate';

const CAPTURES = [
  '2026-09-14T20-43-14-079Z-petra-reparsed.json',
  '2026-09-14T20-43-14-282Z-parsa-reparsed.json',
  '2026-09-14T20-44-14-843Z-daphne-reparsed.json',
];
interface Capture {
  summary: { slug: string; startedAt: string; completedAt: string };
  snapshot: { roasterSlug: string; parserVersion: string; complete: boolean; products: SourceCoffee[]; diagnostics: CrawlInput['diagnostics'] };
}
type Row = Record<string, SqlValue>;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export class SQLiteD1 implements CatalogDatabase {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string): Statement { return new SQLiteStatement(this.sqlite, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = statements.map(statement => {
        const { sql, values } = statement as SQLiteStatement;
        return this.sqlite.prepare(sql).run(...values);
      });
      this.sqlite.exec('COMMIT'); return result;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
class SQLiteStatement implements Statement {
  values: SqlValue[] = [];
  constructor(readonly sqlite: DatabaseSync, readonly sql: string) {}
  bind(...values: SqlValue[]) { this.values = values; return this; }
  async first<T>() { return (this.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  async all<T>() { return { results: this.sqlite.prepare(this.sql).all(...this.values) as T[], success: true }; }
}
const rows = (db: DatabaseSync, sql: string, ...values: SqlValue[]) => db.prepare(sql).all(...values) as Row[];
const scalar = (db: DatabaseSync, sql: string, ...values: SqlValue[]) => Number(db.prepare(sql).get(...values)?.count);
const importObservations = (db: DatabaseSync) => rows(db, "SELECT * FROM price_observations WHERE source='import' ORDER BY id");
function evidenceHash(db: DatabaseSync) {
  const tables = ['roasters', 'coffees', 'offers', 'price_observations', 'crawl_runs', 'coffee_events', 'coffee_aliases', 'coffee_feature_values', 'crawl_errors'];
  return sha(JSON.stringify(tables.map(table => [table, rows(db, `SELECT * FROM ${table}`).map(row => JSON.stringify(row)).sort()])));
}
async function canonicalCheck(db: SQLiteD1) {
  const counts = await getCatalogCounts(db);
  const all = [];
  for (let page = 1; ; page++) {
    const result = await listCatalog(db, { page, perPage: 100 });
    assert.equal(result.total, counts.coffees);
    all.push(...result.coffees);
    if (page >= result.totalPages) break;
  }
  assert.equal(new Set(all.map(coffee => coffee.id)).size, counts.coffees);
  assert.equal(all.length, counts.coffees);
  assert.equal(new Set(all.map(coffee => coffee.roaster.id)).size, counts.roasters);
  assert.equal(all.flatMap(coffee => coffee.offers).filter(offer => offer.inStock === true).length, counts.offers);
  for (const offer of all.flatMap(coffee => coffee.offers)) {
    if (offer.weightG === null || offer.priceMinor === null || offer.currency !== 'TRY') assert.equal(offer.unitPriceTry, null);
    else assert.equal(offer.unitPriceTry, unitPriceTry(offer.priceMinor, offer.weightG, offer.currency));
  }
  const roasters = await listRoasters(db);
  assert.equal(roasters.length, counts.roasters);
  assert.equal(roasters.reduce((sum, roaster) => sum + roaster.coffeeCount, 0), counts.coffees);
  assert.equal(roasters.reduce((sum, roaster) => sum + roaster.offerCount, 0), counts.offers);
  return counts;
}

export async function baselineSmoke(root = process.cwd(), allQualified = false) {
  const qualificationPath = resolve(root, '.local/v2/crawls/qualification.json');
  const qualificationText = allQualified ? readFileSync(qualificationPath, 'utf8') : null;
  const qualification = qualificationText ? JSON.parse(qualificationText) as {
    createdAt: string; meaning: string; qualified: Array<{ slug: string; captureFile: string; complete: boolean }>;
  } : null;
  const captures = qualification ? qualification.qualified.map(entry => {
    assert.equal(entry.complete, true);
    // Only inspect the saved local capture, never a path supplied outside the capture directory.
    return basename(entry.captureFile);
  }) : CAPTURES;
  assert.equal(new Set(captures).size, captures.length);
  if (qualification) assert.equal(captures.length, 14, 'Re-review qualification scope before broadening beyond the accepted fourteen sources.');
  const outputStem = allQualified ? 'baseline-smoke-qualified' : 'baseline-smoke';
  const sourcePath = resolve(root, '.local/v2/migration.sqlite');
  const outputPath = resolve(root, `.local/v2/${outputStem}.sqlite`);
  assert(!existsSync(`${sourcePath}-wal`), 'Close the migration DB/checkpoint WAL before copying.');
  const originalHash = sha(readFileSync(sourcePath));
  copyFileSync(sourcePath, outputPath);
  const sqlite = new DatabaseSync(outputPath);
  const db = new SQLiteD1(sqlite);
  try {
    initializeLocalSchema(sqlite);
    sqlite.exec('PRAGMA foreign_keys=ON');
    const originalObservations = importObservations(sqlite);
    assert.equal(originalObservations.length, 1030);
    const originalArchiveHash = sha(JSON.stringify(rows(sqlite, 'SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id')));
    const originalCoffeeCount = scalar(sqlite, 'SELECT count(*) AS count FROM coffees');
    const archivedCoffeePayloads = scalar(sqlite, "SELECT count(*) AS count FROM legacy_traceability WHERE source_table='coffees'");
    assert.equal(archivedCoffeePayloads, originalCoffeeCount);
    const archiveRows = scalar(sqlite, 'SELECT count(*) AS count FROM legacy_traceability');
    const before = await canonicalCheck(db);
    const beforeVisibleIds = new Set(rows(sqlite, 'SELECT id FROM public_catalog_coffees').map(coffee => coffee.id));
    const beforeVisibility = new Map(rows(sqlite, 'SELECT id,visibility FROM coffees').map(coffee => [coffee.id, coffee.visibility]));
    const results = [];
    const preservedExclusions: Array<{ roaster: string; name: string; sourceProductId: string; reason: string }> = [];
    for (const name of captures) {
      const captureText = readFileSync(resolve(root, '.local/v2/crawls', name), 'utf8');
      const capture = JSON.parse(captureText) as Capture;
      assert.equal(capture.snapshot.complete, true);
      const roaster = sqlite.prepare('SELECT id FROM roasters WHERE slug=?').get(capture.summary.slug);
      assert(roaster);
      const roasterId = String(roaster.id);
      const originals = capture.snapshot.products.map(product => {
        const coffee = sqlite.prepare('SELECT * FROM coffees WHERE roaster_id=? AND source_product_id=?').get(roasterId, product.sourceProductId) as Row | undefined;
        assert(coffee, `Missing imported source identity: ${capture.summary.slug}/${product.sourceProductId}`);
        const legacy = rows(sqlite, "SELECT * FROM offers WHERE coffee_id=? AND identity_key LIKE 'options:legacy:%'", coffee.id);
        assert.equal(legacy.length, 1);
        if (product.visibility === 'hidden' && coffee.visibility === 'hidden') {
          const original = JSON.parse(String(coffee.raw_metadata_json)).sourceData.legacy;
          preservedExclusions.push({ roaster: capture.summary.slug, name: String(coffee.name), sourceProductId: String(coffee.source_product_id), reason: original.specialty_rejection_reason ?? 'other' });
        }
        return { coffee, product, legacy: legacy[0] };
      });
      const observedIds = new Set(originals.map(({ coffee }) => coffee.id));
      const absentCoffees = rows(sqlite, 'SELECT * FROM coffees WHERE roaster_id=? ORDER BY id', roasterId).filter(coffee => !observedIds.has(coffee.id));
      const absentIds = new Set(absentCoffees.map(coffee => coffee.id));
      const absentOffers = rows(sqlite, 'SELECT o.* FROM offers o JOIN coffees c ON c.id=o.coffee_id WHERE c.roaster_id=? ORDER BY o.id', roasterId).filter(offer => absentIds.has(offer.coffee_id));
      const expectedOffers = capture.snapshot.products.flatMap(product => product.offers);
      const input: CrawlInput = {
        id: `p5-baseline-${capture.summary.slug}-${sha(captureText).slice(0, 16)}`,
        jobKey: `p5-baseline-${capture.summary.slug}-${capture.summary.startedAt}`,
        roasterId, startedAt: capture.summary.startedAt, completedAt: capture.summary.completedAt,
        status: 'success', parserVersion: capture.snapshot.parserVersion, products: capture.snapshot.products,
        diagnostics: capture.snapshot.diagnostics, mode: 'baseline',
      };
      assert.deepEqual(await beginCrawl(db, input), { status: 'running', existed: false });
      const result = await ingestCrawl(db, input);
      assert.equal(result.events, 0);
      assert.equal(result.coffees, originals.length);
      assert.equal(result.offers, expectedOffers.length);
      let replacedLegacyRawPayloads = 0;
      for (const { coffee, product, legacy } of originals) {
        const current = sqlite.prepare('SELECT * FROM coffees WHERE id=?').get(coffee.id) as Row;
        for (const key of ['id', 'slug', 'first_seen_at', 'source_product_id']) assert.equal(current[key], coffee[key]);
        assert.equal(sqlite.prepare('SELECT retired_at FROM offers WHERE id=?').get(legacy.id)?.retired_at, input.startedAt);
        assert.equal(scalar(sqlite, 'SELECT count(*) AS count FROM offers WHERE coffee_id=? AND retired_at IS NULL', coffee.id), product.offers.length);
        if (JSON.parse(String(coffee.raw_metadata_json)).sourceData?.legacy && !JSON.parse(String(current.raw_metadata_json)).sourceData?.legacy) replacedLegacyRawPayloads++;
        for (const offer of product.offers) {
          const id = await stableId('offer', String(coffee.id), offerIdentity(offer));
          const row = sqlite.prepare('SELECT * FROM offers WHERE id=?').get(id) as Row | undefined;
          assert(row); assert.notEqual(row.id, legacy.id);
          assert.equal(row.source_variant_id, offer.sourceVariantId);
          assert.equal(row.current_price_minor, toMinorUnits(offer.price));
          assert.equal(row.weight_g, offer.weightG);
          assert.equal(row.currency, offer.currency);
          assert.equal(row.in_stock, offer.inStock === null ? null : Number(offer.inStock));
          if (offer.weightG === null) assert.equal(unitPriceTry(Number(row.current_price_minor), null, String(row.currency)), null);
          assert.equal(scalar(sqlite, "SELECT count(*) AS count FROM price_observations WHERE offer_id=? AND source='import'", id), 0);
          assert.equal(scalar(sqlite, "SELECT count(*) AS count FROM price_observations WHERE offer_id=? AND source='crawl'", id), 1);
        }
      }
      assert.deepEqual(rows(sqlite, 'SELECT * FROM coffees WHERE roaster_id=? ORDER BY id', roasterId).filter(coffee => absentIds.has(coffee.id)), absentCoffees);
      assert.deepEqual(rows(sqlite, 'SELECT o.* FROM offers o JOIN coffees c ON c.id=o.coffee_id WHERE c.roaster_id=? ORDER BY o.id', roasterId).filter(offer => absentIds.has(offer.coffee_id)), absentOffers);
      const committedHash = evidenceHash(sqlite);
      assert.deepEqual(await beginCrawl(db, input), { status: 'success', existed: true });
      assert.equal((await ingestCrawl(db, input)).replayed, true);
      assert.equal(evidenceHash(sqlite), committedHash);
      assert.deepEqual(importObservations(sqlite), originalObservations);
      results.push({ slug: capture.summary.slug, capture: `.local/v2/crawls/${name}`, sha256: sha(captureText), startedAt: input.startedAt,
        completedAt: input.completedAt, parserVersion: input.parserVersion, coffees: result.coffees, offers: result.offers,
        inStock: expectedOffers.filter(offer => offer.inStock === true).length,
        unknownPrice: expectedOffers.filter(offer => offer.price === null).length,
        unknownWeight: expectedOffers.filter(offer => offer.weightG === null).length,
        unknownStock: expectedOffers.filter(offer => offer.inStock === null).length,
        retiredLegacyOffers: originals.length, replacedLegacyRawPayloads, replayEvidenceHashUnchanged: true,
        absentCoffeesUnchanged: absentCoffees.length, absentOffersUnchanged: absentOffers.length,
        absentInStockOffersPreserved: absentOffers.filter(offer => offer.in_stock === 1 && offer.retired_at === null).length });
    }
    assert.equal(scalar(sqlite, 'SELECT count(*) AS count FROM coffees'), originalCoffeeCount);
    assert.equal(scalar(sqlite, 'SELECT count(*) AS count FROM coffee_events'), 0);
    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), []);
    assert.equal(sha(JSON.stringify(rows(sqlite, 'SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id'))), originalArchiveHash);
    const duplicateActiveOffers = rows(sqlite, 'SELECT coffee_id,identity_key,count(*) AS count FROM offers WHERE retired_at IS NULL GROUP BY coffee_id,identity_key HAVING count(*)>1');
    const duplicateSourceVariants = rows(sqlite, 'SELECT coffee_id,source_variant_id,count(*) AS count FROM offers WHERE retired_at IS NULL AND source_variant_id IS NOT NULL GROUP BY coffee_id,source_variant_id HAVING count(*)>1');
    assert.deepEqual(duplicateActiveOffers, []); assert.deepEqual(duplicateSourceVariants, []);
    const after = await canonicalCheck(db);
    const afterVisibleIds = new Set(rows(sqlite, 'SELECT id FROM public_catalog_coffees').map(coffee => coffee.id));
    const visibilityBridge = {
      publicToHidden: rows(sqlite, "SELECT id FROM coffees WHERE visibility='hidden'").filter(coffee => beforeVisibility.get(coffee.id) === 'public').length,
      hiddenToPublic: rows(sqlite, "SELECT id FROM coffees WHERE visibility='public'").filter(coffee => beforeVisibility.get(coffee.id) === 'hidden').length,
      becameCurrent: [...afterVisibleIds].filter(id => !beforeVisibleIds.has(id)).length,
      leftCurrent: [...beforeVisibleIds].filter(id => !afterVisibleIds.has(id)).length,
    };
    assert.equal(visibilityBridge.hiddenToPublic, 0, 'Unreviewed publication expansion in baseline capture');
    assert.equal(visibilityBridge.publicToHidden, 0, 'Unreviewed visibility loss in baseline capture');
    const visibilityChanges = rows(sqlite, `SELECT c.id,c.name,c.source_product_id,r.slug AS roaster,a.payload_json
      FROM coffees c JOIN roasters r ON r.id=c.roaster_id
      JOIN legacy_id_map m ON m.canonical_id=c.id AND m.entity_type='coffee' AND m.source_system='supabase'
      JOIN legacy_traceability a ON a.source_table='coffees' AND a.legacy_id=m.legacy_id
      WHERE c.visibility='public' ORDER BY r.slug,c.name`).filter(coffee => beforeVisibility.get(coffee.id) === 'hidden').map(coffee => {
        const legacy = JSON.parse(String(coffee.payload_json)) as Record<string, unknown>;
        return { coffeeId: coffee.id, roaster: coffee.roaster, name: coffee.name, sourceProductId: coffee.source_product_id,
          legacyPublic: legacy.is_public, legacySpecialtyStatus: legacy.specialty_status,
          legacyRejectionReason: legacy.specialty_rejection_reason ?? 'none',
          legacySignals: legacy.specialty_signals, currentlyAvailable: afterVisibleIds.has(coffee.id) };
      });
    const archivedManualOverrides = scalar(sqlite, "SELECT count(*) AS count FROM legacy_traceability WHERE source_table='coffee_specialty_overrides'");
    const report = { checkedAt: new Date().toISOString(), scope: allQualified ? 'fourteen-qualified-captures' : 'three-original-captures',
      qualification: qualification ? { createdAt: qualification.createdAt, meaning: qualification.meaning, sha256: sha(qualificationText!) } : null,
      sourceDatabase: '.local/v2/migration.sqlite', outputDatabase: `.local/v2/${outputStem}.sqlite`,
      sourceDatabaseSha256: originalHash, before, after, visibilityBridge, visibilityChanges, preservedExclusions, archivedManualOverrides,
      results, importedObservations: originalObservations.length,
      importedObservationsSha256: sha(JSON.stringify(originalObservations)), immutableImportObservationsUnchanged: true,
      archiveUnchanged: true, archivedCoffeePayloads, archiveRows, sourceDatabaseUnchanged: sha(readFileSync(sourcePath)) === originalHash,
      totalCoffees: originalCoffeeCount, totalOffers: scalar(sqlite, 'SELECT count(*) AS count FROM offers'),
      totalObservations: scalar(sqlite, 'SELECT count(*) AS count FROM price_observations'), events: 0, foreignKeyViolations: 0,
      duplicateActiveOffers: 0, duplicateActiveSourceVariants: 0, absentProductStateUnchanged: true, unknownUnitPricesRemainNull: true };
    assert.equal(report.sourceDatabaseUnchanged, true);
    writeFileSync(resolve(root, `.local/v2/${outputStem}-report.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    mkdirSync(resolve(root, 'docs/evidence'), { recursive: true });
    const total = (key: 'coffees' | 'offers' | 'unknownWeight' | 'unknownPrice' | 'unknownStock' | 'absentCoffeesUnchanged' | 'absentInStockOffersPreserved') => results.reduce((sum, result) => sum + result[key], 0);
    const table = results.map(r => `| ${r.slug} | ${r.coffees} | ${r.offers} | ${r.inStock} | ${r.unknownWeight} | ${r.absentCoffeesUnchanged} | ${r.absentInStockOffersPreserved} |`).join('\n');
    const exclusionTable = preservedExclusions.map(row => `| ${row.roaster} | ${row.name.replaceAll('|', '\\|')} | ${row.sourceProductId} | ${row.reason} | hidden |`).join('\n');
    writeFileSync(resolve(root, 'docs/evidence/p5-baseline.md'), `# P5 captured baseline acceptance

Checked ${report.checkedAt}. Scope: **${results.length} saved source captures**. This is offline SQLite integration using the real shared ingestion engine and catalog readers. No network, credentials or remote mutations were used.

| Source | Matched coffees | Actual source offers | In stock | Unknown weight | Absent coffees retained | Absent in-stock offers retained |
|---|---:|---:|---:|---:|---:|---:|
${table}

All ${total('coffees')} captured coffees matched imported source identities, including Parsa's explicit catalog-ID mapping. IDs, slugs and first-seen dates stayed stable. Exactly ${total('coffees')} ambiguous legacy offers were retired; their observations remained attached to their original IDs. Each of ${total('offers')} source offers has one new source observation and zero inherited import observations. No coffee was duplicated, and no observed coffee retained a legacy offer alongside its actual source offers.

Unknown weights: ${total('unknownWeight')}; unknown prices: ${total('unknownPrice')}; unknown stock: ${total('unknownStock')}. Unknown weight remains SQL NULL and produces a NULL unit price. Captured prices, currencies, weights and stock states were checked field-by-field against every stored offer. Duplicate active offer identity groups: **0**; duplicate active source-variant groups: **0**.

Absence safety: all columns of ${total('absentCoffeesUnchanged')} absent coffee rows and their offers remained unchanged, including ${total('absentInStockOffersPreserved')} previously in-stock offers. A product missing from a complete capture did not become unavailable or receive an artificial retirement. This preserves source uncertainty; absence is not independent proof that retained stock is current.

All 1,030 import observations are byte-for-byte equivalent as ordered JSON before and after ingestion. Their SHA-256 is \`${report.importedObservationsSha256}\`. All ${archiveRows.toLocaleString('en-US')} archived source rows are unchanged, including all ${archivedCoffeePayloads.toLocaleString('en-US')} original coffee payloads. Successful source crawls replace current raw metadata; the separate archive preserves its original legacy version.

Final database: ${report.totalCoffees} coffees, ${report.totalOffers} offers including retired, ${report.totalObservations} observations and **zero events**. Foreign-key checks passed. Exact replay through both beginCrawl and ingestCrawl returned completed/replayed status and left the hash of all ingestion tables unchanged.

Canonical counts, every paginated catalog row and offer, and aggregated roaster counts reconcile: before ${before.coffees} coffees / ${before.roasters} roasters / ${before.offers} in-stock offers; after ${after.coffees} / ${after.roasters} / ${after.offers}. These are whole-database counts; other imported roasters retain their previous state.

Visibility bridge: ${visibilityBridge.hiddenToPublic} previously hidden imported coffees became public under the captured source classifiers; ${visibilityBridge.becameCurrent} coffees entered the available catalog and ${visibilityBridge.leftCurrent} left it. These are existing identities, not newly discovered coffees. Storage invariants do not independently establish whether every classification is appropriate; relevance review remains separate.

## Reproduce

Run with Node 22 or later from the coffee directory:

\`\`\`sh
# Original Petra/Parsa/Daphne scope remains the default.
node --import tsx scripts/v2-baseline-smoke.ts
# All fourteen accepted entries in the local qualification manifest.
node --import tsx scripts/v2-baseline-smoke.ts --qualified
\`\`\`

Both modes start with a fresh copy of the ignored migration database. Default output is \`.local/v2/baseline-smoke.sqlite\`; qualified output is \`.local/v2/baseline-smoke-qualified.sqlite\`. Each mode has its own corresponding \`-report.json\` with capture hashes, original timestamps, parser versions and exact metrics. Running either regenerates this Markdown report for that scope. All sorted D1 migrations are applied to the disposable copy. Source database SHA-256 remained \`${originalHash}\`; it was not modified.

## Scope and remaining gates

Qualification means a read-only single source run was complete and reviewed against captured-response legacy replay; it is not repeated-cycle or production certification. This script consumes the already qualified list and does not independently certify source-parser correctness. Qualification manifest: ${qualification ? qualification.createdAt + ', SHA-256 ' + sha(qualificationText!) : 'not used by the default three-source mode'}.

These assertions exercise SQLite atomic batches and actual shared application code. They do not prove remote D1 behavior, scheduled Queue delivery or the live site's user flows. Remote archive backfill was verified by the deployment owner separately; this script has no remote access. Remote Queue baseline and UI checks remain separate gates. Captures establish evidence at their recorded September 14 timestamps and are not new live crawls. No historical SKU prices were recovered or inferred.

## Significant visibility difference: investigated and corrected

The first fourteen-source run revealed fifty hidden-to-public changes: 35 legacy generic-blend exclusions, 14 broad-catalog exclusions, and Montag DESCAFECOL DECAF. This was a classifier-policy regression, not recovered objective metadata. The source snapshot contains ${archivedManualOverrides} manual specialty overrides and no override signals among those fifty rows, so no actual force-exclude/admin record was lost in this snapshot.

The corrected captures use parser version \`v2-source-2-eligibility\`. The adapter now applies the legacy specialty eligibility rules separately from raw facts, including the explicit filter-paper regression. All ${preservedExclusions.length} affected policy exclusions in this scope remain hidden. This run asserts both **zero hidden-to-public transitions and zero public-to-hidden transitions** against the corrected seed. These checks prevent a technically successful import from silently publishing reclassified products.

Concrete non-coffee defect corrected: A Roasting Lab source \`7667514540074\`, “Coffee Filters Brown Filtre Kahve Kağıdı 4 Numara (80 Adet)”. Its source describes filter papers and tags equipment/accessories. The earlier general filter matched “filtre kağıdı” but missed “filtre kahve kağıdı”. The reparsed snapshot retains the source evidence and offers with hidden visibility. Daphne's generic “Türk Kahvesi” likewise remains hidden, including in the default three-source mode; its sold-out state previously hid this regression from headline counts.

Montag DESCAFECOL DECAF (source \`8278173483194\`) is a separate reviewed false-positive correction: the archived source is already public/specialty. The old importer matched equipment brand “cafec” inside “descafecol”. The importer now uses a word boundary for this brand. The seed is 480 current coffees: 411 original fresh legacy-visible records + one reviewed DESCAFECOL recovery + 68 retained stale records. The targeted correction updates only visibility, requires the exact source checksum and unchanged imported metadata/timestamp, and stores a repair marker so replay cannot override later decisions. Its twelve migration tests pass. This smoke consumes that corrected seed.

The corrected fourteen-source run adds one current coffee through actual SKU availability, not classification: Coffeenutz “Kolombiya La Sirena Honey Peach” has unavailable source SKU \`50077231776048\` and available SKU \`67409137041712\`, whereas the legacy synthetic offer was unavailable. Baseline mode produces no RESTOCKED or NEW event.

Manual visibility persistence beyond this migration is a separate schema/engine concern: the source contract and current coffee table do not identify a dedicated manual publication override. A future manual hide needs an explicit persistence rule. This report does not claim that future admin overrides are verified or that publication of the wider allowlist has been approved.

| Roaster | Previously excluded product | Source product ID | Archived rejection | Corrected capture visibility |
|---|---|---|---|---|
${exclusionTable}

`);
    return report;
  } finally { sqlite.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await baselineSmoke(process.cwd(), process.argv.includes('--qualified')), null, 2));
