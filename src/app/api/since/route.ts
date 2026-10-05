import { catalogChangesByDay } from '../../../../shared/v2/catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { EDGE_CACHE_CONTROL, EDGE_CACHE_HEADERS } from '../../../../shared/v2/read-cache';

/** GET → { days: [{ day: 'YYYY-MM-DD' (Istanbul), NEW, PRICE_DROP, RESTOCKED }] }, 30 days, oldest first. Identical for everyone; query parameters are ignored so the edge can cache one copy. */
export async function GET() {
  try {
    // The 30 days end today in Istanbul, so an edge copy expires at Istanbul midnight at the latest.
    const untilMidnight = 86400 - Math.floor((Date.now() + 3 * 3600000) / 1000) % 86400;
    const edge = EDGE_CACHE_CONTROL.replace(/max-age=\d+/, maxAge => `max-age=${Math.min(Number(maxAge.slice(8)), untilMidnight)}`);
    return Response.json({ days: await catalogChangesByDay(await getCatalogDatabase()) }, { headers: { ...EDGE_CACHE_HEADERS, 'CDN-Cache-Control': edge } });
  } catch {
    return Response.json({ error: 'Değişiklikler şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
