import type { MetadataRoute } from 'next';
import { absoluteUrl, SITE_URL } from '@/lib/site';
import { brand } from '@/lib/brand';
import { crawlRules } from '@/lib/robots-rules';

export default function robots(): MetadataRoute.Robots {
  return { rules: crawlRules(brand.production), sitemap: absoluteUrl('/sitemap.xml'), host: SITE_URL.origin };
}
