import { FACT_FEATURES } from '../profile-truth';
import { coffeeOnlySql } from '../coffee-eligibility';
import { countryFilterAliases } from '../country-labels';
import type { CatalogDatabase } from '../database';
import { ARRIVALS_JOIN, EVENT_TYPES, eventValidity, PREFERRED_PRICE, UNIT_PRICE } from './sql';
import type { CatalogFilters } from './types';
import { derived, parseJson } from './util';

/** The list filters the index answers by itself: the closed facets, roasters, price and the event feeds (each listed coffee's
 * newest still-valid event of each type is in the index; a feed's window, which moves with the clock, is applied per request).
 * Free text (search, farm, producer, variety, altitude) and traceability (no page offers it; its evidence query reads about
 * 450,000 rows over the whole catalog) read live. */
const INDEXED_FACETS = [
  ['origin', 'country'],
  ['process', 'process'],
  ['roast', 'roast'],
  ['taste', 'tastingNotes'],
  ['brewMethod', 'brewMethods'],
] as const;
const LIST_SORTS = ['newest', 'price_asc', 'price_desc', 'unit_price_asc'] as const;
type ListSort = (typeof LIST_SORTS)[number];
/** Every listed coffee as the list query sees it: [id, roaster slug, preferred price, then per INDEXED_FACETS field the text values its filter can match, as positions in `values`]. `order` holds each sort's order. */
export type ListIndexCoffee = [id: string, roaster: string, price: number | null, ...facets: number[][]];
export interface ListIndex {
  values: string[];
  coffees: ListIndexCoffee[];
  order: Record<ListSort, number[]>;
  /** Per event type: [coffee position, time of its newest event of that type that still counts (eventValidity)]. */
  events: Record<string, Array<[at: number, createdAt: string]>>;
}

export function indexable(filters: CatalogFilters): boolean {
  return (
    ![filters.search, filters.farm, filters.producer, filters.variety, filters.altitude].some((text) => text?.trim()) &&
    filters.traceability !== 'available' &&
    filters.traceability !== 'missing'
  );
}

/** The text values a facet filter can match on coffee c, exactly as buildFilters' metadata() matches them: with a reviewed
 * MANUAL fact only the MANUAL values, otherwise the raw field (the value itself and its elements) and every feature value
 * (itself and its elements). The filter binds a JSON array of strings, so only text can ever be equal. */
function facetValuesSql(field: string): string {
  const features = FACT_FEATURES[field].map((feature) => `'${feature}'`).join(',');
  const manual = `EXISTS(SELECT 1 FROM coffee_feature_values m WHERE m.coffee_id=c.id AND m.source_type='MANUAL' AND m.feature IN (${features}))`;
  const own = `coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${features}) AND (f.source_type='MANUAL' OR NOT ${manual})`;
  return `(SELECT json_group_array(v) FROM (SELECT DISTINCT v||'' AS v FROM (SELECT json_extract(c.raw_metadata_json,'$.${field}') AS v WHERE NOT ${manual}
    UNION ALL SELECT j.value FROM json_each(c.raw_metadata_json,'$.${field}') j WHERE NOT ${manual}
    UNION ALL SELECT json_extract(f.value_json,'$') FROM ${own}
    UNION ALL SELECT j.value FROM ${own.replace('coffee_feature_values f', 'coffee_feature_values f,json_each(f.value_json) j')}) WHERE typeof(v)='text' ORDER BY 1))`;
}

/** Binary order, as SQLite compares text (ids and ISO times are ASCII). */
const binary = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const nullsLast = (a: number | null, b: number | null, direction: 1 | -1) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * direction;

/** The list index, once per refresh (derived 'list-index'): about 250 bytes a coffee, 89,000 rows to build for 490 coffees. */
export function listIndex(db: CatalogDatabase): Promise<ListIndex> {
  return derived(db, 'list-index', async () => {
    const rows = (
      await db
        .prepare(
          `SELECT c.id,r.slug AS roaster,c.first_seen_at,a.arrived_at,${PREFERRED_PRICE} AS price,${UNIT_PRICE} AS unit,${INDEXED_FACETS.map(([, field]) => `${facetValuesSql(field)} AS f_${field}`).join(',')}
      FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id ${ARRIVALS_JOIN} WHERE ${coffeeOnlySql()}`,
        )
        .all<
          {
            id: string;
            roaster: string;
            first_seen_at: string;
            arrived_at: string | null;
            price: number | null;
            unit: number | null;
          } & Record<string, string>
        >()
    ).results;
    const values: string[] = [],
      positions = new Map<string, number>();
    const position = (value: string) => {
      let at = positions.get(value);
      if (at === undefined) {
        at = values.length;
        values.push(value);
        positions.set(value, at);
      }
      return at;
    };
    const coffees = rows.map((row): ListIndexCoffee => [
      row.id,
      row.roaster,
      row.price,
      ...INDEXED_FACETS.map(([, field]) => parseJson<string[]>(row[`f_${field}`], []).map(position)),
    ]);
    const ordered = (compare: (a: (typeof rows)[number], b: (typeof rows)[number]) => number) =>
      rows.map((_, index) => index).sort((a, b) => compare(rows[a], rows[b]) || binary(rows[a].id, rows[b].id));
    // A feed lists the coffees with a valid event of its type since its start: the newest such event per coffee decides.
    const positionOf = new Map(rows.map((row, at) => [row.id, at]));
    const events: ListIndex['events'] = {};
    for (const type of EVENT_TYPES) {
      const valid = (
        await db
          .prepare(
            `SELECT g.group_id,max(e.created_at) AS created_at FROM coffee_events e JOIN coffee_group_members g ON g.coffee_id=e.coffee_id WHERE e.type=?${eventValidity(type)} GROUP BY g.group_id`,
          )
          .bind(type)
          .all<{ group_id: string; created_at: string }>()
      ).results;
      events[type] = valid.flatMap((row) =>
        positionOf.has(row.group_id) ? [[positionOf.get(row.group_id)!, row.created_at] as [number, string]] : [],
      );
    }
    return {
      values,
      coffees,
      events,
      order: {
        // listCatalog's ORDER BY: arrival DESC NULLS LAST, first seen DESC, id; price ASC or DESC NULLS LAST, id; unit price ASC NULLS LAST, id.
        newest: ordered(
          (a, b) =>
            (a.arrived_at === null
              ? b.arrived_at === null
                ? 0
                : 1
              : b.arrived_at === null
                ? -1
                : binary(b.arrived_at, a.arrived_at)) || binary(b.first_seen_at, a.first_seen_at),
        ),
        price_asc: ordered((a, b) => nullsLast(a.price, b.price, 1)),
        price_desc: ordered((a, b) => nullsLast(a.price, b.price, -1)),
        unit_price_asc: ordered((a, b) => nullsLast(a.unit, b.unit, 1)),
      },
    };
  });
}

/** The index's answer to buildFilters' WHERE and listCatalog's ORDER BY: the matching coffees in order. */
export function indexMatches(index: ListIndex, filters: CatalogFilters): ListIndexCoffee[] {
  const tests: Array<(coffee: ListIndexCoffee) => boolean> = [];
  INDEXED_FACETS.forEach(([key], facet) => {
    const selected = (filters[key] as string[] | undefined)
      ?.map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!selected?.length) return;
    const wanted = new Set(
      (key === 'origin' ? countryFilterAliases(selected) : selected).flatMap((value) => {
        const at = index.values.indexOf(value);
        return at < 0 ? [] : [at];
      }),
    );
    tests.push((coffee) => (coffee[3 + facet] as number[]).some((at) => wanted.has(at)));
  });
  if (filters.roaster?.length) {
    const wanted = new Set(filters.roaster.slice(0, 20));
    tests.push((coffee) => wanted.has(coffee[1]));
  }
  if (Number.isFinite(filters.priceMin)) {
    const min = Math.round(Math.max(0, filters.priceMin!) * 100);
    tests.push((coffee) => coffee[2] !== null && coffee[2] >= min);
  }
  if (Number.isFinite(filters.priceMax)) {
    const max = Math.round(Math.max(0, filters.priceMax!) * 100);
    tests.push((coffee) => coffee[2] !== null && coffee[2] <= max);
  }
  if (filters.event && EVENT_TYPES.has(filters.event)) {
    // buildFilters: an event of this type, valid, created at or after `since` when it is a date.
    const since =
      filters.since && Number.isFinite(Date.parse(filters.since)) ? new Date(filters.since).toISOString() : null;
    const newest = new Map(
      (index.events[filters.event] ?? []).map(([at, createdAt]) => [index.coffees[at][0], createdAt]),
    );
    tests.push((coffee) => {
      const createdAt = newest.get(coffee[0]);
      return createdAt !== undefined && (since === null || binary(createdAt, since) >= 0);
    });
  }
  const sort: ListSort = (LIST_SORTS as readonly string[]).includes(filters.sort ?? 'newest')
    ? ((filters.sort ?? 'newest') as ListSort)
    : 'newest';
  return index.order[sort].map((at) => index.coffees[at]).filter((coffee) => tests.every((test) => test(coffee)));
}
