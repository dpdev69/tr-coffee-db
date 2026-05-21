import { createClient } from '@/lib/supabase/server';
import {
  CATALOG_NAME_EXCLUSION_PATTERNS,
  SINGLE_ORIGIN_NAME_EXCLUSION_PATTERNS,
} from '@/lib/catalog-rules';
import { normalizeCityFilterValue, normalizeSearchTerm } from '@/lib/filter-contract';
import type { CoffeeSortOption } from '@/lib/constants/filter-options';
import type { LatestRoasterScrapeStatus } from '@/lib/coffee-confidence';
import type { CoffeeWithRoaster } from '@/lib/types/database';

export type CoffeeWithRoasterScrape = CoffeeWithRoaster & {
  latestRoasterScrape?: LatestRoasterScrapeStatus | null;
};

type LatestRoasterScrapeRow = LatestRoasterScrapeStatus & {
  roaster_id: string | null;
};

export interface CoffeeFilters {
  origin?: string[];
  process?: string[];
  roastLevel?: string[];
  roaster?: string[];
  city?: string[];
  flavorCategory?: string[];
  brewMethod?: string[];
  singleOrigin?: boolean;
  priceMin?: number;
  priceMax?: number;
  isDecaf?: boolean;
  search?: string;
  sort?: CoffeeSortOption;
  page?: number;
  perPage?: number;
}

export async function getCoffees(filters: CoffeeFilters = {}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 24;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const cityRoasterIds = filters.city?.length
    ? await getRoasterIdsForCities(filters.city, supabase)
    : undefined;

  if (cityRoasterIds && cityRoasterIds.length === 0) {
    return {
      coffees: [],
      total: 0,
      page,
      perPage,
      totalPages: 0,
    };
  }

  let query = supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)', { count: 'exact' })
    .eq('is_available', true);

  for (const pattern of CATALOG_NAME_EXCLUSION_PATTERNS) {
    query = query.not('name', 'ilike', pattern);
  }

  if (filters.origin?.length) {
    query = query.in('origin_country', filters.origin);
  }
  if (filters.process?.length) {
    query = query.in('process', filters.process);
  }
  if (filters.roastLevel?.length) {
    query = query.in('roast_level', filters.roastLevel);
  }
  if (filters.roaster?.length) {
    query = query.in('roasters.slug', filters.roaster);
  }
  if (cityRoasterIds?.length) {
    query = query.in('roaster_id', cityRoasterIds);
  }
  if (filters.flavorCategory?.length) {
    query = query.overlaps('flavor_categories', filters.flavorCategory);
  }
  if (filters.brewMethod?.length) {
    query = query.overlaps('brew_methods', filters.brewMethod);
  }
  if (filters.singleOrigin) {
    query = query.not('origin_country', 'is', null);

    for (const pattern of SINGLE_ORIGIN_NAME_EXCLUSION_PATTERNS) {
      query = query.not('name', 'ilike', pattern);
    }
  }
  if (filters.priceMin != null) {
    query = query.gte('price_per_100g', filters.priceMin);
  }
  if (filters.priceMax != null) {
    query = query.lte('price_per_100g', filters.priceMax);
  }
  if (filters.isDecaf != null) {
    query = query.eq('is_decaf', filters.isDecaf);
  }
  const searchTerm = normalizeSearchTerm(filters.search);
  if (searchTerm) {
    query = query.or(
      `name.ilike.%${searchTerm}%,origin_country.ilike.%${searchTerm}%,origin_region.ilike.%${searchTerm}%`
    );
  }

  // Sorting
  switch (filters.sort) {
    case 'match':
      query = query
        .order('click_count', { ascending: false })
        .order('created_at', { ascending: false });
      break;
    case 'price_asc':
      query = query.order('price_per_100g', { ascending: true, nullsFirst: false });
      break;
    case 'price_desc':
      query = query.order('price_per_100g', { ascending: false, nullsFirst: false });
      break;
    case 'popular':
      query = query.order('click_count', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  const coffees = (data ?? []) as CoffeeWithRoaster[];
  const latestScrapesByRoasterId = await getLatestRoasterScrapeStatuses(
    coffees.map((coffee) => coffee.roaster_id),
    supabase
  );

  return {
    coffees: coffees.map((coffee) => ({
      ...coffee,
      latestRoasterScrape: latestScrapesByRoasterId.get(coffee.roaster_id) ?? null,
    })) satisfies CoffeeWithRoasterScrape[],
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

export async function getCoffeeBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('coffees')
    .select('*, roasters!inner(id, name, slug, city, website_url, logo_url)')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return data as CoffeeWithRoaster & {
    roasters: { id: string; website_url: string; logo_url: string | null };
  };
}

async function getRoasterIdsForCities(
  cities: string[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const normalizedCities = new Set(
    cities
      .map((city) => normalizeCityFilterValue(city))
      .filter((city): city is string => Boolean(city))
  );

  if (normalizedCities.size === 0) return [];

  const { data, error } = await supabase
    .from('roasters')
    .select('id, city')
    .eq('is_active', true)
    .not('city', 'is', null);

  if (error) throw error;

  return ((data ?? []) as { id: string; city: string | null }[])
    .filter((roaster) => {
      const city = normalizeCityFilterValue(roaster.city);
      return city ? normalizedCities.has(city) : false;
    })
    .map((roaster) => roaster.id);
}

async function getLatestRoasterScrapeStatuses(
  roasterIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const uniqueRoasterIds = Array.from(new Set(roasterIds));
  const latestByRoasterId = new Map<string, LatestRoasterScrapeStatus>();

  if (uniqueRoasterIds.length === 0) return latestByRoasterId;

  const { data, error } = await supabase
    .from('scrape_logs')
    .select('roaster_id, status, started_at, completed_at, products_found, products_upserted, error_message')
    .in('roaster_id', uniqueRoasterIds)
    .order('started_at', { ascending: false });

  if (error) {
    console.warn('Could not load latest scrape status for coffee confidence', {
      code: error.code,
      message: error.message,
    });
    return latestByRoasterId;
  }

  const scrapeLogs = (data ?? []) as LatestRoasterScrapeRow[];

  for (const scrapeLog of scrapeLogs) {
    if (!scrapeLog.roaster_id || latestByRoasterId.has(scrapeLog.roaster_id)) continue;

    latestByRoasterId.set(scrapeLog.roaster_id, {
      status: scrapeLog.status,
      started_at: scrapeLog.started_at,
      completed_at: scrapeLog.completed_at,
      products_found: scrapeLog.products_found,
      products_upserted: scrapeLog.products_upserted,
      error_message: scrapeLog.error_message,
    });
  }

  return latestByRoasterId;
}

export async function getSimilarCoffees(coffee: CoffeeWithRoaster, limit = 4) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)')
    .eq('is_available', true)
    .neq('id', coffee.id)
    .or(
      `origin_country.eq.${coffee.origin_country},process.eq.${coffee.process}`
    )
    .order('click_count', { ascending: false })
    .limit(limit);

  return (data ?? []) as CoffeeWithRoaster[];
}

export async function getFeaturedCoffees(limit = 6) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)')
    .eq('is_available', true)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as CoffeeWithRoaster[];
}

export async function getStats() {
  const supabase = await createClient();

  const [coffeeResult, roasterResult, originResult] = await Promise.all([
    supabase.from('coffees').select('id', { count: 'exact', head: true }).eq('is_available', true),
    supabase.from('roasters').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('coffees').select('origin_country').eq('is_available', true).not('origin_country', 'is', null),
  ]);

  const uniqueOrigins = new Set(
    ((originResult.data ?? []) as { origin_country: string | null }[]).map((c) => c.origin_country)
  ).size;

  return {
    totalCoffees: coffeeResult.count ?? 0,
    totalRoasters: roasterResult.count ?? 0,
    totalOrigins: uniqueOrigins,
  };
}
