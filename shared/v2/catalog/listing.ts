import { coffeeOnlySql } from '../coffee-eligibility';
import type { CatalogDatabase } from '../database';
import { buildFilters } from './filters';
import { hydrate, listedRows } from './hydrate';
import { indexable, indexMatches, listIndex } from './list-index';
import { ARRIVALS_JOIN, COFFEE_COLUMNS, GROUP_OFFERS, PACKAGE_KEY, PREFERRED_PRICE, UNIT_PRICE } from './sql';
import type { CatalogCoffee, CatalogFilters, CoffeeRow } from './types';
import { derived } from './util';

export async function getCatalogCounts(
  db: CatalogDatabase,
): Promise<{ coffees: number; roasters: number; offers: number }> {
  return derived(db, 'counts', async () => {
    const counts = await db
      .prepare(
        `SELECT count(DISTINCT c.id) AS coffees,count(DISTINCT c.roaster_id) AS roasters,count(DISTINCT ${PACKAGE_KEY}) AS offers FROM public_catalog_coffees c ${GROUP_OFFERS} AND o.in_stock=1 WHERE ${coffeeOnlySql()}`,
      )
      .first<{ coffees: number; roasters: number; offers: number }>();
    return counts ?? { coffees: 0, roasters: 0, offers: 0 };
  });
}

/** Every current-list count and row query starts from the same canonical view.
 * With a derived cache (the Worker), a list without free text or traceability is answered from the list index, computed once
 * per refresh: the page's ids come from the index and only those coffees are read by id (about 190 rows for 24, instead of
 * 7,000 to 20,000 for the query below), then hydrated. Tests and scripts, which have no derived cache, and every other list
 * run the query below. docs/read-budget.md has the numbers. */
export async function listCatalog(
  db: CatalogDatabase,
  filters: CatalogFilters = {},
  now = Date.now(),
): Promise<{ coffees: CatalogCoffee[]; total: number; page: number; perPage: number; totalPages: number }> {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const perPage = Number.isFinite(filters.perPage) ? Math.min(100, Math.max(1, Math.floor(filters.perPage!))) : 24;
  if (db.derive && indexable(filters)) {
    const matches = indexMatches(await listIndex(db), filters);
    const rows = await listedRows(
      db,
      matches.slice((page - 1) * perPage, page * perPage).map((coffee) => coffee[0]),
    );
    return {
      coffees: await hydrate(db, rows, now),
      total: matches.length,
      page,
      perPage,
      totalPages: Math.ceil(matches.length / perPage),
    };
  }
  const { where, values } = buildFilters(filters);
  const from = 'FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id';
  const sorts: Record<string, string> = {
    // Genuine arrivals first, newest first; coffees whose arrival is unknown follow in the order they entered the catalog.
    newest: 'a.arrived_at DESC NULLS LAST,c.first_seen_at DESC,c.id',
    price_asc: `${PREFERRED_PRICE} ASC NULLS LAST,c.id`,
    price_desc: `${PREFERRED_PRICE} DESC NULLS LAST,c.id`,
    unit_price_asc: `${UNIT_PRICE} ASC NULLS LAST,c.id`,
  };
  // One pass: the total rides on each row (the ORDER BY already visits every match), instead of a second scan to count.
  const order = sorts[filters.sort ?? 'newest'] ?? sorts.newest;
  // Arrival times only matter to the newest sort (about 3,000 rows); price sorts skip them.
  const rows = (
    await db
      .prepare(
        `SELECT ${COFFEE_COLUMNS},count(*) OVER() AS total_count ${from} ${order === sorts.newest ? ARRIVALS_JOIN : ''} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .bind(...values, perPage, (page - 1) * perPage)
      .all<CoffeeRow & { total_count: number }>()
  ).results;
  // Only a page past the end comes back empty while matches exist; then the count is asked for separately.
  const total = rows.length
    ? rows[0].total_count
    : page > 1
      ? ((
          await db
            .prepare(`SELECT count(*) AS count ${from} WHERE ${where}`)
            .bind(...values)
            .first<{ count: number }>()
        )?.count ?? 0)
      : 0;
  return { coffees: await hydrate(db, rows, now), total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

/** The unfiltered newest listing is kept as a last-good copy, one entry per page (src/lib/v2-runtime.ts, catalogLastGood);
 * any filter, search or other sort has none. The name is that entry's, or null. */
export function lastGoodListingName(filters: CatalogFilters): string | null {
  const lists = [filters.origin, filters.process, filters.taste, filters.roaster, filters.roast, filters.brewMethod];
  const texts = [filters.search, filters.farm, filters.producer, filters.variety, filters.altitude];
  if (
    lists.some((list) => list?.length) ||
    texts.some((text) => text?.trim()) ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    filters.traceability ||
    filters.event ||
    (filters.sort && filters.sort !== 'newest')
  )
    return null;
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const perPage = Number.isFinite(filters.perPage) ? Math.min(100, Math.max(1, Math.floor(filters.perPage!))) : 24;
  return `listing:newest:${perPage}:${page}`;
}

export async function countCatalog(db: CatalogDatabase, filters: CatalogFilters): Promise<number> {
  const { where, values } = buildFilters(filters);
  return (
    (
      await db
        .prepare(
          `SELECT count(*) AS count FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${where}`,
        )
        .bind(...values)
        .first<{ count: number }>()
    )?.count ?? 0
  );
}

/** Listed coffees and their roasters for one filter, counted with the catalog's own filter rules (origin and process landing pages). */
export async function catalogFacts(
  db: CatalogDatabase,
  filters: CatalogFilters,
): Promise<{ coffees: number; roasters: number }> {
  return (await catalogFactsMany(db, [filters]))[0];
}

/** catalogFacts for several filters in one pass over the listed coffees per query, not one pass per filter.
 * Callers pass a bounded set (the landing pages), since each distinct set is one derived-cache entry. */
export async function catalogFactsMany(
  db: CatalogDatabase,
  list: CatalogFilters[],
): Promise<Array<{ coffees: number; roasters: number }>> {
  return derived(db, `facts:${JSON.stringify(list)}`, async () => {
    // Through the list index when there is one (the landing facts: one more pass over 28 filters was about 150,000 rows).
    if (db.derive && list.every(indexable)) {
      const index = await listIndex(db);
      return list.map((filters) => {
        const matches = indexMatches(index, filters);
        return { coffees: matches.length, roasters: new Set(matches.map((coffee) => coffee[1])).size };
      });
    }
    const built = list.map((filters) => buildFilters(filters));
    const facts: Array<{ coffees: number; roasters: number }> = [];
    for (let start = 0; start < built.length;) {
      // D1 binds at most 100 parameters per statement.
      let end = start + 1,
        bound = built[start].values.length;
      while (end < built.length && bound + built[end].values.length <= 100) bound += built[end++].values.length;
      const chunk = built.slice(start, end);
      // Each filter is evaluated once per coffee (MATERIALIZED), then counted like catalogFacts' own count(*) and count(DISTINCT roaster).
      const row = await db
        .prepare(
          `WITH m AS MATERIALIZED (SELECT c.roaster_id${chunk.map((item, index) => `,(${item.conditions.slice(1).join(' AND ') || '1'}) AS m${index}`).join('')}
        FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()})
        SELECT ${chunk.map((_, index) => `count(CASE WHEN m${index} THEN 1 END) AS c${index},count(DISTINCT CASE WHEN m${index} THEN roaster_id END) AS r${index}`).join(',')} FROM m`,
        )
        .bind(...chunk.flatMap((item) => item.values))
        .first<Record<string, number>>();
      chunk.forEach((_, index) => facts.push({ coffees: row?.[`c${index}`] ?? 0, roasters: row?.[`r${index}`] ?? 0 }));
      start = end;
    }
    return facts;
  });
}
