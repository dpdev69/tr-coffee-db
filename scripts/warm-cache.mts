/** Fills the edge cache and the derived results right after the nightly purge and after a deploy, one request at a time,
 * so the expensive catalog-wide computations run once, here, before visitors arrive (docs/read-budget.md).
 *
 *   tsx scripts/warm-cache.mts <site-url>            (or SITE_URL)
 *
 * With SITE_VIA and CRAWL_RELAY_TOKEN set (the nightly job), every request goes through the crawler Worker's /site route
 * instead, because Bot Fight Mode answers GitHub's runners 403 on the site itself (docs/crawl-relay.md). Workers Cache is
 * keyed by path, not host, so what is stored that way is what visitors on the site get.
 *
 * The list stays under the miss limits of workers/miss-guard.ts (20 list-sized and 60 single-coffee misses a minute).
 * With CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_D1_API_TOKEN set (the nightly job), it then lists
 * the stored derived results and their sizes (one row each), and reports a missing or oversized one as a workflow error. */
import { appendFile } from 'node:fs/promises';
import { D1RestDatabase } from './v2-d1-rest';

const site = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(site)) { console.error('Usage: tsx scripts/warm-cache.mts <site-url>'); process.exit(1); }
const via = process.env.SITE_VIA?.replace(/\/$/, ''), relayToken = process.env.CRAWL_RELAY_TOKEN;
const base = via && relayToken ? via : site, auth: Record<string, string> = via && relayToken ? { Authorization: `Bearer ${relayToken}` } : {};
const html = { Accept: 'text/html' };
/** What every visitor's browser prefetches from the header (the router's form of the page), and the page itself. */
const rsc = { Accept: 'text/x-component', RSC: '1' };
const lines: string[] = [];
const report = (line: string) => { console.log(line); lines.push(line); };
let failed = 0;

async function warm(path: string, headers: Record<string, string>) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}${path}`, { headers: { ...headers, ...auth }, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
    const body = await response.text();
    if (!response.ok) failed++;
    report(`${response.status} ${response.headers.get('cf-cache-status') ?? '-'} ${String(Date.now() - started).padStart(6)} ms ${path}${headers.RSC ? ' (router)' : ''}`);
    return body;
  } catch (error) { failed++; report(`ERR ${path}: ${error instanceof Error ? error.message : String(error)}`); return ''; }
}

// The sitemap first: it fills the landing facts, roasters and its own coffee list, and names a coffee to warm.
const sitemap = await warm('/sitemap.xml', {});
for (const path of ['/', '/kahveler', '/yeni', '/firsatlar']) { await warm(path, html); await warm(`${path}?_rsc`, rsc); }
await warm('/kavurucular', html);
const coffee = /<loc>[^<]*?(\/kahve\/[^<]+)<\/loc>/.exec(sitemap)?.[1];
if (coffee) await warm(coffee, html); // similarity candidates
await warm('/api/quiz/match', {}); // quiz candidates

const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_D1_DATABASE_ID: database, CLOUDFLARE_D1_API_TOKEN: token } = process.env;
if (account && database && token) {
  const db = new D1RestDatabase(account, database, token);
  const rows = (await db.prepare("SELECT key, length(CAST(value_json AS BLOB)) AS bytes FROM derived_cache WHERE key NOT LIKE 'lease:%' AND key<>'invalidated' ORDER BY bytes DESC").all<{ key: string; bytes: number }>()).results;
  const name = (key: string) => key.split(':').slice(2).join(':').replace(/^facts:.*/, 'facts');
  for (const row of rows) report(`${String(row.bytes).padStart(9)} bytes ${name(row.key)}`);
  // Half of D1's 2 MB row limit is the point to act; past MAX_DERIVED_BYTES (1.9 MB) a value is no longer stored.
  for (const row of rows.filter(row => row.bytes > 1_000_000)) report(`::warning::Derived result ${name(row.key)} is ${row.bytes} bytes; D1 refuses rows over 2 MB (shared/v2/read-cache.ts)`);
  const stored = new Set(rows.map(row => name(row.key)));
  for (const expected of ['counts', 'roasters', 'origins', 'facts', 'sitemap-coffees', 'day-order', 'similar-candidates', 'quiz-candidates'].filter(item => !stored.has(item))) {
    failed++; report(`::error::Derived result ${expected} was not stored; every request that needs it recomputes it. Look for "Derived result not stored" in the Worker logs.`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\nEdge warm-up (${site}):\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
if (failed) { console.error(`::warning::${failed} warm-up step(s) failed`); process.exitCode = 1; }
