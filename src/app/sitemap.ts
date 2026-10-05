import type { MetadataRoute } from 'next';
import { catalogSitemap, staticSitemap } from '@/lib/sitemap-entries';
import { getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try { return await catalogSitemap(await getCatalogDatabase()); }
  catch (error) {
    // The static fallback is served but never stored, so the next request retries the catalog.
    keepOutOfEdgeCache();
    // Without this line a failed catalog read looks like a 10-address sitemap and nothing else.
    console.error('Sitemap catalog read failed', error instanceof Error ? error.message : 'Unknown database error');
    return staticSitemap();
  }
}
