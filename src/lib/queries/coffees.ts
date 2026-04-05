import { createClient } from '@/lib/supabase/server';
import type { CoffeeWithRoaster } from '@/lib/types/database';

export interface CoffeeFilters {
  origin?: string[];
  process?: string[];
  roastLevel?: string[];
  roaster?: string[];
  flavorCategory?: string[];
  brewMethod?: string[];
  priceMin?: number;
  priceMax?: number;
  isDecaf?: boolean;
  search?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  perPage?: number;
}

export async function getCoffees(filters: CoffeeFilters = {}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 24;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('coffees')
    .select('*, roasters!inner(name, slug, city)', { count: 'exact' })
    .eq('is_available', true);

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
  if (filters.flavorCategory?.length) {
    query = query.overlaps('flavor_categories', filters.flavorCategory);
  }
  if (filters.brewMethod?.length) {
    query = query.overlaps('brew_methods', filters.brewMethod);
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
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,origin_country.ilike.%${filters.search}%,origin_region.ilike.%${filters.search}%`
    );
  }

  // Sorting
  switch (filters.sort) {
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

  return {
    coffees: (data ?? []) as CoffeeWithRoaster[],
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
