import type { MetadataRoute } from 'next';
import { coffeeOnlySql } from '../../shared/v2/coffee-eligibility';
import { listRoasters } from '../../shared/v2/catalog';
import type { CatalogDatabase } from '../../shared/v2/database';
import { issues } from '../app/bulten/issues.generated';
import { listLandings } from './catalog-landing';
import { absoluteUrl } from './site';

const CATALOG_ROUTES = new Set(['/', '/yeni', '/firsatlar', '/kahveler', '/kavurucular']);
/**
 * lastModified is when the content really changed: first seen, a recorded event, or a price change.
 * Per-crawl "seen" and "touched" stamps move on every crawl and would claim daily edits, so they are not used.
 */
const CHANGED_SQL = `max(c.first_seen_at,
  coalesce((SELECT max(e.created_at) FROM coffee_events e WHERE e.coffee_id=c.id),''),
  coalesce((SELECT max(o.last_price_change_at) FROM offers o WHERE o.coffee_id=c.id),''))`;
type SitemapCoffees = { results: Array<{ slug: string; roaster_id: string; changed: string }> };
const date = (iso: string | undefined) => (iso ? new Date(iso) : undefined);

export function staticSitemap(latest?: string): MetadataRoute.Sitemap {
  const paths = ['/', '/yeni', '/firsatlar', '/kahveler', '/kavurucular', '/quiz', '/guide', '/privacy', '/terms', '/bulten', ...issues.filter(issue => issue.published).map(issue => `/bulten/${issue.month}`)];
  return paths.map(path => ({ url: absoluteUrl(path), lastModified: CATALOG_ROUTES.has(path) ? date(latest) : undefined, changeFrequency: 'weekly', priority: path === '/' ? 1 : 0.7 }));
}

/**
 * Only indexable, canonical addresses. Coffees come from the public catalog view, so hidden, sold-out
 * and grouped child coffees (and every coffee of an inactive roaster) stay out. Roasters are the ones
 * the roaster index lists: active, with at least one listed coffee. Landing pages: every origin and
 * process with listed coffees.
 */
export async function catalogSitemap(db: CatalogDatabase): Promise<MetadataRoute.Sitemap> {
  const [coffees, roasters, landings] = await Promise.all([
    // Same for every request until the next refresh; vinext never edge-caches the sitemap, so it is shared as a derived result.
    (db.derive ?? ((_: string, compute: () => Promise<SitemapCoffees>) => compute()))('sitemap-coffees', () => db.prepare(`SELECT c.slug, c.roaster_id, ${CHANGED_SQL} AS changed FROM public_catalog_coffees c WHERE ${coffeeOnlySql()}`).all<{ slug: string; roaster_id: string; changed: string }>()),
    listRoasters(db), listLandings(db),
  ]);
  const roasterChanged = new Map<string, string>();
  for (const c of coffees.results) if (c.changed > (roasterChanged.get(c.roaster_id) ?? '')) roasterChanged.set(c.roaster_id, c.changed);
  const latest = [...roasterChanged.values()].sort().at(-1);
  return [
    ...staticSitemap(latest),
    ...landings.map(landing => ({ url: absoluteUrl(landing.path) })),
    ...coffees.results.map(c => ({ url: absoluteUrl(`/kahve/${encodeURIComponent(c.slug)}`), lastModified: date(c.changed) })),
    ...roasters.map(r => ({ url: absoluteUrl(`/kavurucu/${encodeURIComponent(r.slug)}`), lastModified: date(roasterChanged.get(r.id)) })),
  ];
}
