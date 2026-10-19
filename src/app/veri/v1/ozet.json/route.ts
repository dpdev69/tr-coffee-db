import { catalogStats, statsJson } from '@/lib/catalog-stats';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { EDGE_CACHE_HEADERS } from '../../../../../shared/v2/read-cache';

/** GET → the numbers on /veri as open data (CC BY 4.0), at a stable address: same derived result as the page, so a miss reads
 * 2 rows and an edge hit none. Every figure carries its own date (asOf, refreshedAt, generatedAt), so a copy served from the
 * last-good store during an outage still says which night it describes. Query strings are canonicalised away by the miss guard. */
export async function GET() {
  try {
    return Response.json(statsJson(await catalogStats(await getCatalogDatabase())), { headers: { ...EDGE_CACHE_HEADERS, 'Access-Control-Allow-Origin': '*' } });
  } catch {
    return Response.json({ error: 'Veri şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
