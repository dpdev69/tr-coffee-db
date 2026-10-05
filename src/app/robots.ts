import type { MetadataRoute } from 'next';
import { absoluteUrl, SITE_URL } from '@/lib/site';
import { brand } from '@/lib/brand';

/** Free-text and price inputs make endless addresses (each one a fresh render and catalog read), all noindex already.
 * Every catalog form submission carries `search=`, so this also keeps crawlers out of submitted forms; paths, pages and
 * removable filter chips stay crawlable. Quiz results are noindex too. */
const CRAWL_TRAPS = ['/quiz/sonuc', ...['search', 'priceMin', 'priceMax', 'farm', 'producer', 'variety', 'altitude'].map(key => `/*${key}=`)];

export default function robots(): MetadataRoute.Robots {
  return { rules: brand.production ? { userAgent: '*', allow: '/', disallow: ['/api/', '/go/', '/compare', ...CRAWL_TRAPS] } : { userAgent: '*', disallow: '/' }, sitemap: absoluteUrl('/sitemap.xml'), host: SITE_URL.origin };
}
