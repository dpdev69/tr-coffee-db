import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getCurrentCatalogCutoffIso } from '@/lib/catalog-rules';
import { applyPublicCoffeeVisibility } from '@/lib/public-coffee-visibility';
import { absoluteUrl } from '@/lib/site';
import type { Database } from '@/lib/types/database';

export const revalidate = 86400;

type CoffeeSitemapRow = Pick<
  Database['public']['Tables']['coffees']['Row'],
  'slug' | 'updated_at' | 'last_scraped_at'
>;

type RoasterSitemapRow = Pick<
  Database['public']['Tables']['roasters']['Row'],
  'slug' | 'updated_at'
>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/coffees'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: absoluteUrl('/roasters'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: absoluteUrl('/quiz'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: absoluteUrl('/privacy'),
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms'),
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return [...staticRoutes, ...(await getCatalogRoutes())];
}

async function getCatalogRoutes(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
    const currentCutoff = getCurrentCatalogCutoffIso();

    const [coffeeResult, roasterResult] = await Promise.all([
      applyPublicCoffeeVisibility(
        supabase
          .from('coffees')
          .select('slug, updated_at, last_scraped_at'),
        currentCutoff
      )
        .order('updated_at', { ascending: false })
        .limit(2000),
      supabase
        .from('roasters')
        .select('slug, updated_at')
        .eq('is_active', true)
        .order('name')
        .limit(500),
    ]);

    if (coffeeResult.error || roasterResult.error) return [];

    const coffeeRoutes = ((coffeeResult.data ?? []) as CoffeeSitemapRow[]).map(
      (coffee) => ({
        url: absoluteUrl(`/coffees/${coffee.slug}`),
        lastModified: new Date(coffee.last_scraped_at ?? coffee.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
    );

    const roasterRoutes = ((roasterResult.data ?? []) as RoasterSitemapRow[]).map(
      (roaster) => ({
        url: absoluteUrl(`/roasters/${roaster.slug}`),
        lastModified: new Date(roaster.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.65,
      })
    );

    return [...coffeeRoutes, ...roasterRoutes];
  } catch {
    return [];
  }
}
