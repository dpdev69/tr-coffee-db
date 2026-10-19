import { timingSafeEqual } from 'node:crypto';

// A fetch relay for shops that refuse GitHub's network but accept Cloudflare's. It is not a general proxy:
// it only fetches hosts the caller lists (sources marked runsFrom: 'relay'), only with GET, only for a caller
// holding the shared token, and always with the crawler's own identity. See docs/crawl-relay.md.

const PASS_THROUGH = ['content-type', 'location', 'retry-after'];

/** The answer for a caller without the shared token, or null when the token matches. */
function refuse(request: Request, token: string | undefined): Response | null {
  if (!token) return new Response('Relay is not configured.', { status: 503 });
  const given = Buffer.from(request.headers.get('authorization') ?? ''), expected = Buffer.from(`Bearer ${token}`);
  return given.length !== expected.length || !timingSafeEqual(given, expected) ? new Response('Unauthorized.', { status: 401 }) : null;
}

/** Worker side. `allowedHosts` are the only hosts it will fetch; `headers` is the crawler identity sent upstream. */
export async function relayRequest(request: Request, token: string | undefined, allowedHosts: ReadonlySet<string>, headers: Record<string, string>, fetcher: typeof fetch = fetch): Promise<Response> {
  const refused = refuse(request, token);
  if (refused) return refused;
  if (request.method !== 'GET') return new Response('GET only.', { status: 405 });
  let target: URL;
  try { target = new URL(new URL(request.url).searchParams.get('url') ?? ''); } catch { return new Response('Bad url.', { status: 400 }); }
  if (target.protocol !== 'https:' || target.port || target.username || target.password || !allowedHosts.has(target.hostname)) return new Response('Host not allowed.', { status: 403 });
  const upstream = await fetcher(target, { redirect: 'manual', headers });
  const out = new Headers();
  for (const name of PASS_THROUGH) { const value = upstream.headers.get(name); if (value) out.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/** Caller side: a fetch that sends GET requests through the relay and leaves everything else to the crawler. */
export function relayFetch(relayUrl: string, token: string, fetcher: typeof fetch = fetch): typeof fetch {
  // The token travels in a header, so it must never leave over plain http.
  if (new URL(relayUrl).protocol !== 'https:') throw new Error('The relay URL must use https.');
  return (input, init) => {
    if (init?.method && init.method !== 'GET') throw new Error('The relay only carries GET requests.');
    const url = new URL(relayUrl); url.searchParams.set('url', String(input instanceof Request ? input.url : input));
    return fetcher(url, { redirect: 'manual', signal: init?.signal, headers: { Authorization: `Bearer ${token}` } });
  };
}

/** What the site's own Worker sees from a warm-up request: the page's form (HTML or the router's), nothing else. No Authorization,
 * which would make Workers Cache bypass the request, and no cookies. */
const SITE_REQUEST_HEADERS = ['accept', 'rsc'];
const SITE_PASS_THROUGH = [...PASS_THROUGH, 'cf-cache-status', 'age'];

/** Worker side of `/site/<path>`: the nightly job's purge and warm-up, sent to the site's Worker over a service binding.
 * Bot Fight Mode on the site's zone answers GitHub's runners 403, and a zone purge does not reach Workers Cache (it belongs
 * to the Worker, keyed by path and not by host), so the job reaches the Worker here instead (docs/crawl-relay.md).
 * Same shared token as the relay. GET and HEAD carry only SITE_REQUEST_HEADERS, so what they store is what a visitor gets.
 * The one POST is the purge (/api/cache), whose own token travels as X-Cache-Purge-Token and is checked by the site.
 * `origin` is the site's public address, so anything the site builds from the request URL names the real host. */
export async function siteRequest(request: Request, token: string | undefined, site: { fetch: typeof fetch } | undefined, origin: string | undefined): Promise<Response> {
  const refused = refuse(request, token);
  if (refused) return refused;
  if (!site || !origin) return new Response('Site route is not configured.', { status: 503 });
  const url = new URL(request.url), path = url.pathname.replace(/^\/site(?=\/)/, '');
  if (path === url.pathname) return new Response('Not found.', { status: 404 });
  const headers = new Headers();
  if (request.method === 'POST') {
    if (path !== '/api/cache') return new Response('POST only purges.', { status: 405 });
    headers.set('Authorization', `Bearer ${request.headers.get('x-cache-purge-token') ?? ''}`);
  } else if (request.method === 'GET' || request.method === 'HEAD') {
    for (const name of SITE_REQUEST_HEADERS) { const value = request.headers.get(name); if (value) headers.set(name, value); }
  } else return new Response('GET, HEAD or the purge only.', { status: 405 });
  const upstream = await site.fetch(new URL(`${path}${url.search}`, origin), { method: request.method, headers, redirect: 'manual' });
  const out = new Headers();
  for (const name of SITE_PASS_THROUGH) { const value = upstream.headers.get(name); if (value) out.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
