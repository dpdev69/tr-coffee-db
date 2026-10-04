import { coffeeOnlySql } from '../../shared/v2/coffee-eligibility';
import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { getCatalogDatabase } from '@/lib/v2-runtime';

export const revalidate = 3600;
const CATALOG_ROUTES = new Set(['/', '/yeni', '/firsatlar', '/kahveler', '/kavurucular']);
/**
 * lastModified is when the content really changed: first seen, a recorded event, or a price change.
 * Coffees come from the public catalog view, so hidden, sold-out and grouped child coffees stay out.
 * Per-crawl "seen" and "touched" stamps move on every crawl and would claim daily edits, so they are not used.
 */
const CHANGED_SQL = `max(c.first_seen_at,
  coalesce((SELECT max(e.created_at) FROM coffee_events e WHERE e.coffee_id=c.id),''),
  coalesce((SELECT max(o.last_price_change_at) FROM offers o WHERE o.coffee_id=c.id),''))`;
const date = (iso: string | undefined) => (iso ? new Date(iso) : undefined);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ['/', '/yeni', '/firsatlar', '/kahveler', '/kavurucular', '/quiz', '/guide', '/privacy', '/terms'];
  const routes = (latest?: string): MetadataRoute.Sitemap => paths.map(path => ({url:absoluteUrl(path), lastModified:CATALOG_ROUTES.has(path)?date(latest):undefined, changeFrequency:'weekly', priority:path==='/'?1:0.7}));
  try {
    const db=await getCatalogDatabase();
    const coffees=await db.prepare(`SELECT c.slug, c.roaster_id, ${CHANGED_SQL} AS changed FROM public_catalog_coffees c WHERE ${coffeeOnlySql()}`).all<{slug:string;roaster_id:string;changed:string}>();
    const roasters=await db.prepare('SELECT id, slug FROM roasters WHERE active=1').all<{id:string;slug:string}>();
    const roasterChanged=new Map<string,string>();
    for (const c of coffees.results) if (c.changed > (roasterChanged.get(c.roaster_id) ?? '')) roasterChanged.set(c.roaster_id, c.changed);
    const latest=[...roasterChanged.values()].sort().at(-1);
    return [...routes(latest),...coffees.results.map(c=>({url:absoluteUrl(`/kahve/${encodeURIComponent(c.slug)}`),lastModified:date(c.changed)})),...roasters.results.map(r=>({url:absoluteUrl(`/kavurucu/${encodeURIComponent(r.slug)}`),lastModified:date(roasterChanged.get(r.id))}))];
  } catch { return routes(); }
}
