import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readSourceSnapshot, redactSourceValue, type SourceSnapshot } from '../scripts/v2-export';
import { analyzeSource, crawlerReport } from '../scripts/v2-quality';

const tableNames = ['roasters', 'coffees', 'coffee_specialty_overrides', 'supply_chain_organizations',
  'coffee_lots', 'trace_sources', 'coffee_claims', 'trace_events', 'coffee_assessments',
  'coffee_certifications', 'lot_organizations', 'scrape_logs'];
function fixture(): SourceSnapshot {
  const tables = Object.fromEntries(tableNames.map((table) => [table, []]));
  return { format: 'coffeedb-legacy-v1', projectRef: 'orwpmyuqkqvlqjhtotou',
    startedAt: '2026-09-14T00:00:00Z', completedAt: '2026-09-14T00:01:00Z',
    consistency: 'ordered-paginated-count-verified-not-transactional', exclusions: [],
    redactedValues: 0, tables, tableCounts: Object.fromEntries(tableNames.map((table) => [table, 0])),
    tableSha256: Object.fromEntries(tableNames.map((table) => [table, createHash('sha256').update('[]').digest('hex')])) };
}

describe('legacy source export safety and quality', () => {
  it('removes email/credentials from nested catalog and diagnostic values while preserving catalog facts', () => {
    const secret = 'a-server-secret-which-must-not-leak';
    const safe = redactSourceValue({ name: 'Etiyopya kahvesi', price_amount: 450, notes: ['contact buyer@example.com'],
      payload: { token: secret, text: `Bearer ${secret}`, url: 'https://user:pass@example.com/product?token=private&variant=123' } }, [secret]);
    const json = JSON.stringify(safe);
    assert.equal(json.includes('buyer@example.com'), false);
    assert.equal(json.includes(secret), false);
    assert.equal(json.includes('user:pass'), false);
    assert.equal(json.includes('token=private'), false);
    assert.ok(json.includes('variant=123'));
    assert.ok(json.includes('Etiyopya kahvesi'));
    assert.ok(json.includes('450'));
  });

  it('rejects altered counts, hashes, unexpected tables and incomplete snapshot schemas', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coffee-source-'));
    const path = join(directory, 'source.json');
    try {
      const source = fixture();
      writeFileSync(path, JSON.stringify(source));
      assert.equal(readSourceSnapshot(path).tables.coffees.length, 0);
      source.tables.coffees.push({ id: 'changed' });
      writeFileSync(path, JSON.stringify(source));
      assert.throws(() => readSourceSnapshot(path), /count mismatch/);
      source.tableCounts.coffees = 1;
      writeFileSync(path, JSON.stringify(source));
      assert.throws(() => readSourceSnapshot(path), /checksum mismatch/);
      const unexpected = fixture();
      unexpected.tables.correction_reports = [];
      writeFileSync(path, JSON.stringify(unexpected));
      assert.throws(() => readSourceSnapshot(path), /allowlist mismatch/);
      delete unexpected.tables.correction_reports;
      delete unexpected.tables.coffees;
      writeFileSync(path, JSON.stringify(unexpected));
      assert.throws(() => readSourceSnapshot(path), /allowlist mismatch/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('separates stale/hidden source rows from current catalog, missing weight, and invalid normalized prices', () => {
    const source = fixture();
    source.tables.roasters = [{ id: 'r', slug: 'r', is_active: true, platform: 'shopify' }];
    const base = { id: 'c', roaster_id: 'r', external_id: '1', name: 'Coffee', product_url: 'https://example.com/coffee',
      is_public: true, specialty_status: 'specialty', is_available: true, last_seen_at: '2026-09-13T00:00:00Z',
      price_amount: 250, price_currency: 'TRY', weight_grams: null, price_per_100g: null };
    source.tables.coffees = [base, { ...base, id: 'stale', external_id: '2', last_seen_at: '2026-08-01T00:00:00Z' },
      { ...base, id: 'hidden', external_id: '3', is_public: false, weight_grams: 250, price_per_100g: 1 }];
    const result = analyzeSource(source);
    assert.equal(result.active.length, 1);
    assert.equal(result.stale.length, 1);
    assert.equal(result.missingActive.weight, 1);
    assert.equal(result.invalidNormalizedPrice.length, 1);
    assert.equal(result.duplicateUrls.length, 1);
    assert.equal(result.duplicateExternalIds.length, 0);
  });

  it('does not report zero observed runs as successful crawler coverage', () => {
    const report = crawlerReport(fixture());
    assert.match(report, /N\/A \(no observed runs\)/);
    assert.doesNotMatch(report, /100\.0%/);
  });
});
