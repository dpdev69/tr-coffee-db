/**
 * On the Workers Free plan a render that runs past the CPU limit is cut off, and the gateway (workers/web.ts) gets back
 * a bare 503: no body, no Content-Type, no Retry-After. Cloudflare's analytics record it as "exceededResources"; it hit
 * page misses such as /kavurucu/molecule about 1 in 4 times on 26 Oct 2026. The next invocation gets a fresh CPU budget
 * and usually finishes, so a GET or HEAD that comes back that way is asked once more. The app's own 503s (the miss
 * guard's daily-read brake, a database that cannot be read) carry Retry-After or a body type and are passed on untouched.
 */
export function cutOff(request: Request, response: Response): boolean {
  return (request.method === 'GET' || request.method === 'HEAD') && response.status === 503
    && !response.headers.has('retry-after') && !response.headers.has('content-type');
}

/** Asks `fetch` once more when the first answer was cut off by the CPU limit. */
export async function withRetry(request: Request, fetch: () => Promise<Response>): Promise<Response> {
  const first = await fetch();
  if (!cutOff(request, first)) return first;
  await first.body?.cancel();
  console.warn(JSON.stringify({ event: 'cpu_cutoff_retry', path: new URL(request.url).pathname }));
  return fetch();
}
