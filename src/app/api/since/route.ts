import { catalogChangesByDay } from '../../../../shared/v2/catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { EDGE_CACHE_HEADERS, untilIstanbulMidnight } from '../../../../shared/v2/read-cache';

/** GET → { days: [{ day: 'YYYY-MM-DD' (Istanbul), NEW, PRICE_DROP, RESTOCKED }] }, 30 days, oldest first. Identical for everyone. Query parameters are ignored by the handler, but each distinct query string is its own edge entry. */
export async function GET() {
  try {
    // The 30 days end today in Istanbul, so an edge copy is not served past Istanbul midnight.
    return Response.json({ days: await catalogChangesByDay(await getCatalogDatabase()) }, { headers: { ...EDGE_CACHE_HEADERS, 'CDN-Cache-Control': untilIstanbulMidnight() } });
  } catch {
    return Response.json({ error: 'Değişiklikler şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
