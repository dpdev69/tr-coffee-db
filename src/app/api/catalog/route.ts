import { publicCatalogCoffee } from '../../../../shared/v2/public-catalog';
import { getCatalogCounts, listCatalog } from '../../../../shared/v2/catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { EDGE_CACHE_HEADERS } from '../../../../shared/v2/read-cache';

export async function GET(request: Request) {
  try {
    const db = await getCatalogDatabase();
    const url = new URL(request.url);
    const [counts, catalog] = await Promise.all([getCatalogCounts(db),listCatalog(db, {
      page: Number(url.searchParams.get('page') || 1), perPage:24,
      origin:url.searchParams.getAll('origin'), process:url.searchParams.getAll('process'),
      taste:url.searchParams.getAll('taste'), roaster:url.searchParams.getAll('roaster'),
      search:url.searchParams.get('q') || undefined,
    })]);
    return Response.json({counts,...catalog,coffees:catalog.coffees.map(publicCatalogCoffee)},{headers:EDGE_CACHE_HEADERS});
  } catch {
    return Response.json({error:'Katalog şu anda yüklenemiyor.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
