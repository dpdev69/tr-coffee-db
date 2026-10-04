import type { MetadataRoute } from 'next';
import { absoluteUrl, SITE_URL } from '@/lib/site';
import { brand } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return { rules: brand.production ? { userAgent: '*', allow: '/', disallow: ['/api/', '/go/', '/compare'] } : { userAgent: '*', disallow: '/' }, sitemap: absoluteUrl('/sitemap.xml'), host: SITE_URL.origin };
}
