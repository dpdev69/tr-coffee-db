import { coffeeOnlySql } from '../coffee-eligibility';
import type { CatalogDatabase } from '../database';
import { listCatalog } from './listing';
import { GROUP_OFFERS, PACKAGE_KEY } from './sql';
import type { CatalogRoaster } from './types';
import { derived } from './util';

export async function listRoasters(db: CatalogDatabase): Promise<CatalogRoaster[]> {
  return derived(db, 'roasters', async () => {
    const rows = await db
      .prepare(
        `SELECT r.*,count(DISTINCT c.id) AS coffee_count,count(DISTINCT ${PACKAGE_KEY}) AS offer_count FROM roasters r JOIN public_catalog_coffees c ON c.roaster_id=r.id ${GROUP_OFFERS} AND o.in_stock=1 WHERE ${coffeeOnlySql()} GROUP BY r.id ORDER BY r.name,r.id`,
      )
      .all<{
        id: string;
        slug: string;
        name: string;
        website_url: string;
        city: string | null;
        adapter: string;
        coffee_count: number;
        offer_count: number;
        last_attempt_at: string | null;
        last_success_at: string | null;
        crawl_health: string;
      }>();
    return rows.results.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      websiteUrl: r.website_url,
      city: r.city,
      adapter: r.adapter,
      coffeeCount: r.coffee_count,
      offerCount: r.offer_count,
      lastAttemptAt: r.last_attempt_at,
      lastSuccessAt: r.last_success_at,
      crawlHealth: r.crawl_health,
    }));
  });
}

export async function getRoasterDetail(
  db: CatalogDatabase,
  slug: string,
): Promise<{ roaster: CatalogRoaster; catalog: Awaited<ReturnType<typeof listCatalog>> } | null> {
  const row = await db
    .prepare(
      'SELECT id,slug,name,website_url,city,adapter,last_attempt_at,last_success_at,crawl_health FROM roasters WHERE slug=?',
    )
    .bind(slug)
    .first<{
      id: string;
      slug: string;
      name: string;
      website_url: string;
      city: string | null;
      adapter: string;
      last_attempt_at: string | null;
      last_success_at: string | null;
      crawl_health: string;
    }>();
  if (!row) return null;
  const catalog = await listCatalog(db, { roaster: [slug] });
  // The roaster list (derived once per refresh) already counts every roaster's packages with this query's rules; a roaster
  // missing from it has no package in stock. Without a derived cache (tests, scripts) the count is read here.
  const offerCount = db.derive
    ? ((await listRoasters(db)).find((roaster) => roaster.id === row.id)?.offerCount ?? 0)
    : ((
        await db
          .prepare(
            `SELECT count(DISTINCT ${PACKAGE_KEY}) AS count FROM public_catalog_coffees c ${GROUP_OFFERS} WHERE c.roaster_id=? AND o.in_stock=1 AND ${coffeeOnlySql()}`,
          )
          .bind(row.id)
          .first<{ count: number }>()
      )?.count ?? 0);
  return {
    roaster: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      websiteUrl: row.website_url,
      city: row.city,
      adapter: row.adapter,
      coffeeCount: catalog.total,
      offerCount,
      lastAttemptAt: row.last_attempt_at,
      lastSuccessAt: row.last_success_at,
      crawlHealth: row.crawl_health,
    },
    catalog,
  };
}
