import { markRouteCacheabilityFinalResponseUncacheable } from 'vinext/shims/cacheability-classification';
import { permanentRedirect } from 'next/navigation';
import { getRequestExecutionContext } from 'vinext/shims/request-context';
import { readOncePerRequest, TRACKING_PARAM, withDerivedCache } from '../../shared/v2/read-cache';
import { withDeadline, type LastGood } from '../../shared/v2/last-good';
import type { CatalogDatabase } from '../../shared/v2/database';

/** vinext resolves the native Workers import; Next's legacy build can still compile and serve utility routes. */
export async function getV2Environment(): Promise<CloudflareEnv> {
  const moduleName = 'cloudflare:workers';
  const runtime = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName) as { env: CloudflareEnv };
  return runtime.env;
}

/** How long one catalog statement may take. The heaviest (landing facts, about 73,000 rows) answers well inside it; a
 * database that is out of its daily reads or not answering fails within it, and the page shows its fallback. */
export const D1_DEADLINE_MS = 6000;
/** One deadline wrapper per request, so the first outage stops every later read in that request, whichever component asks. */
const deadlines = new WeakMap<object, CatalogDatabase>();

export async function getCatalogDatabase(): Promise<CatalogDatabase> {
  const env = await getV2Environment();
  if (!env.DB) throw new Error('Catalog binding unavailable');
  const scope = getRequestExecutionContext();
  let db = scope ? deadlines.get(scope) : undefined;
  if (!db) { db = withDeadline(env.DB, D1_DEADLINE_MS); if (scope) deadlines.set(scope, db); }
  // The Worker version keys derived results, so a deploy never reads a shape written by older code.
  return readOncePerRequest(withDerivedCache(db, `${env.DEPLOYMENT_STAGE || 'local'}:${env.CF_VERSION_METADATA?.id ?? 'dev'}`, undefined, await catalogLastGood()), scope);
}

/** Last-good copies in KV (LAST_GOOD), used when D1 fails (shared/v2/last-good.ts). Copies are refreshed after the
 * response; a render that used one is kept out of the edge cache, so the edge goes on serving its own last good page
 * where it has one and the copy never outlives the outage there. `onFallback` also receives the copy's write time. */
export async function catalogLastGood(onFallback?: (writtenAt: string | null) => void): Promise<LastGood> {
  const env = await getV2Environment();
  const scope = getRequestExecutionContext();
  return {
    store: env.LAST_GOOD,
    background: scope ? work => scope.waitUntil(work) : undefined,
    onFallback: writtenAt => { keepOutOfEdgeCache(); onFallback?.(writtenAt); },
  };
}

/** Pages are cached at the edge by next.config.ts; a render that could not read the catalog must not be. vinext's own veto
 * (the one it applies to a cookie-setting config header) keeps this response out of Workers Cache, so the edge goes on
 * serving the last good copy. Outside a cacheable Workers request (dev, tests, the legacy build) it does nothing. */
export function keepOutOfEdgeCache(): void {
  markRouteCacheabilityFinalResponseUncacheable('catalog unavailable');
}

/** A shared link can carry a click id (fbclid, gclid, utm_*); each would be a separate edge cache entry and a fresh render.
 * The address without them shows the same page, so it redirects there before any catalog read. */
export function dropTrackingParams(path: string, params: Record<string, string | string[] | undefined> = {}): void {
  const entries = Object.entries(params).flatMap(([key, value]) => (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(item => [key, item] as [string, string]));
  if (!entries.some(([key]) => TRACKING_PARAM.test(key))) return;
  const query = new URLSearchParams(entries.filter(([key]) => !TRACKING_PARAM.test(key)));
  permanentRedirect(query.size ? `${path}?${query}` : path);
}
