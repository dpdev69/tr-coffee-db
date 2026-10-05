import type { MetadataRoute } from 'next';
import { catalogSitemap, staticSitemap } from '@/lib/sitemap-entries';
import { getCatalogDatabase } from '@/lib/v2-runtime';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try { return await catalogSitemap(await getCatalogDatabase()); }
  catch (error) {
    // Without this line a failed catalog read looks like a 10-address sitemap and nothing else.
    console.error('Sitemap catalog read failed', error instanceof Error ? error.message : 'Unknown database error');
    return staticSitemap();
  }
}
