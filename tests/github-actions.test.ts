import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('GitHub Actions workflows', () => {
  it('keeps scheduled scrape runs resilient to known external roaster outages', () => {
    const source = readSource('.github/workflows/scrape.yml');

    assert.match(source, /ALLOW_ROASTER_FAILURES/);
    assert.match(source, /parsa/);
    assert.match(source, /story/);
    assert.match(source, /milestones/);
    assert.match(source, /github\.event_name == 'schedule'/);
  });

  it('keeps CI and scraper workflows aligned to the checked-in Node version', () => {
    const ci = readSource('.github/workflows/ci.yml');
    const scrape = readSource('.github/workflows/scrape.yml');

    assert.match(ci, /node-version-file: \.nvmrc/);
    assert.match(scrape, /node-version-file: \.nvmrc/);
    assert.match(ci, /npm ci/);
    assert.match(scrape, /npm ci/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
