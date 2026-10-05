import { markRouteCacheabilityFinalResponseUncacheable } from 'vinext/shims/cacheability-classification';
import { permanentRedirect } from 'next/navigation';
import { getRequestExecutionContext } from 'vinext/shims/request-context';
import { readOncePerRequest, TRACKING_PARAM, withDerivedCache } from '../../shared/v2/read-cache';
import type { CatalogDatabase } from '../../shared/v2/database';

/** vinext resolves the native Workers import; Next's legacy build can still compile and serve utility routes. */
export async function getV2Environment(): Promise<CloudflareEnv> {
  const moduleName = 'cloudflare:workers';
  const runtime = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName) as { env: CloudflareEnv };
  return runtime.env;
}

export async function getCatalogDatabase(): Promise<CatalogDatabase> {
  const env = await getV2Environment();
  if (!env.DB) throw new Error('Catalog binding unavailable');
  // The Worker version keys derived results, so a deploy never reads a shape written by older code.
  return readOncePerRequest(withDerivedCache(env.DB, `${env.DEPLOYMENT_STAGE || 'local'}:${env.CF_VERSION_METADATA?.id ?? 'dev'}`), getRequestExecutionContext());
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
