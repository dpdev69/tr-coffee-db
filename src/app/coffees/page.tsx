import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCoffees, type CoffeeFilters } from '@/lib/queries/coffees';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { SidebarFilters } from '@/components/coffee/sidebar-filters';
import { CoffeeCardSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

export const metadata: Metadata = {
  title: 'Explore Coffees',
  description:
    'Browse and filter specialty coffees from Turkish roasters. Compare by origin, process, roast level, flavor, and price.',
};

export default async function CoffeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-stone-900">Explore Coffees</h1>
      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-64">
          <Suspense fallback={<div className="h-96 animate-pulse rounded bg-stone-100" />}>
            <FiltersLoader />
          </Suspense>
        </div>

        {/* Main grid */}
        <div className="flex-1">
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CoffeeCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <CoffeesLoader params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function FiltersLoader() {
  let countries: string[] = [];
  let roasters: { slug: string; name: string }[] = [];

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const [countryResult, roasterResult] = await Promise.all([
      supabase
        .from('coffees')
        .select('origin_country')
        .eq('is_available', true)
        .not('origin_country', 'is', null),
      supabase
        .from('roasters')
        .select('slug, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    countries = [
      ...new Set(
        ((countryResult.data ?? []) as { origin_country: string | null }[])
          .map((c) => c.origin_country)
          .filter((c): c is string => c !== null)
      ),
    ].sort();

    roasters = (roasterResult.data ?? []) as { slug: string; name: string }[];
  } catch {
    // Supabase not configured
  }

  return <SidebarFilters countries={countries} roasters={roasters} />;
}

async function CoffeesLoader({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const toArray = (v: string | string[] | undefined): string[] | undefined => {
    if (!v) return undefined;
    return Array.isArray(v) ? v : [v];
  };

  const filters: CoffeeFilters = {
    origin: toArray(params.origin),
    process: toArray(params.process),
    roastLevel: toArray(params.roastLevel),
    roaster: toArray(params.roaster),
    flavorCategory: toArray(params.flavorCategory),
    brewMethod: toArray(params.brewMethod),
    search: typeof params.search === 'string' ? params.search : undefined,
    sort: (params.sort as CoffeeFilters['sort']) ?? 'newest',
    page: params.page ? parseInt(params.page as string) : 1,
    perPage: 24,
  };

  let result = { coffees: [], total: 0, page: 1, perPage: 24, totalPages: 0 } as Awaited<
    ReturnType<typeof getCoffees>
  >;

  try {
    result = await getCoffees(filters);
  } catch {
    // Supabase not configured
  }

  return (
    <>
      <p className="mb-4 text-sm text-stone-500">
        {result.total} coffee{result.total !== 1 ? 's' : ''} found
      </p>
      <CoffeeGrid coffees={result.coffees} />
      {result.totalPages > 1 && (
        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
        />
      )}
    </>
  );
}
