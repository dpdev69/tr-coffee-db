import { timingSafeEqual } from 'node:crypto';

// A fetch relay for shops that refuse GitHub's network but accept Cloudflare's. It is not a general proxy:
// it only fetches hosts the caller lists (sources marked runsFrom: 'relay'), only with GET, only for a caller
// holding the shared token, and always with the crawler's own identity. See docs/crawl-relay.md.

const PASS_THROUGH = ['content-type', 'location', 'retry-after'];

/** Worker side. `allowedHosts` are the only hosts it will fetch; `headers` is the crawler identity sent upstream. */
export async function relayRequest(request: Request, token: string | undefined, allowedHosts: ReadonlySet<string>, headers: Record<string, string>, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!token) return new Response('Relay is not configured.', { status: 503 });
  const given = Buffer.from(request.headers.get('authorization') ?? ''), expected = Buffer.from(`Bearer ${token}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response('Unauthorized.', { status: 401 });
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
