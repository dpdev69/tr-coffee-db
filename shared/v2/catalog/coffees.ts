import { FACT_FEATURES } from '../profile-truth';
import { coffeeOnlySql } from '../coffee-eligibility';
import type { CatalogDatabase } from '../database';
import type { PriceObservation } from '../types';
import { hydrate } from './hydrate';
import { COFFEE_COLUMNS, placeholders } from './sql';
import type { CatalogCoffee, CoffeeRow } from './types';
import { derived } from './util';

/** One listed coffee per Istanbul calendar day, the same for everyone, chosen among coffees with tasting notes and an image.
 * Candidates are dealt round-robin by roaster, so consecutive days land on different roasters while the list is stable.
 * ponytail: a catalog that changes size overnight can shift the slot and repeat a roaster; store yesterday's pick if that matters. */
export async function getCoffeeOfTheDay(db: CatalogDatabase, now = Date.now()): Promise<CatalogCoffee | null> {
  const order = await derived(db, 'day-order', async () => {
    const candidates = await db
      .prepare(
        `SELECT c.id,c.roaster_id FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} AND json_array_length(c.raw_metadata_json,'$.tastingNotes')>0 AND json_extract(c.raw_metadata_json,'$.imageUrl') LIKE 'http%' ORDER BY c.roaster_id,c.id`,
      )
      .all<{ id: string; roaster_id: string }>();
    const byRoaster = new Map<string, string[]>();
    for (const row of candidates.results)
      byRoaster.set(row.roaster_id, [...(byRoaster.get(row.roaster_id) ?? []), row.id]);
    const queues = [...byRoaster.values()];
    const order: string[] = [];
    for (let round = 0; order.length < candidates.results.length; round++)
      for (const queue of queues) if (queue[round]) order.push(queue[round]);
    return order;
  });
  const day = Math.floor((now + 3 * 3600000) / 86400000);
  // Read repair can still empty a listing's notes; the next slot stands in.
  for (let step = 0; step < Math.min(order.length, 5); step++) {
    const row = await db
      .prepare(
        `SELECT ${COFFEE_COLUMNS} FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.id=?`,
      )
      .bind(order[(day + step) % order.length])
      .first<CoffeeRow>();
    const [coffee] = await hydrate(db, row ? [row] : [], now);
    if (coffee?.rawMetadata.tastingNotes?.length && /^https?:\/\//.test(coffee.rawMetadata.imageUrl ?? ''))
      return coffee;
  }
  return null;
}

export const SAVED_SLUG = /^[a-z0-9_-]{1,240}$/i;
export const SAVED_LIMIT = 50;
/** Current state of saved coffees, including sold-out ones. A twin's slug resolves to its group's parent. A deactivated roaster's coffees are left out (they read as gone). */
export async function getSavedCoffees(
  db: CatalogDatabase,
  slugs: string[],
  now = Date.now(),
): Promise<Array<{ savedSlug: string; availability: 'listed' | 'sold_out' | 'gone'; coffee: CatalogCoffee }>> {
  const wanted = [...new Set(slugs.filter((slug) => SAVED_SLUG.test(slug)))].slice(0, SAVED_LIMIT);
  if (!wanted.length) return [];
  const rows = await db
    .prepare(
      `SELECT ${COFFEE_COLUMNS},x.slug AS saved_slug,EXISTS(SELECT 1 FROM public_catalog_coffees p WHERE p.id=c.id) AS listed FROM coffees x JOIN coffees c ON c.id=coalesce(x.canonical_coffee_id,x.id) JOIN roasters r ON r.id=c.roaster_id WHERE x.slug IN (${placeholders(wanted.length)}) AND r.active=1 AND c.visibility='public' AND ${coffeeOnlySql()}`,
    )
    .bind(...wanted)
    .all<CoffeeRow & { saved_slug: string; listed: number }>();
  const coffees = await hydrate(db, rows.results, now);
  return coffees.map((coffee, index) => ({
    savedSlug: rows.results[index].saved_slug,
    coffee,
    availability: rows.results[index].listed
      ? 'listed'
      : !coffee.discontinuedAt && coffee.offers.some((offer) => offer.inStock === false)
        ? 'sold_out'
        : 'gone',
  }));
}

/** Origin filter options follow the filter rule: a MANUAL origin replaces raw and inferred origins for its coffee. */
export async function listOrigins(db: CatalogDatabase): Promise<string[]> {
  return derived(db, 'origins', async () => {
    const features = FACT_FEATURES.country.map((feature) => `'${feature}'`).join(',');
    const manual = `EXISTS(SELECT 1 FROM coffee_feature_values m WHERE m.coffee_id=c.id AND m.source_type='MANUAL' AND m.feature IN (${features}))`;
    const rows = await db
      .prepare(
        `SELECT DISTINCT value FROM (SELECT json_extract(c.raw_metadata_json,'$.country') AS value FROM public_catalog_coffees c WHERE NOT ${manual} UNION ALL SELECT j.value FROM coffee_feature_values f JOIN public_catalog_coffees c ON c.id=f.coffee_id JOIN json_each(f.value_json) j WHERE f.feature IN (${features}) AND j.type='text' AND (f.source_type='MANUAL' OR NOT ${manual})) WHERE value IS NOT NULL AND value<>'unknown' ORDER BY value`,
      )
      .all<{ value: string }>();
    return rows.results.map((row) => row.value);
  });
}

/** Details are durable even after stock loss/discontinuation; hidden/unclassified coffees stay private.
 * No page shows a price history, so the coffee page no longer reads one (it was every observation of the coffee's offers,
 * about 640 rows a view, sorted to keep 200); getPriceHistory reads it for whatever needs it. */
export async function getCoffeeDetail(
  db: CatalogDatabase,
  slugOrId: string,
  now = Date.now(),
): Promise<CatalogCoffee | null> {
  const row = await db
    .prepare(
      `SELECT ${COFFEE_COLUMNS} FROM coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.visibility='public' AND ${coffeeOnlySql()} AND c.id IN (SELECT coalesce(x.canonical_coffee_id,x.id) FROM coffees x WHERE x.id IN (SELECT id FROM coffees WHERE slug=? UNION SELECT id FROM coffees WHERE id=? UNION SELECT coffee_id FROM coffee_aliases WHERE alias_type='slug' AND alias=?)) LIMIT 1`,
    )
    .bind(slugOrId, slugOrId, slugOrId)
    .first<CoffeeRow>();
  if (!row) return null;
  return (await hydrate(db, [row], now))[0];
}

/** The newest observations of a listed coffee's offers and its size twins' (the id getCoffeeDetail returns), newest first. */
export async function getPriceHistory(db: CatalogDatabase, coffeeId: string, limit = 200): Promise<PriceObservation[]> {
  const history = await db
    .prepare(
      `SELECT p.* FROM price_observations p JOIN offers o ON o.id=p.offer_id JOIN coffee_group_members g ON g.coffee_id=o.coffee_id WHERE g.group_id=? ORDER BY p.observed_at DESC,p.id DESC LIMIT ?`,
    )
    .bind(coffeeId, Math.min(1000, Math.max(1, Math.floor(limit))))
    .all<{
      id: string;
      offer_id: string;
      crawl_run_id: string;
      observed_at: string;
      price_minor: number | null;
      compare_at_minor: number | null;
      weight_g: number | null;
      currency: string | null;
      in_stock: number | null;
      source: 'crawl' | 'import';
    }>();
  return history.results.map((p) => ({
    id: p.id,
    offerId: p.offer_id,
    crawlRunId: p.crawl_run_id,
    observedAt: p.observed_at,
    priceMinor: p.price_minor,
    compareAtMinor: p.compare_at_minor,
    weightG: p.weight_g,
    currency: p.currency,
    inStock: p.in_stock === null ? null : p.in_stock === 1,
    source: p.source,
  }));
}
