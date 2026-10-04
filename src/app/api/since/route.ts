import { catalogChangesSince } from '../../../../shared/v2/catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';

/** GET ?since=<ISO UTC time> → { since, counts: { NEW, PRICE_DROP, RESTOCKED } }. Not personal: any visitor with the same time gets the same counts. */
export async function GET(request: Request) {
  try {
    const result = await catalogChangesSince(await getCatalogDatabase(), new URL(request.url).searchParams.get('since'));
    if (!result) return Response.json({ error: 'since must be an ISO UTC time that is not in the future.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Değişiklikler şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
