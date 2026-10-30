import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const text = (path: string) => readFileSync(join(root, path), 'utf8');
const parse = (path: string) => JSON.parse(text(path).replace(/^\s*\/\/.*$/gm, ''));
const guard = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [join(root, 'scripts/production-guard.mjs'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });

test('production web Worker: own names and bindings, signups and sponsorships off, nothing from staging', () => {
  const staging = parse('wrangler.jsonc'), production = parse('wrangler.production.jsonc');
  assert.equal(production.name, 'coffeedb-v2-web');
  assert.equal(production.vars.DEPLOYMENT_STAGE, 'production');
  assert.equal(production.vars.SIGNUPS_ENABLED, 'false');
  assert.equal(production.vars.NEXT_PUBLIC_SPONSORSHIPS_ENABLED, undefined);
  assert.equal(production.vars.NEXT_PUBLIC_SITE_URL, undefined, 'the deploy script supplies the site address');
  assert.equal(staging.vars.SIGNUPS_ENABLED, 'false');
  assert.doesNotMatch(text('wrangler.production.jsonc'), /staging|5090f52d|008e6a1f|\b100[12]\b/i);
  const stagingNamespaces = staging.ratelimits.map((limiter: { namespace_id: string }) => limiter.namespace_id);
  for (const limiter of production.ratelimits) assert.ok(!stagingNamespaces.includes(limiter.namespace_id));
  assert.equal(production.d1_databases[0].binding, 'DB');
  // Everything outside names, identifiers and vars is the same as staging.
  const rest = ({ name, d1_databases, vars, analytics_engine_datasets, ratelimits, ...other }: Record<string, unknown>) => (void name, void d1_databases, void vars, void analytics_engine_datasets, void ratelimits, other);
  assert.deepEqual(rest(production), rest(staging));
  assert.deepEqual(production.ratelimits.map(({ namespace_id, ...limiter }: Record<string, unknown>) => (void namespace_id, limiter)), staging.ratelimits.map(({ namespace_id, ...limiter }: Record<string, unknown>) => (void namespace_id, limiter)));
});

test('production crawler Worker: disabled, no cron, own queues, DLQ variable matches the consumer', () => {
  const staging = parse('wrangler.crawler.jsonc'), production = parse('wrangler.crawler.production.jsonc');
  assert.equal(production.name, 'coffeedb-v2-crawler');
  assert.equal(production.vars.CRAWLS_ENABLED, 'false');
  assert.equal(production.vars.CRAWL_MODE, 'baseline');
  assert.deepEqual(production.triggers.crons, []);
  assert.doesNotMatch(text('wrangler.crawler.production.jsonc'), /staging|5090f52d/i);
  const [main, dlq] = production.queues.consumers;
  assert.equal(production.vars.CRAWL_DLQ_QUEUE, main.dead_letter_queue);
  assert.equal(dlq.queue, main.dead_letter_queue);
  assert.equal(production.queues.producers[0].queue, main.queue);
  assert.equal(production.d1_databases[0].database_name, parse('wrangler.production.jsonc').d1_databases[0].database_name);
  assert.equal(staging.queues.consumers.length, production.queues.consumers.length);
});

test('the guard refuses placeholders and a missing or staging site address, and passes once everything is filled', () => {
  const folder = mkdtempSync(join(tmpdir(), 'guard-'));
  for (const file of ['wrangler.production.jsonc', 'wrangler.crawler.production.jsonc']) {
    const path = join(folder, `placeholder-${file}`);
    writeFileSync(path, text(file).replace(/("database_id":\s*)"[^"]*"/, '$1"REPLACE_WITH_PRODUCTION_D1_DATABASE_ID"'));
    const refused = guard([path]);
    assert.equal(refused.status, 1, file);
    assert.match(refused.stderr, /REPLACE_WITH_PRODUCTION_D1_DATABASE_ID is still a placeholder/);
  }
  const filled = (file: string) => { const path = join(folder, file); writeFileSync(path, text(file).replace(/REPLACE_[A-Z0-9_]+/g, 'filled-in')); return path; };
  const web = filled('wrangler.production.jsonc'), crawler = filled('wrangler.crawler.production.jsonc');
  assert.equal(guard([web, crawler]).status, 0);
  for (const url of [undefined, '', 'https://coffeedb-v2-web-staging.hellobasalt.workers.dev', 'http://kahve.test', 'https://kahve.test/', 'https://kahve.test/path']) {
    assert.equal(guard(['--site-url', web], url === undefined ? {} : { NEXT_PUBLIC_SITE_URL: url }).status, 1, String(url));
  }
  assert.equal(guard(['--site-url', web], { NEXT_PUBLIC_SITE_URL: 'https://kahve.test' }).status, 0);
  assert.equal(guard([]).status, 1);
});

test('every production deploy and migrate script runs the guard first', () => {
  const scripts = JSON.parse(text('package.json')).scripts as Record<string, string>;
  for (const name of ['db:migrate:production', 'deploy:production', 'deploy:crawler:production', 'ci:build', 'ci:deploy']) assert.match(scripts[name], /^node scripts\/production-guard\.mjs /, name);
  for (const name of ['deploy:production', 'ci:deploy']) assert.match(scripts[name], /production-guard\.mjs --site-url dist\/server\/wrangler\.json && wrangler deploy/, name);
  assert.equal(scripts['db:migrate:staging'], 'wrangler d1 migrations apply coffeedb-v2-staging --remote');
});
