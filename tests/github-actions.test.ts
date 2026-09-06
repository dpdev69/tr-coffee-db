import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('GitHub Actions workflows', () => {
  it('keeps scheduled scrape runs resilient to known external roaster outages', () => {
    const source = readSource('.github/workflows/scrape.yml');

    assert.match(source, /ALLOW_ROASTER_FAILURES/);
    assert.match(source, /SCRAPE_MAX_ATTEMPTS/);
    assert.match(source, /MIN_SCRAPE_SUCCESS_RATE/);
    assert.doesNotMatch(source, /SKIP_ROASTERS:/);
    assert.match(source, /0\.90/);
    assert.match(source, /parsa/);
    assert.match(source, /story/);
    assert.match(source, /milestones/);
    assert.match(source, /cho-coffee/);
    assert.match(source, /github\.event_name == 'schedule'/);
    assert.match(source, /github\.event\.inputs\.roasters == ''/);
    assert.match(source, /if: \$\{\{ always\(\) \}\}/);
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
