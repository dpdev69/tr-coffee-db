import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import type { SourceCoffee } from '../shared/v2/types';
import { REFRESH_SECRETS, rePaste, secretProblem, verifyD1Token } from '../scripts/check-refresh-secrets.mts';
import { explainPurgeResponse, purge } from '../scripts/purge-cache.mts';
import { refreshOutcome, type OutcomeInput } from '../scripts/refresh-outcome.mts';
import { catalogFreshness, refreshSummaryMarkdown, sourceCounts } from '../scripts/v2-refresh.mts';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const TOKEN = 'Ab3_dE5-gH7iJ9kL1mN3oP5qR7sT9uV1wX3yZ5aB'; // 40 characters, the shape of a Cloudflare API token
const HEX = 'a1b2c3d4'.repeat(8); // openssl rand -hex 32
const d1 = { required: true, minLength: 32 };

describe('secrets check', () => {
  it('names what is wrong with a pasted value without ever repeating it', () => {
    const pasted = {
      // The 19 October value: the whole test command from Cloudflare's dashboard instead of the token.
      curlCommand: `curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \\\n-H "Authorization: Bearer ${TOKEN}"`,
      trailingNewline: `${TOKEN}\n`,
      bearerPrefix: `Bearer ${TOKEN}`,
      glued: `Bearer${TOKEN}`,
      quoted: `"${TOKEN}"`,
      cut: TOKEN.slice(0, 20),
      turkishCharacter: `${TOKEN}ı`,
    };
    for (const [name, value] of Object.entries(pasted)) {
      const problem = secretProblem(value, d1);
      assert.ok(problem, name);
      const message = rePaste(REFRESH_SECRETS[0], problem!, { GITHUB_REPOSITORY: 'owner/repo' });
      assert.ok(!message.includes(TOKEN.slice(0, 12)) && !message.includes(TOKEN.slice(-12)), `${name} leaks the token`);
      assert.match(message, /CLOUDFLARE_D1_API_TOKEN/);
      assert.match(message, /Settings > Secrets and variables > Actions/);
      assert.match(message, /https:\/\/github\.com\/owner\/repo\/settings\/secrets\/actions/);
    }
    assert.match(secretProblem(pasted.curlCommand, d1)!, /line break/);
    assert.match(secretProblem(pasted.glued, d1)!, /Bearer/);
  });

  it('accepts real token shapes and lets optional secrets be absent', () => {
    assert.equal(secretProblem(TOKEN, d1), null);
    assert.equal(secretProblem(HEX, { required: false, minLength: 32 }), null);
    assert.equal(secretProblem(undefined, { required: false, minLength: 32 }), null);
    assert.equal(secretProblem('', { required: false, minLength: 32 }), null);
    assert.equal(secretProblem(undefined, d1), 'is not set');
    // The web Worker treats a purge token under 32 characters as not configured.
    assert.match(secretProblem(HEX.slice(0, 31), REFRESH_SECRETS.find(spec => spec.name === 'CACHE_PURGE_TOKEN')!)!, /shorter than 32/);
  });

  it('verifies the D1 token with Cloudflare, falling back to account tokens, and checks the database is visible', async () => {
    const reply = (status: number, body: object) => Response.json(body, { status });
    const fake = (routes: Record<string, () => Response>) => {
      const seen: string[] = [];
      const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${TOKEN}`);
        const path = new URL(String(input)).pathname.replace('/client/v4', ''); seen.push(path);
        const route = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
        return route ? route[1]() : reply(404, { success: false, errors: [{ code: 7404, message: 'not found' }] });
      }) as typeof fetch;
      return { request, seen };
    };
    const account = 'a'.repeat(32), database = '5090f52d-546e-4ba6-bdcd-b4ee531a29a3', now = Date.parse('2026-10-20T00:00:00Z');
    const ok = { '/user/tokens/verify': () => reply(200, { success: true, result: { status: 'active' } }), '/accounts/': () => reply(200, { success: true, result: {} }) };
    assert.deepEqual(await verifyD1Token(TOKEN, account, database, fake(ok).request, now), { errors: [], warnings: [] });

    const accountToken = fake({ '/user/tokens/verify': () => reply(401, { success: false, errors: [{ code: 1000, message: 'Invalid API Token' }] }),
      [`/accounts/${account}/tokens/verify`]: () => reply(200, { success: true, result: { status: 'active', expires_on: '2026-10-25T00:00:00Z' } }),
      [`/accounts/${account}/d1/`]: () => reply(200, { success: true, result: {} }) });
    const checked = await verifyD1Token(TOKEN, account, database, accountToken.request, now);
    assert.deepEqual(checked.errors, []);
    assert.match(checked.warnings[0], /expires on 2026-10-25/);
    assert.deepEqual(accountToken.seen, ['/user/tokens/verify', `/accounts/${account}/tokens/verify`, `/accounts/${account}/d1/database/${database}`]);

    const rejected = await verifyD1Token(TOKEN, account, database, fake({ '/': () => reply(401, { success: false, errors: [{ code: 1000, message: 'Invalid API Token' }] }) }).request, now);
    assert.match(rejected.errors[0], /does not accept CLOUDFLARE_D1_API_TOKEN \(HTTP 401, 1000 Invalid API Token\)/);

    const missingDatabase = await verifyD1Token(TOKEN, account, database, fake({ '/user/tokens/verify': ok['/user/tokens/verify'] }).request, now);
    assert.match(missingDatabase.errors[0], /CLOUDFLARE_D1_DATABASE_ID/);

    const noPermission = await verifyD1Token(TOKEN, account, database, fake({ '/user/tokens/verify': ok['/user/tokens/verify'],
      '/accounts/': () => reply(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] }) }).request, now);
    assert.match(noPermission.errors[0], /needs D1 Edit/);

    const down = await verifyD1Token(TOKEN, account, database, fake({ '/': () => reply(502, {}) }).request, now);
    assert.deepEqual(down.errors, []); assert.match(down.warnings[0], /answered 502; carrying on/);
    const offline = await verifyD1Token(TOKEN, account, database, (async () => { throw new TypeError('fetch failed'); }) as typeof fetch, now);
    assert.deepEqual(offline.errors, []); assert.match(offline.warnings[0], /Could not reach Cloudflare/);
  });
});

describe('edge purge', () => {
  const env = { SITE_URL: 'https://kahve.test', SITE_VIA: 'https://crawler.test/site/', CRAWL_RELAY_TOKEN: HEX, CACHE_PURGE_TOKEN: 'f'.repeat(64) };

  it('says which side refused and which secret to fix', () => {
    assert.match(explainPurgeResponse(401, 'Unauthorized.'), /CRAWL_RELAY_TOKEN must equal the crawler Worker secret RELAY_TOKEN/);
    assert.match(explainPurgeResponse(401, ''), /CACHE_PURGE_TOKEN must equal the web Worker secret/);
    assert.match(explainPurgeResponse(403, '<html>'), /Bot Fight Mode/);
    assert.match(explainPurgeResponse(404, ''), /no CACHE_PURGE_TOKEN secret/);
    assert.match(explainPurgeResponse(404, 'Not found.'), /SITE_VIA must end in \/site/);
    assert.match(explainPurgeResponse(503, 'Relay is not configured.'), /no RELAY_TOKEN/);
    assert.match(explainPurgeResponse(503, '{"purged":false}'), /could not purge/);
  });

  it('posts through the crawler route with both tokens and reports purged, skipped or failed', async () => {
    const seen: { url: string; headers: Headers }[] = [];
    const answer = (status: number, body: string) => (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers) }); return new Response(body, { status });
    }) as typeof fetch;
    assert.deepEqual(await purge(env, answer(200, '{"purged":true}')), { result: 'purged', message: 'Edge cache purged: {"purged":true}' });
    assert.equal(seen[0].url, 'https://crawler.test/site/api/cache');
    assert.equal(seen[0].headers.get('authorization'), `Bearer ${HEX}`);
    assert.equal(seen[0].headers.get('x-cache-purge-token'), env.CACHE_PURGE_TOKEN);

    const refused = await purge(env, answer(401, ''));
    assert.equal(refused.result, 'failed');
    assert.match(refused.message, /answered 401: the web Worker refused CACHE_PURGE_TOKEN/);
    assert.ok(!refused.message.includes(env.CACHE_PURGE_TOKEN) && !refused.message.includes(HEX));

    assert.equal((await purge({ ...env, CACHE_PURGE_TOKEN: '' }, answer(200, ''))).result, 'skipped');
    const calls = seen.length;
    const malformed = await purge({ ...env, CACHE_PURGE_TOKEN: `${env.CACHE_PURGE_TOKEN}\n` }, answer(200, ''));
    assert.equal(malformed.result, 'failed'); assert.match(malformed.message, /CACHE_PURGE_TOKEN contains a line break/);
    assert.equal(seen.length, calls, 'a malformed token is never sent');
  });
});

describe('job outcome', () => {
  const summary = (statuses: string[], failure: string | null = null): OutcomeInput['summary'] => ({ failure, results: statuses.map(status => ({ status })),
    freshness: { listed: 480, fresh: 470, stale: 10 }, sources: { restored: 2 } });
  const good: OutcomeInput = { secrets: 'success', refresh: 'success', corrections: 'success', purge: 'success', purgeResult: 'purged', warm: 'success', summary: summary(['success', 'success', 'partial']) };

  it('is green when the data is written and the edge purged and warmed', () => {
    const result = refreshOutcome(good);
    assert.equal(result.exitCode, 0);
    assert.match(result.markdown, /\| Catalog data \(D1\) \| written: 2\/3 sources succeeded \|/);
    assert.match(result.markdown, /\| Catalog freshness \| 470 fresh, 10 stale, 2 restored of 480 listed \|/);
    assert.match(result.markdown, /\| Edge purge \| purged \|/);
  });

  it('turns red on a failed purge but says the data was written', () => {
    const result = refreshOutcome({ ...good, purge: 'failure', purgeResult: 'failed', warm: 'skipped' });
    assert.equal(result.exitCode, 1);
    assert.ok(result.annotations.some(line => line.startsWith('::error title=Edge purge failed (catalog data WAS written)::')));
    assert.match(result.markdown, /Catalog data \(D1\) \| written/);
    assert.match(result.markdown, /Edge purge \| FAILED/);
    assert.match(result.markdown, /The data was written; only the stages marked above need fixing/);
  });

  it('keeps a failed warm-up a warning, and a purge that is not configured a notice', () => {
    const warm = refreshOutcome({ ...good, warm: 'failure' });
    assert.equal(warm.exitCode, 0);
    assert.ok(warm.annotations.some(line => line.startsWith('::warning title=Edge warm-up incomplete::')));
    const unconfigured = refreshOutcome({ ...good, purgeResult: 'skipped', warm: 'skipped' });
    assert.equal(unconfigured.exitCode, 0);
    assert.match(unconfigured.markdown, /Edge purge \| not configured/);
  });

  it('says plainly when nothing was written', () => {
    const secrets = refreshOutcome({ ...good, secrets: 'failure', refresh: 'skipped', corrections: 'skipped', purge: 'skipped', purgeResult: '', warm: 'skipped', summary: null });
    assert.equal(secrets.exitCode, 1);
    assert.match(secrets.markdown, /NOT written: the secrets check stopped the job/);
    assert.match(secrets.markdown, /No new catalog data was written tonight/);
    const stopped = refreshOutcome({ ...good, refresh: 'failure', corrections: 'failure', purge: 'skipped', purgeResult: '', warm: 'skipped', summary: summary([], 'D1 request failed (429): daily read limit') });
    assert.equal(stopped.exitCode, 1);
    assert.match(stopped.markdown, /NOT written; the refresh stopped: D1 request failed/);
    assert.match(stopped.markdown, /nothing was written, so the edge keeps its good copies/);
  });
});

describe('catalog freshness counts', () => {
  const product = (name: string): SourceCoffee => ({ name, canonicalUrl: `https://shop.test/${name}`, sourceProductId: name, visibility: 'public', rawMetadata: {}, features: [],
    offers: [{ sourceVariantId: `${name}-250`, label: '250 g', weightG: 250, price: 600, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${name}?v=250` }] });
  const crawl = (db: TestCatalogDatabase, day: string, names: string[]) => ingestCrawl(db, { id: `run-${day}`, roasterId: 'r', startedAt: `${day}T01:00:00Z`, completedAt: `${day}T01:01:00Z`,
    parserVersion: 'test', status: 'success', diagnostics: [], products: names.map(product) });

  it('splits listed coffees into fresh and stale with one query, and counts restored coffees from the crawl itself', async () => {
    const db = new TestCatalogDatabase();
    await registerRoaster(db, { id: 'r', slug: 'test', name: 'Test', websiteUrl: 'https://shop.test', adapter: 'test' });
    assert.equal((await crawl(db, '2026-09-01', ['kenya', 'brazil'])).restored, 0);
    await crawl(db, '2026-09-02', ['kenya']);
    // Brazil was not confirmed on the 2nd: still listed (7-day rule), but stale.
    assert.deepEqual(await catalogFreshness(db, '2026-09-02T00:00:00.000Z'), { listed: 2, fresh: 1, stale: 1, rowsRead: null });
    await crawl(db, '2026-09-12', ['kenya']);
    assert.deepEqual(await catalogFreshness(db, '2026-09-12T00:00:00.000Z'), { listed: 1, fresh: 1, stale: 0, rowsRead: null });
    // Brazil had dropped out (last seen more than 7 days before the roaster's last success) and is back.
    assert.equal((await crawl(db, '2026-09-13', ['kenya', 'brazil'])).restored, 1);
    assert.deepEqual(await catalogFreshness(db, '2026-09-13T00:00:00.000Z'), { listed: 2, fresh: 2, stale: 0, rowsRead: null });
    db.sqlite.close();
  });

  it('reports sources and freshness in the job summary', () => {
    const results = [{ slug: 'a', status: 'success', products: 3, offers: 4, restored: 1 }, { slug: 'b', status: 'already_completed' }, { slug: 'c', status: 'failed', products: 0, offers: 0, restored: 0 }, { slug: 'v', status: 'partial' }];
    assert.deepEqual(sourceCounts(results), { attempted: 4, succeeded: 2, partial: 1, failed: 1, restored: 1 });
    const markdown = refreshSummaryMarkdown({ results, failure: null, rowsRead: 80_000, rowsWritten: 28_000, freshness: { listed: 10, fresh: 8, stale: 2, rowsRead: 4512 } });
    assert.match(markdown, /\*\*Sources:\*\* 4 attempted, 2 succeeded, 1 partial, 1 failed\./);
    assert.match(markdown, /10 coffees listed: \*\*8 fresh\*\* \(confirmed today\), \*\*2 stale\*\*.*\*\*1 restored\*\*.*one query, 4512 rows read/);
    assert.match(markdown, /\| a \| success \| 3 \| 4 \| 1 \|/);
    assert.match(refreshSummaryMarkdown({ results, failure: null, rowsRead: 0, rowsWritten: 0, freshness: { error: 'D1 request failed (429)' } }), /not counted \(D1 request failed \(429\)\)/);
  });
});
