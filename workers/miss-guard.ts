import { canonicalQuery } from '../src/lib/canonical-address';
import { EDGE_CACHE_HEADERS } from '../shared/v2/read-cache';

/**
 * Runs before the app, and only when Workers Cache has no copy of the address (a hit never reaches the Worker), so
 * everything here acts on cache misses alone and never slows a visitor served from the edge. docs/read-budget.md has the
 * arithmetic behind the numbers.
 *
 * 1. Canonical address: anything but the one spelling of a catalog address is redirected to it, without a database read.
 * 2. Global brake: when the account has read BRAKE_ROWS today, uncached catalog renders stop until midnight UTC, so the
 *    rest of the day's allowance stays with the nightly refresh. Needs D1_ANALYTICS_TOKEN; without it this step is off.
 * 3. Per-client limit on misses: CATALOG_LIMITER for list-sized renders, PAGE_LIMITER for single-coffee-sized ones.
 * A refusal is cheap (no database, no React), never stored at the edge, plain Turkish for a person, 429 or 503 with
 * Retry-After for a crawler.
 */
export interface GuardEnv {
  CATALOG_LIMITER?: RateLimit;
  PAGE_LIMITER?: RateLimit;
  D1_ANALYTICS_TOKEN?: string;
  D1_BUDGET_ACCOUNT_ID?: string;
}
type Waiter = { waitUntil(promise: Promise<unknown>): void };

/** 10,000 to 27,000 rows per miss (a list, a landing, a feed, the home page); 5,400 for a roaster. */
const CATALOG = /^\/(?:|kahveler|kahveler\/(?:koken|islem)\/[^/]+|yeni|firsatlar|kavurucu\/[^/]+|api\/catalog|api\/since|sitemap\.xml)$/;
/** Under about 1,100 rows per miss: one coffee, a quiz result, saved coffees, the newsletter archive, a written comparison. */
const PAGE = /^\/(?:kahve\/[^/]+|kavurucular|bulten\/[^/]+|karsilastir|karsilastir\/[^/]+|quiz\/sonuc|compare|api\/quiz\/match|api\/saved)$/;
/** The free plan's 5,000,000 rows a day, less a reserve that covers the nightly refresh at its own hard cap (750,000),
 * the derived results and warm-up it triggers (about 300,000) and the brake's own lag (see BRAKE_POLL_MS). */
export const BRAKE_ROWS = 3_500_000;
const BRAKE_POLL_MS = 30_000;

/** The client a limit counts against: the IPv4 address, or the /64 of an IPv6 one (one subscriber's whole network).
 * Only Cloudflare's own header is trusted; without it every request shares one bucket. Never stored or logged. */
export function clientKey(request: Request): string {
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4) return v4[1];
  if (!/^[0-9a-f:]{2,39}$/i.test(ip) || !ip.includes(':')) return 'unknown';
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return groups.slice(0, 4).map(group => group.replace(/^0+(?=.)/, '').toLowerCase()).join(':') + '::/64';
}

function refusal(status: 429 | 503, retryAfter: number, api: boolean, title: string, text: string): Response {
  const headers = { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (api) return Response.json({ error: `${title} ${text}` }, { status, headers });
  const page = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>`
    + `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 16px;line-height:1.6;color:#171a2b;background:#f7f8f6">`
    + `<h1 style="font-size:1.5rem">${title}</h1><p>${text}</p><p><a href="/" style="color:#2340c7">Ana sayfaya dön</a></p></body></html>`;
  return new Response(page, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}

let usage: { day: string; rows: number } | null = null;
let checkedAt = 0;
/** Rows read across the whole account today (UTC, the day the allowance counts), from D1's analytics. Each isolate asks at
 * most every BRAKE_POLL_MS, in the background, and decides on the last answer; a failure keeps the last answer. */
async function readUsage(env: GuardEnv): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${env.D1_ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){d1AnalyticsAdaptiveGroups(limit:1,filter:{date_geq:$d,date_leq:$d}){sum{rowsRead}}}}}', variables: { a: env.D1_BUDGET_ACCOUNT_ID, d: day } }),
  });
  const body = await response.json() as { data?: { viewer?: { accounts?: Array<{ d1AnalyticsAdaptiveGroups?: Array<{ sum?: { rowsRead?: number } }> }> } } };
  const groups = body.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups;
  if (!response.ok || !Array.isArray(groups)) throw new Error(`D1 analytics answered ${response.status}`);
  usage = { day, rows: groups[0]?.sum?.rowsRead ?? 0 };
}
export function overBudget(env: GuardEnv, ctx: Waiter, now = Date.now()): boolean {
  if (!env.D1_ANALYTICS_TOKEN || !env.D1_BUDGET_ACCOUNT_ID) return false;
  if (now - checkedAt >= BRAKE_POLL_MS) {
    checkedAt = now;
    ctx.waitUntil(readUsage(env).catch(error => console.error('Read budget check failed', error instanceof Error ? error.message : String(error))));
  }
  return usage?.day === new Date(now).toISOString().slice(0, 10) && usage.rows >= BRAKE_ROWS;
}
/** For tests. */
export function setUsage(value: typeof usage, at = 0) { usage = value; checkedAt = at; }

/** A Response that answers the request without the app, or the request to hand to the app. */
export async function guard(request: Request, env: GuardEnv, ctx: Waiter): Promise<Response | Request> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return request;
  const url = new URL(request.url);
  const rscSuffix = url.pathname.endsWith('.rsc');
  const path = rscSuffix ? url.pathname.slice(0, -4) : url.pathname;
  const kind = CATALOG.test(path) ? 'catalog' : PAGE.test(path) ? 'page' : null;
  if (!kind) return request;
  const api = path.startsWith('/api/');
  const rsc = rscSuffix || request.headers.get('rsc') === '1';

  // The client router's own cache-busting pair (_rsc) is not part of the address; it is kept, last, as the router sent it.
  const pairs = url.search.slice(1).split('&').filter(Boolean);
  const rscPair = pairs.find(pair => pair === '_rsc' || pair.startsWith('_rsc='));
  const query = pairs.filter(pair => pair !== rscPair).join('&');
  const params = new URLSearchParams(query);
  params.delete('_rsc');
  const canonical = canonicalQuery(path, params);
  if (canonical !== null && canonical !== query) {
    const search = [canonical, rscPair].filter(Boolean).join('&');
    return new Response(null, { status: 308, headers: { Location: `${url.pathname}${search ? `?${search}` : ''}`, ...EDGE_CACHE_HEADERS } });
  }

  if (overBudget(env, ctx)) {
    const untilReset = 86400 - Math.floor(Date.now() / 1000) % 86400 + 300;
    return refusal(503, untilReset, api, 'Katalog bugünlük dinleniyor.', 'Bugün çok sayıda yeni sayfa açıldı; veritabanının günlük okuma payını gece yenilenen kahvelere ayırıyoruz. Daha önce açılmış sayfalar çalışmaya devam ediyor. Bu sayfayı gece 03:00’ten (Türkiye saati) sonra yeniden deneyebilirsin.');
  }
  const limiter = kind === 'catalog' ? env.CATALOG_LIMITER : env.PAGE_LIMITER;
  let allowed = true;
  try { allowed = !limiter || (await limiter.limit({ key: clientKey(request) })).success; }
  catch { /* A limiter outage must not take the site down with it. */ }
  if (!allowed) return refusal(429, 60, api, 'Biraz yavaşlayalım.', 'Bu bağlantıdan son bir dakikada çok sayıda yeni sayfa istendi. Bir dakika sonra yeniden deneyebilirsin; daha önce açılmış sayfalar bu sırada da açılır.');

  // A page answers HTML to any GET that is not a router request, but vinext only lets the edge store the answer when the
  // request said it accepts HTML. Saying so here means a script's or crawler's `Accept: */*` miss is stored like a browser's.
  if (!api && !rsc && path !== '/sitemap.xml' && !(request.headers.get('accept') ?? '').includes('text/html')) {
    const headers = new Headers(request.headers);
    headers.set('Accept', 'text/html');
    return new Request(request, { headers });
  }
  return request;
}
