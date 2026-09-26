import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('GitHub Actions workflows', () => {
  it('runs one bounded daily D1 writer and preserves reports on failure', () => {
    const source = readSource('.github/workflows/scrape.yml');
    assert.match(source, /cron: '0 0 \* \* \*'/);
    assert.match(source, /group: d1-catalog-refresh/);
    assert.match(source, /cancel-in-progress: false/);
    assert.match(source, /timeout-minutes: 20/);
    assert.match(source, /CLOUDFLARE_D1_API_TOKEN/);
    assert.match(source, /v2-refresh\.mts/);
    assert.match(source, /if: always\(\)/);
    assert.doesNotMatch(source, /SUPABASE|ALLOW_ROASTER_FAILURES|SKIP_ROASTERS/);
  });

  it('keeps CI and scraper workflows aligned to the checked-in Node version', () => {
    const ci = readSource('.github/workflows/ci.yml');
    const scrape = readSource('.github/workflows/scrape.yml');

    assert.match(ci, /node-version-file: \.nvmrc/);
    assert.match(scrape, /node-version-file: \.nvmrc/);
    assert.match(ci, /npm ci/);
    assert.match(scrape, /npm ci/);
  });

  it('persists the Next.js build cache between CI runs', () => {
    const ci = readSource('.github/workflows/ci.yml');

    assert.match(ci, /actions\/cache@[a-f0-9]{40} # v6\.1\.0/);
    assert.match(ci, /\.next\/cache/);
    assert.match(ci, /restore-keys/);
    assert.match(ci, /hashFiles\('package-lock\.json'\)/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
