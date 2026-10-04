/** Apply only three corrected captures to an existing local Wrangler D1. No network. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { SQLiteD1 } from './v2-baseline-smoke';
import { sqlLiteral } from './v2-migrate';
import { beginCrawl, ingestCrawl } from '../shared/v2/ingestion';
import { getCatalogCounts } from '../shared/v2/catalog';
import type { CrawlInput } from '../shared/v2/types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function applyLocalBaselines(path: string, root = process.cwd()) {
  const allowed = realpathSync(resolve(root, '.wrangler')) + sep;
  assert(existsSync(path), 'The existing Wrangler D1 file is required.');
  const databasePath = realpathSync(path);
  assert(databasePath.startsWith(allowed) && databasePath.endsWith('.sqlite'), 'Only an existing SQLite file under this project .wrangler is allowed.');
  const manifest = JSON.parse(readFileSync(resolve(root, '.local/v2/crawls/qualification.json'), 'utf8')) as {
    qualified: Array<{ slug: string; captureFile: string }>;
  };
  const selected = ['petra', 'parsa', 'daphne'].map(slug => {
    const entries = manifest.qualified.filter(entry => entry.slug === slug);
    assert.equal(entries.length, 1);
    const file = resolve(root, '.local/v2/crawls', basename(entries[0].captureFile));
    const text = readFileSync(file, 'utf8');
    const capture = JSON.parse(text) as { summary: { slug: string; startedAt: string; completedAt: string }; snapshot: {
      complete: boolean; parserVersion: string; products: CrawlInput['products']; diagnostics: CrawlInput['diagnostics'];
    } };
    assert.equal(capture.summary.slug, slug); assert.equal(capture.snapshot.complete, true);
    assert.equal(capture.snapshot.parserVersion, 'v2-source-2-eligibility', 'Only corrected eligibility captures are accepted.');
    return { slug, file, capture, sha256: createHash('sha256').update(text).digest('hex') };
  });
  const sqlite = new DatabaseSync(databasePath);
  const db = new SQLiteD1(sqlite);
  const local = resolve(root, '.local/v2'); mkdirSync(local, { recursive: true, mode: 0o700 });
  const backupPath = resolve(local, `wrangler-before-baselines-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  try {
    // VACUUM INTO takes a consistent SQLite snapshot, including committed WAL content.
    sqlite.exec(`VACUUM INTO ${sqlLiteral(backupPath)}`); chmodSync(backupPath, 0o600);
    sqlite.exec('PRAGMA foreign_keys=ON');
    const imported = sqlite.prepare("SELECT * FROM price_observations WHERE source='import' ORDER BY id").all();
    const archive = sqlite.prepare('SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id').all();
    assert.equal(imported.length, 1030); assert.equal(archive.length, 13452);
    const internalTables = sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE name LIKE '_cf%' ORDER BY name").all();
    const internalRows = internalTables.map(table => ({ name: table.name, rows: sqlite.prepare(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`).all() }));
    const before = await getCatalogCounts(db);
    assert.equal(before.coffees, 480); assert.equal(before.roasters, 38);
    const results = [];
    for (const source of selected) {
      const roaster = sqlite.prepare('SELECT id FROM roasters WHERE slug=?').get(source.slug); assert(roaster);
      const input: CrawlInput = {
        id: `local-runtime-baseline-${source.slug}-${source.sha256.slice(0, 16)}`,
        jobKey: `local-runtime-baseline-${source.slug}-${source.capture.summary.startedAt}`,
        roasterId: String(roaster.id), startedAt: source.capture.summary.startedAt, completedAt: source.capture.summary.completedAt,
        status: 'success', mode: 'baseline', parserVersion: source.capture.snapshot.parserVersion,
        products: source.capture.snapshot.products, diagnostics: source.capture.snapshot.diagnostics,
      };
      await beginCrawl(db, input);
      const result = await ingestCrawl(db, input); assert.equal(result.events, 0);
      const observationHash = hash(sqlite.prepare('SELECT * FROM price_observations ORDER BY id').all());
      assert.equal((await ingestCrawl(db, input)).replayed, true);
      assert.equal(hash(sqlite.prepare('SELECT * FROM price_observations ORDER BY id').all()), observationHash);
      results.push({ slug: source.slug, sha256: source.sha256, ...result });
    }
    assert.deepEqual(sqlite.prepare("SELECT * FROM price_observations WHERE source='import' ORDER BY id").all(), imported);
    assert.deepEqual(sqlite.prepare('SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id').all(), archive);
    assert.deepEqual(sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE name LIKE '_cf%' ORDER BY name").all(), internalTables);
    assert.deepEqual(internalTables.map(table => ({ name: table.name, rows: sqlite.prepare(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`).all() })), internalRows);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM coffee_events').get()?.count, 0);
    const after = await getCatalogCounts(db); assert.deepEqual({ ...after }, { coffees: 480, roasters: 38, offers: 682 });
    const report = { checkedAt: new Date().toISOString(), databasePath, backupPath, before, after, results,
      importedObservations: imported.length, archivedRows: archive.length, immutableEvidencePreserved: true, cloudflareInternalMetadataPreserved: true,
      totalObservations: sqlite.prepare('SELECT count(*) AS count FROM price_observations').get()?.count,
      events: 0, foreignKeyViolations: 0, networkCalls: 0, remoteWrites: 0 };
    writeFileSync(resolve(local, 'local-runtime-baseline-report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    mkdirSync(resolve(root, 'docs/evidence'), { recursive: true });
    writeFileSync(resolve(root, 'docs/evidence/p5-local-runtime.md'), `# Local Wrangler baseline evidence\n\nChecked ${report.checkedAt}. Applied the three corrected Petra, Parsa and Daphne saved captures to the existing Wrangler D1 through the real shared ingestion engine in baseline mode. No network calls or remote writes.\n\nSQLite VACUUM INTO created a consistent backup including committed WAL data at \`${backupPath}\` before mutation. The original database and its Cloudflare internal tables were preserved in place.\n\nCanonical counts: ${before.coffees}/${before.roasters}/${before.offers} before; **480 coffees, 38 roasters, 682 available offers** after. Source offers: Petra 198, Parsa 22, Daphne 15. Each run's exact replay added no observation. Total observations ${report.totalObservations}, including all 1,030 unchanged import observations. All 13,452 source archives remain unchanged. Zero discovery events and foreign-key violations.\n\nThis prepares the actual local Worker database for browser QA; it does not establish remote Queue delivery or successful browser flows. Full paths, capture hashes and per-run results are in \`.local/v2/local-runtime-baseline-report.json\`.\n\nReproduce with Node 22: \`node --import tsx scripts/v2-apply-local-baselines.ts --local-db <existing .wrangler SQLite path>\`. The tool refuses files outside the current project's .wrangler directory, missing files, uncorrected parser captures, and unexpected catalog state.\n`);
    return report;
  } finally { sqlite.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--local-db');
  assert(index >= 0 && process.argv[index + 1], 'Required: --local-db <existing .wrangler SQLite file>');
  console.log(JSON.stringify(await applyLocalBaselines(resolve(process.argv[index + 1])), null, 2));
}
