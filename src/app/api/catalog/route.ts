import { publicCatalogCoffee } from '../../../../shared/v2/public-catalog';
import { getCatalogCounts, lastGoodListingName, listCatalog, type CatalogFilters } from '../../../../shared/v2/catalog';
import { catalogLastGood, getCatalogDatabase } from '@/lib/v2-runtime';
import { getPageParamValue, normalizeSearchTerm } from '@/lib/filter-contract';
import { EDGE_CACHE_HEADERS } from '../../../../shared/v2/read-cache';
import { withLastGood } from '../../../../shared/v2/last-good';

export async function GET(request: Request) {
  try {
    const db = await getCatalogDatabase();
    const url = new URL(request.url);
    const filters: CatalogFilters = {
      page: getPageParamValue(url.searchParams.getAll('page')), perPage:24,
      origin:url.searchParams.getAll('origin'), process:url.searchParams.getAll('process'),
      taste:url.searchParams.getAll('taste'), roaster:url.searchParams.getAll('roaster'),
      search:normalizeSearchTerm(url.searchParams.get('q') ?? undefined),
    };
    // The unfiltered list falls back to its last-good copy; the answer then says when that copy was made and is not edge-cached.
    let copiedAt: string | null | undefined;
    const name = lastGoodListingName(filters);
    const listing = name ? withLastGood(await catalogLastGood(at => { copiedAt = at; }), name, () => listCatalog(db, filters)) : listCatalog(db, filters);
    const [counts, catalog] = await Promise.all([getCatalogCounts(db), listing]);
    const body = {counts,...catalog,coffees:catalog.coffees.map(publicCatalogCoffee)};
    return copiedAt === undefined ? Response.json(body,{headers:EDGE_CACHE_HEADERS})
      : Response.json({...body,copy:{writtenAt:copiedAt}},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({error:'Katalog şu anda yüklenemiyor.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
