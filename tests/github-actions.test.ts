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

  it('purges the edge only after a step that wrote tonight\'s data succeeded', () => {
    const source = readSource('.github/workflows/scrape.yml');
    const purge = source.slice(source.indexOf('- name: Purge the edge cache'));
    assert.match(source, /id: refresh\n/);
    assert.match(source, /id: corrections\n/);
    // With the database out of its allowance both writers fail; a purge then would swap every good page for an outage notice.
    assert.match(purge, /if: \$\{\{ !cancelled\(\) && \(steps\.refresh\.outcome == 'success' \|\| steps\.corrections\.outcome == 'success'\) \}\}/);
    assert.match(purge, /secrets\.CACHE_PURGE_TOKEN/);
    // Bot Fight Mode answers GitHub's runners 403 on the site, so the purge goes through the crawler Worker's /site route.
    assert.match(purge, /"\$\{SITE_VIA%\/\}\/api\/cache"/);
    assert.doesNotMatch(purge, /\$\{SITE_URL%\/\}\/api\/cache/);
    assert.match(source, /SITE_VIA: \$\{\{ vars\.SITE_VIA \|\| 'https:\/\/coffeedb-v2-crawler-staging\.hellobasalt\.workers\.dev\/site' \}\}/);
  });

  it('keeps CI and scraper workflows aligned to the checked-in Node version', () => {
    const ci = readSource('.github/workflows/ci.yml');
    const scrape = readSource('.github/workflows/scrape.yml');

    assert.match(ci, /node-version-file: \.nvmrc/);
    assert.match(scrape, /node-version-file: \.nvmrc/);
    assert.match(ci, /npm ci/);
    assert.match(scrape, /npm ci/);
  });

  it('creates only a weekly Kit draft with read-only permissions', () => {
    const digest = readSource('.github/workflows/digest.yml');
    assert.match(digest, /cron: '0 3 \* \* 1'/);
    assert.match(digest, /contents: read/);
    assert.match(digest, /node-version-file: \.nvmrc/);
    assert.match(digest, /v2-digest\.mts --create-draft/);
    assert.match(digest, /KIT_API_KEY: \$\{\{ secrets\.KIT_API_KEY \}\}/);
  });

  it('drafts the monthly issue on a merge to main or by hand, never on a schedule', () => {
    const issue = readSource('.github/workflows/monthly-issue.yml');
    assert.match(issue, /paths:\n\s+- 'content\/bulten\/\*\*'/);
    assert.match(issue, /branches:\n\s+- main/);
    assert.match(issue, /workflow_dispatch:\n\s+inputs:\n\s+month:/);
    assert.doesNotMatch(issue, /schedule:|cron:/);
    assert.match(issue, /contents: read/);
    assert.match(issue, /v2-digest\.mts --issue "\$month" --create-draft/);
    // User input reaches the shell only through env, never interpolated into the script.
    assert.doesNotMatch(issue.split('run: |')[1].split('- name:')[0], /\$\{\{/);
    assert.match(readSource('.github/workflows/digest.yml'), /cron: '0 3 \* \* 1'/);
  });

  it('exports a weekly read-only D1 backup kept as a private 14-day artifact (two weekly copies)', () => {
    const backup = readSource('.github/workflows/d1-backup.yml');
    assert.match(backup, /contents: read/);
    assert.match(backup, /wrangler d1 export "\$D1_DATABASE_NAME" --remote --output d1-backup\.sql > \/dev\/null/);
    assert.match(backup, /D1_DATABASE_NAME: \$\{\{ vars\.D1_DATABASE_NAME \|\| 'coffeedb-v2-staging' \}\}/);
    assert.match(backup, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_D1_API_TOKEN \}\}/);
    assert.match(backup, /retention-days: 14/);
    assert.doesNotMatch(backup, /d1 execute|migrations apply/);
  });

  it('persists the Next.js build cache between CI runs', () => {
    const ci = readSource('.github/workflows/ci.yml');

    assert.match(ci, /actions\/cache@[a-f0-9]{40} # v6\.1\.0/);
    assert.match(ci, /\.next\/cache/);
    assert.match(ci, /restore-keys/);
    assert.match(ci, /hashFiles\('package-lock\.json'\)/);
  });
});

describe('workflow database targets', () => {
  // Today's behaviour must not change: with no repository variable set, every workflow still targets staging.
  it('take the database from repository variables and default to the staging values', () => {
    for (const file of ['scrape.yml', 'digest.yml', 'monthly-issue.yml']) {
      assert.match(readSource(`.github/workflows/${file}`), /CLOUDFLARE_D1_DATABASE_ID: \$\{\{ vars\.CLOUDFLARE_D1_DATABASE_ID \|\| '5090f52d-546e-4ba6-bdcd-b4ee531a29a3' \}\}/, file);
    }
    assert.match(readSource('.github/workflows/scrape.yml'), /CRAWL_RELAY_URL: \$\{\{ vars\.CRAWL_RELAY_URL \|\| 'https:\/\/coffeedb-v2-crawler-staging\.hellobasalt\.workers\.dev\/relay' \}\}/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
