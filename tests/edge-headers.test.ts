import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createTestHarness, type TestHarness } from 'wrangler';
import nextConfig from '../next.config';
import { contentSecurityPolicy, withScriptNonce } from '../shared/v2/content-security-policy';
import { forwardedRequest, isWorkersDevHost, newNonce } from '../workers/edge-headers';
import { STORED } from './fixtures/edge-headers/stored-page';

const root = new URL('../', import.meta.url).pathname;
const parse = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const scriptSrc = (policy: string) => policy.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('script-src ')) ?? '';

describe('Content-Security-Policy', () => {
  it('has no unsafe-inline in script-src outside development, and keeps the beacon origin', () => {
    const policy = contentSecurityPolicy();
    assert.equal(scriptSrc(policy), "script-src 'self' https://static.cloudflareinsights.com");
    assert.match(policy, /upgrade-insecure-requests$/);
    assert.match(scriptSrc(contentSecurityPolicy({ development: true })), /'unsafe-inline' 'unsafe-eval'/);
  });

  it('next.config sends the shared policy on every route', async () => {
    const rules = await nextConfig.headers!();
    const csp = rules.find((rule) => rule.source === '/(.*)')!.headers.filter((header) => header.key === 'Content-Security-Policy');
    assert.equal(csp.length, 1);
    assert.equal(csp[0].value, contentSecurityPolicy());
  });

  it('withScriptNonce swaps unsafe-inline for the nonce and leaves every other directive as it was', () => {
    const legacy = contentSecurityPolicy().replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    const stamped = withScriptNonce(legacy, 'abc+/=');
    assert.equal(scriptSrc(stamped), "script-src 'self' 'nonce-abc+/=' https://static.cloudflareinsights.com");
    const others = (policy: string) => policy.split('; ').filter((directive) => !directive.startsWith('script-src '));
    assert.deepEqual(others(stamped), others(legacy));
    assert.equal(scriptSrc(withScriptNonce(stamped, 'second')), "script-src 'self' 'nonce-second' https://static.cloudflareinsights.com", 'an old nonce is replaced, never added to');
    assert.match(withScriptNonce("default-src 'self'", 'n'), /script-src 'self' 'nonce-n'/);
  });

  it('nonces are 128 random bits in base64 and differ every time', () => {
    const nonces = new Set(Array.from({ length: 1000 }, () => newNonce()));
    assert.equal(nonces.size, 1000);
    for (const nonce of nonces) assert.equal(Buffer.from(nonce, 'base64').byteLength, 16);
  });

  it('workers.dev hosts, and only those, are staging', () => {
    assert.equal(isWorkersDevHost('https://coffeedb-v2-web-staging.hellobasalt.workers.dev/kahveler'), true);
    assert.equal(isWorkersDevHost('https://1a2b3c4d-coffeedb-v2-web.hellobasalt.workers.dev/'), true);
    assert.equal(isWorkersDevHost('https://kahve.hellobasalt.dev/'), false);
    assert.equal(isWorkersDevHost('https://workers.dev.example.com/'), false);
  });

  it('page requests reach the cache without validators; other requests are untouched', () => {
    const page = new Request('https://kahve.hellobasalt.dev/', { headers: { accept: 'text/html,*/*', 'if-none-match': '"x"', 'if-modified-since': 'Mon, 19 Oct 2026 00:00:00 GMT' } });
    const forwarded = forwardedRequest(page);
    assert.equal(forwarded.headers.get('if-none-match'), null);
    assert.equal(forwarded.headers.get('if-modified-since'), null);
    const json = new Request('https://kahve.hellobasalt.dev/api/since', { headers: { accept: 'application/json', 'if-none-match': '"x"' } });
    assert.equal(forwardedRequest(json), json);
  });
});

describe('both web Worker configs: uncached gateway in front of the cached app', () => {
  for (const file of ['wrangler.jsonc', 'wrangler.production.jsonc']) it(file, () => {
    const config = parse(file);
    assert.equal(config.main, 'workers/web.ts');
    assert.deepEqual(config.cache, { enabled: true });
    assert.deepEqual(config.exports, { default: { type: 'worker', cache: { enabled: false } }, App: { type: 'worker', cache: { enabled: true } } });
  });
});

// The real HTMLRewriter, in workerd, through Wrangler's local test harness. The fixture Worker stands in for Workers
// Cache: it hands the gateway the very same stored page every time (tests/fixtures/edge-headers/worker.ts).
describe('gateway in workerd', () => {
  let server: TestHarness;
  before(async () => {
    server = createTestHarness({ root, workers: [{ config: { name: 'edge-headers-test', main: 'tests/fixtures/edge-headers/worker.ts', compatibility_date: '2026-09-14' } }] });
    await server.listen();
  });
  after(async () => { await server?.close(); });
  const mf = { dispatchFetch: (url: string, init?: RequestInit) => server.fetch(url, init) };

  const page = async (url: string) => {
    const response = await mf.dispatchFetch(url, { headers: { accept: 'text/html' } });
    const html = await response.text();
    const csp = response.headers.get('content-security-policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? '';
    return { response, html, csp, nonce, tags: html.match(/<script\b[^>]*>/g) ?? [] };
  };

  it('every response gets a fresh nonce, on the one CSP header and on every inline script', async () => {
    const first = await page('https://kahve.hellobasalt.dev/');
    const second = await page('https://kahve.hellobasalt.dev/');
    assert.notEqual(first.nonce, second.nonce, 'the same stored page leaves with a different nonce each time');
    for (const { csp, nonce, tags, html } of [first, second]) {
      assert.equal(Buffer.from(nonce, 'base64').byteLength, 16);
      assert.equal(csp.match(/default-src/g)?.length, 1, 'exactly one policy');
      assert.equal(scriptSrc(csp), `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com`);
      assert.doesNotMatch(scriptSrc(csp), /unsafe-inline/);
      const inline = tags.filter((tag) => !/\ssrc=/.test(tag));
      assert.equal(inline.length, 4);
      for (const tag of inline) assert.ok(tag.includes(`nonce="${nonce}"`), tag);
      assert.ok(!tags.find((tag) => /\ssrc=/.test(tag))!.includes('nonce='), 'scripts from self need no nonce');
      assert.ok(!html.includes('nonce="stale"'));
      assert.equal(html.replace(/ nonce="[^"]*"/g, ''), STORED.replace(/ nonce="[^"]*"/g, ''), 'nothing else in the page changes');
    }
  });

  it('HTML loses its validators and may not be kept by a shared cache', async () => {
    const { response } = await page('https://kahve.hellobasalt.dev/');
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('last-modified'), null);
    assert.equal(response.headers.get('cache-control'), 'private, max-age=0, must-revalidate');
  });

  it('X-Robots-Tag noindex, nofollow on workers.dev, pages and JSON alike; none on the custom domain', async () => {
    for (const path of ['/', '/api/since']) {
      const staging = await mf.dispatchFetch(`https://coffeedb-v2-web-staging.hellobasalt.workers.dev${path}`);
      assert.equal(staging.headers.get('x-robots-tag'), 'noindex, nofollow', path);
      await staging.arrayBuffer();
      const production = await mf.dispatchFetch(`https://kahve.hellobasalt.dev${path}`);
      assert.equal(production.headers.get('x-robots-tag'), null, path);
      await production.arrayBuffer();
    }
  });

  it('a non-HTML response on the custom domain passes through untouched', async () => {
    const json = await mf.dispatchFetch('https://kahve.hellobasalt.dev/api/since');
    assert.deepEqual(await json.json(), { ok: true });
    assert.doesNotMatch(json.headers.get('content-security-policy') ?? '', /nonce-/);
  });
});

describe('static files on workers.dev', () => {
  it('public/_headers marks every workers.dev host noindex, nofollow and nothing else', () => {
    const rules = readFileSync(join(root, 'public/_headers'), 'utf8').split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    assert.deepEqual(rules, ['https://:worker.:account.workers.dev/*', '  X-Robots-Tag: noindex, nofollow']);
  });
});
