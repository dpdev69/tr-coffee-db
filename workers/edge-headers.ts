import { contentSecurityPolicy, withScriptNonce } from '../shared/v2/content-security-policy';

/**
 * Headers that must differ per request, applied by the gateway (workers/web.ts) after Workers Cache has answered, so a
 * cached page never holds a nonce and every copy, hit or miss, leaves with a fresh one.
 *
 * - HTML: a new nonce in the Content-Security-Policy header (the only CSP header sent) and on every inline <script>.
 *   Cloudflare's bot check reads it from the header and copies it onto the script it injects. The body is streamed
 *   through HTMLRewriter (no buffering, no database, no KV); measured locally in workerd it costs about 0.5 ms of CPU
 *   for the 295 KB /kahveler page and 0.35 ms for /veri, against the 10 ms per-invocation limit.
 *   Validators are dropped: a 304 would pair the browser's stored body (old nonce) with the new header.
 * - Any host under workers.dev (staging, version previews): X-Robots-Tag noindex, nofollow on every response, so only
 *   the custom domain is indexable. Static files there get the same header from public/_headers.
 */
export const STAGING_ROBOTS_TAG = 'noindex, nofollow';

/** 128 random bits, base64. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function isWorkersDevHost(url: string | URL): boolean {
  const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  return host === 'workers.dev' || host.endsWith('.workers.dev');
}

function isHtml(response: Response): boolean {
  return /^\s*text\/html\b/i.test(response.headers.get('content-type') ?? '');
}

/** The request handed to the cached app. A page request loses its conditional headers so the cache can only answer
 * with a full body that the gateway then stamps; everything else is passed on untouched. */
export function forwardedRequest(request: Request): Request {
  const page = request.headers.get('sec-fetch-dest') === 'document' || /\btext\/html\b/i.test(request.headers.get('accept') ?? '');
  if (!page || (!request.headers.has('if-none-match') && !request.headers.has('if-modified-since'))) return request;
  const forwarded = new Request(request);
  forwarded.headers.delete('if-none-match');
  forwarded.headers.delete('if-modified-since');
  return forwarded;
}

/** Adds the nonce to every inline script (one without src) of a streamed HTML body. */
export function stampInlineScripts(response: Response, nonce: string): Response {
  if (!response.body) return response;
  return new HTMLRewriter().on('script', {
    element(script) { if (!script.hasAttribute('src')) script.setAttribute('nonce', nonce); },
  }).transform(response);
}

export function secureResponse(request: Request, response: Response, nonce: string = newNonce()): Response {
  const staging = isWorkersDevHost(request.url), html = isHtml(response);
  if (!staging && !html) return response;
  const secured = new Response(response.body, response);
  if (staging) secured.headers.set('X-Robots-Tag', STAGING_ROBOTS_TAG);
  if (!html) return secured;
  secured.headers.set('Content-Security-Policy', withScriptNonce(response.headers.get('content-security-policy') ?? contentSecurityPolicy(), nonce));
  secured.headers.delete('etag');
  secured.headers.delete('last-modified');
  // The page carries this visitor's nonce: no shared cache downstream may keep it. Browsers still revalidate every time.
  const cacheControl = secured.headers.get('cache-control');
  if (cacheControl && /\bpublic\b/i.test(cacheControl)) secured.headers.set('cache-control', cacheControl.replace(/\bpublic\b/i, 'private'));
  return stampInlineScripts(secured, nonce);
}
