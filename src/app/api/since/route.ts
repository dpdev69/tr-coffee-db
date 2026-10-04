import { catalogChangesByDay } from '../../../../shared/v2/catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';

/** GET → { days: [{ day: 'YYYY-MM-DD' (Istanbul), NEW, PRICE_DROP, RESTOCKED }] }, 30 days, oldest first. Identical for everyone; query parameters are ignored so the edge can cache one copy. */
export async function GET() {
  try {
    return Response.json({ days: await catalogChangesByDay(await getCatalogDatabase()) }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
  } catch {
    return Response.json({ error: 'Değişiklikler şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
