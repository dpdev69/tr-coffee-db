import { createClient } from '@/lib/supabase/server';
import {
  CATALOG_NAME_EXCLUSION_PATTERNS,
  getCurrentCatalogCutoffIso,
  SINGLE_ORIGIN_NAME_EXCLUSION_PATTERNS,
} from '@/lib/catalog-rules';
import { normalizeCityFilterValue, normalizeSearchTerm } from '@/lib/filter-contract';
import { coffeeMatchesSearch } from '@/lib/coffee-search';
import type { CoffeeSortOption } from '@/lib/constants/filter-options';
import { applyPublicCoffeeVisibility } from '@/lib/public-coffee-visibility';
import type { CoffeeWithRoaster } from '@/lib/types/database';

type PublicCatalogCoffeeVisibilityQuery<TSelf> = {
  eq(column: string, value: unknown): TSelf;
  gte(column: string, value: string): TSelf;
  not(column: string, operator: string, value: unknown): TSelf;
};

type CoffeeSearchRpcClient = {
  rpc(
    functionName: 'search_coffees',
    args: { query: string }
  ): Promise<{
    data: Array<{ id: string }> | null;
    error: { code?: string; message: string } | null;
  }>;
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
  const searchTerm = normalizeSearchTerm(filters.search);
  const currentCutoff = getCurrentCatalogCutoffIso();
  const searchCoffeeIds = searchTerm
    ? await getCoffeeIdsForSearch(searchTerm, supabase, currentCutoff)
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
  if (searchCoffeeIds && searchCoffeeIds.length === 0) {
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
    .select('*, roasters!inner(name, slug, city)', { count: 'exact' });

  query = applyPublicCatalogCoffeeVisibility(query, currentCutoff);

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
  if (searchCoffeeIds?.length) {
    query = query.in('id', searchCoffeeIds);
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
  if (filters.isDecaf != null) {
    query = query.eq('is_decaf', filters.isDecaf);
  }
  // Sorting
  switch (filters.sort) {
    case 'price_asc':
      query = query.order('price_amount', { ascending: true, nullsFirst: false });
      break;
    case 'price_desc':
      query = query.order('price_amount', { ascending: false, nullsFirst: false });
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

  return {
    coffees: (data ?? []) as CoffeeWithRoaster[],
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

async function getCoffeeIdsForSearch(
  searchTerm: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentCutoff = getCurrentCatalogCutoffIso()
) {
  const rpcResult = await (supabase as unknown as CoffeeSearchRpcClient).rpc(
    'search_coffees',
    { query: searchTerm }
  );
  if (!rpcResult.error) {
    const ids = ((rpcResult.data ?? []) as Array<{ id: string }>).map((coffee) => coffee.id);
    if (ids.length > 0) return ids;

    console.info('Catalog search RPC returned no rows; falling back to local scan');
  } else {
    console.error('Catalog search RPC failed; falling back to local scan', {
      code: rpcResult.error.code,
      message: rpcResult.error.message,
    });
  }

  const pageSize = 1000;
  let from = 0;
  const ids: string[] = [];

  while (true) {
    let query = supabase
      .from('coffees')
      .select(
        'id, name, name_normalized, origin_country, origin_region, origin_farm, origin_producer, process, process_detail, roast_level, variety, flavor_notes, flavor_notes_normalized, flavor_categories, brew_methods, roasters!inner(name)'
      )
      .range(from, from + pageSize - 1);

    query = applyPublicCatalogCoffeeVisibility(query, currentCutoff);

    const { data, error } = await query;

    if (error) throw error;
    const rows = (data ?? []) as Array<Parameters<typeof coffeeMatchesSearch>[0] & { id: string }>;

    ids.push(
      ...rows
        .filter((coffee) => coffeeMatchesSearch(coffee, searchTerm))
        .map((coffee) => coffee.id)
    );

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

export async function getCoffeeBySlug(slug: string) {
  const supabase = await createClient();

  let query = supabase
    .from('coffees')
    .select('*, roasters!inner(id, name, slug, city, website_url, shop_url, logo_url)')
    .eq('slug', slug);

  query = applyPublicCatalogCoffeeVisibility(query);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as CoffeeWithRoaster & {
    roasters: { id: string; website_url: string; shop_url: string; logo_url: string | null };
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

export async function getSimilarCoffees(coffee: CoffeeWithRoaster, limit = 4) {
  const supabase = await createClient();
  const candidates = await Promise.all([
    coffee.origin_country
      ? getSimilarCoffeesByField(supabase, coffee.id, 'origin_country', coffee.origin_country, limit)
      : Promise.resolve([]),
    coffee.process && coffee.process !== 'unknown'
      ? getSimilarCoffeesByField(supabase, coffee.id, 'process', coffee.process, limit)
      : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  return candidates
    .flat()
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    })
    .slice(0, limit);
}

async function getSimilarCoffeesByField(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coffeeId: string,
  field: 'origin_country' | 'process',
  value: string,
  limit: number
) {
  let query = supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)')
    .neq('id', coffeeId)
    .eq(field, value)
    .order('click_count', { ascending: false })
    .limit(limit);

  query = applyPublicCatalogCoffeeVisibility(query);

  const { data } = await query;

  return (data ?? []) as CoffeeWithRoaster[];
}

export async function getFeaturedCoffees(limit = 6) {
  const supabase = await createClient();

  let query = supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  query = applyPublicCatalogCoffeeVisibility(query);

  const { data } = await query;

  return (data ?? []) as CoffeeWithRoaster[];
}

export async function getStats() {
  const supabase = await createClient();

  const [coffeeResult, roasterResult, originResult] = await Promise.all([
    applyPublicCatalogCoffeeVisibility(
      supabase
        .from('coffees')
        .select('id', { count: 'exact', head: true })
    ),
    applyPublicCatalogCoffeeVisibility(
      supabase
        .from('coffees')
        .select('roaster_id')
    ),
    applyPublicCatalogCoffeeVisibility(
      supabase
        .from('coffees')
        .select('origin_country')
    ).not('origin_country', 'is', null),
  ]);

  const uniqueOrigins = new Set(
    ((originResult.data ?? []) as { origin_country: string | null }[]).map((c) => c.origin_country)
  ).size;
  const uniqueRoasters = new Set(
    ((roasterResult.data ?? []) as { roaster_id: string }[]).map((c) => c.roaster_id)
  ).size;

  return {
    totalCoffees: coffeeResult.count ?? 0,
    totalRoasters: uniqueRoasters,
    totalOrigins: uniqueOrigins,
  };
}

export function applyPublicCatalogCoffeeVisibility<
  TQuery extends PublicCatalogCoffeeVisibilityQuery<TQuery>,
>(query: TQuery, currentCutoff?: string): TQuery {
  let nextQuery = applyPublicCoffeeVisibility(query, currentCutoff);

  for (const pattern of CATALOG_NAME_EXCLUSION_PATTERNS) {
    nextQuery = nextQuery.not('name', 'ilike', pattern);
  }

  return nextQuery;
}
