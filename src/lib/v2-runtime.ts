import { cacheCatalogReads } from '../../shared/v2/read-cache';
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
  const cache = typeof caches !== 'undefined' ? (caches as CacheStorage & { default?: Cache }).default : undefined;
  return cache ? cacheCatalogReads(env.DB, cache, 'coffeedb-v2-staging:coffee-only-v6', 300) : env.DB;
}
