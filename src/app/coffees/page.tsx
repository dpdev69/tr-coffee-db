import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import {
  applyPublicCatalogCoffeeVisibility,
  getCoffees,
  type CoffeeFilters,
} from '@/lib/queries/coffees';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { ActiveFilterSummary } from '@/components/coffee/active-filter-summary';
import { SidebarFilters } from '@/components/coffee/sidebar-filters';
import { CoffeeCardSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { parseCoffeeFilters } from '@/lib/coffee-filters';
import { getCurrentCatalogCutoffIso } from '@/lib/catalog-rules';
import { SITE_NAME } from '@/lib/site';
import { DataSourceNotice } from '@/components/ui/data-source-notice';

const description =
  'Türkiye’deki bağımsız kavurucuların güncel çekirdeklerini keşfedin. Köken, işleme, kavrum, tat, demleme yöntemi ve kavurucunun verdiği fiyatla filtreleyin.';

export const metadata: Metadata = {
  title: 'Kahve Kataloğu',
  description,
  alternates: {
    canonical: '/coffees',
  },
  openGraph: {
    title: `Kahve Kataloğu | ${SITE_NAME}`,
    description,
    url: '/coffees',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Kahve Kataloğu | ${SITE_NAME}`,
    description,
  },
};

export default async function CoffeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
          Kahve kataloğu
        </p>
        <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">
          Güncel çekirdekleri tara.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#5d5853] sm:text-base">
          Köken, işleme, kavrum, demleme yöntemi ve kavurucunun verdiği fiyatla
          sana yakın kahveleri hızlıca daralt.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-5 lg:mt-8 lg:flex-row lg:gap-8">
        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-64">
          <Suspense fallback={<div className="h-14 animate-pulse rounded bg-stone-100 lg:h-96" />}>
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
  let filtersUnavailable = false;

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const currentCutoff = getCurrentCatalogCutoffIso();

    const [countryResult, roasterResult] = await Promise.all([
      applyPublicCatalogCoffeeVisibility(
        supabase
          .from('coffees')
          .select('origin_country'),
        currentCutoff
      ).not('origin_country', 'is', null),
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
  } catch (error) {
    unstable_rethrow(error);
    filtersUnavailable = true;
    console.error('Coffee filters failed to load', {
      error: getErrorMessage(error),
    });
  }

  return (
    <div className="space-y-4">
      {filtersUnavailable && (
        <DataSourceNotice
          title="Filtre seçenekleri geçici olarak eksik."
          message="Katalog veri kaynağına şu an ulaşamadık. Bu, filtrelerin olmadığı anlamına gelmez; bağlantı düzeldiğinde seçenekler yeniden görünür."
        />
      )}
      <SidebarFilters countries={countries} roasters={roasters} />
    </div>
  );
}

async function CoffeesLoader({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const filters: CoffeeFilters = parseCoffeeFilters(params);

  let result = { coffees: [], total: 0, page: 1, perPage: 24, totalPages: 0 } as Awaited<
    ReturnType<typeof getCoffees>
  >;
  let catalogUnavailable = false;

  try {
    result = await getCoffees(filters);
  } catch (error) {
    unstable_rethrow(error);
    catalogUnavailable = true;
    console.error('Coffee catalog failed to load', {
      error: getErrorMessage(error),
      filters: getFilterLogContext(filters),
    });
  }

  if (catalogUnavailable) {
    return (
      <DataSourceNotice
        title="Katalog geçici olarak yüklenemiyor."
        message="Veri kaynağına şu an ulaşamadık. Bu sıfır sonuç değil; güncel kahve listesini doğrulayamıyoruz. Biraz sonra tekrar deneyin."
        actionHref="/coffees"
        actionLabel="Katalog sayfasını yeniden aç"
      />
    );
  }

  return (
    <>
      <ActiveFilterSummary filters={filters} total={result.total} />
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getFilterLogContext(filters: CoffeeFilters) {
  return {
    hasSearch: Boolean(filters.search),
    activeFilterKeys: Object.entries(filters)
      .filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== 'newest' && value !== 24;
      })
      .map(([key]) => key)
      .sort(),
    page: filters.page,
    sort: filters.sort,
  };
}
