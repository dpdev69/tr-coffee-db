import { getSavedCoffees, SAVED_LIMIT } from '../../../../shared/v2/catalog';
import { publicCatalogCoffee } from '../../../../shared/v2/public-catalog';
import { getCatalogDatabase } from '@/lib/v2-runtime';

/** GET ?slug=a&slug=b (at most 50, unknown or malformed slugs are skipped) → { items: [{ slug, availability, restockedAt, coffee }] }. Nothing is stored. */
export async function GET(request: Request) {
  const slugs = new URL(request.url).searchParams.getAll('slug');
  if (slugs.length > SAVED_LIMIT) return Response.json({ error: `En fazla ${SAVED_LIMIT} kahve.` }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const items = await getSavedCoffees(await getCatalogDatabase(), slugs);
    return Response.json({ items: items.map(({ savedSlug, availability, coffee }) => ({
      slug: savedSlug, availability,
      restockedAt: coffee.latestEvents.find(event => event.type === 'RESTOCKED')?.createdAt ?? null,
      coffee: publicCatalogCoffee(coffee),
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Listen şu anda yüklenemiyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
