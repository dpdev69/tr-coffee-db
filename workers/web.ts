import { WorkerEntrypoint } from 'cloudflare:workers';
import app from 'vinext/server/fetch-handler';
import { guard } from './miss-guard';
import { forwardedRequest, secureResponse } from './edge-headers';
import { junkRedirect } from './junk-suffix';

/** The miss guard (workers/miss-guard.ts), then the vinext app. */
async function serve(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
  const next = await guard(request, env, ctx);
  return next instanceof Response ? next : (app as ExportedHandler<CloudflareEnv>).fetch!(next as Request<unknown, IncomingRequestCfProperties>, env, ctx);
}

/**
 * The cached app. Workers Cache sits in front of this entrypoint ("exports" in wrangler.jsonc): a hit is answered
 * without running it, so the miss guard still acts on misses alone. Purges issued from here (/api/cache, vinext's own
 * revalidation) clear this entrypoint's cache, which is where every page is stored.
 */
export class App extends WorkerEntrypoint<CloudflareEnv> {
  fetch(request: Request): Promise<Response> {
    return serve(request, this.env, this.ctx);
  }
}

/**
 * The gateway (caching off): runs on every request, asks the cached app, then adds what must be fresh per response
 * (workers/edge-headers.ts: the CSP nonce on HTML, X-Robots-Tag on workers.dev). No database, no KV. A 404 for a link
 * with Markdown junk on the end ("/**") leaves as a 301 to the clean path (workers/junk-suffix.ts).
 */
const web = {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const cached = (ctx.exports as { App?: Fetcher } | undefined)?.App;
    const response = cached ? await cached.fetch(forwardedRequest(request)) : await serve(request, env, ctx);
    return secureResponse(request, junkRedirect(new URL(request.url), response.status) ?? response);
  },
};
export default web;
