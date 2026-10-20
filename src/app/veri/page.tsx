import type { Metadata } from 'next';
import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { JsonLd } from '@/components/layout/json-ld';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { CatalogNumbers, statsBreadcrumbs } from '@/components/v2/catalog-numbers';
import { STATS_PATH, catalogStats, statsDescription, statsTitle } from '@/lib/catalog-stats';
import { pageMetadata } from '@/lib/page-metadata';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;

/** One derived result (catalog-stats), built once per refresh by the nightly warm-up; a miss reads it (2 rows), a hit reads nothing. */
const loadStats = cache(async () => {
  try { return await catalogStats(await getCatalogDatabase()); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return null; }
});

export async function generateMetadata(): Promise<Metadata> {
  const stats = await loadStats();
  return pageMetadata(statsTitle(stats), statsDescription(stats), STATS_PATH, { type: 'article' });
}

export default async function DataPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  dropTrackingParams(STATS_PATH, await searchParams);
  const stats = await loadStats();
  if (!stats) return <div className="page-shell section-space"><JsonLd data={statsBreadcrumbs()} /><h1 className="mb-6 font-display text-title">Kahve kataloğu rakamları</h1><DataSourceNotice title="Rakamlar şu an yüklenemiyor." message="Güncel kataloğa ulaşamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/kahveler" actionLabel="Kataloğa git" /></div>;
  return <CatalogNumbers stats={stats} />;
}
