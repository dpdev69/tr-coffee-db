import { coffeeOnlySql } from '../coffee-eligibility';
import type { CatalogDatabase, SqlValue } from '../database';
import type { CoffeeEvent } from '../types';
import { eventFromRow } from './mappers';
import { EVENT_TYPES, eventValidity, GENUINE_NEW } from './sql';
import type { EventRow } from './types';

export const CHANGE_EVENTS = ['NEW', 'PRICE_DROP', 'RESTOCKED'] as const;
export type ChangeDay = { day: string } & Record<(typeof CHANGE_EVENTS)[number], number>;
const ISTANBUL_MS = 3 * 3600000;

/** Same for every visitor: per Istanbul calendar day (oldest first, 30 days ending today), the listed coffees whose latest NEW, PRICE_DROP or RESTOCKED event fell on that day.
 * A coffee counts once per type, in the bucket of its latest event, so summing the days since a date equals the old "has an event since" count. */
export async function catalogChangesByDay(db: CatalogDatabase, now = Date.now()): Promise<ChangeDay[]> {
  const days = Array.from({ length: 30 }, (_, i) => ({
    day: new Date(now + ISTANBUL_MS - (29 - i) * 86400000).toISOString().slice(0, 10),
    NEW: 0,
    PRICE_DROP: 0,
    RESTOCKED: 0,
  }));
  const from = new Date(Date.parse(`${days[0].day}T00:00:00Z`) - ISTANBUL_MS).toISOString();
  const perType = CHANGE_EVENTS.map((type) => `(e.type='${type}'${eventValidity(type)})`).join(' OR ');
  // Valid events first (a few per day), then the groups they belong to: pairing every listed coffee with every valid event read 148,000 rows.
  const rows = await db
    .prepare(
      `WITH valid AS MATERIALIZED (SELECT e.coffee_id,e.type,e.created_at FROM coffee_events e WHERE e.created_at>=? AND (${perType}))
    SELECT day,type,count(*) AS count FROM (SELECT date(max(e.created_at),'+3 hours') AS day,e.type AS type FROM valid e CROSS JOIN coffee_group_members g ON g.coffee_id=e.coffee_id JOIN public_catalog_coffees c ON c.id=g.group_id JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} GROUP BY c.id,e.type) GROUP BY day,type`,
    )
    .bind(from)
    .all<{ day: string; type: (typeof CHANGE_EVENTS)[number]; count: number }>();
  for (const row of rows.results) days.find((d) => d.day === row.day)![row.type] = row.count;
  return days;
}

export async function listEvents(db: CatalogDatabase, type?: CoffeeEvent['type'], limit = 30): Promise<CoffeeEvent[]> {
  const accepted = type && EVENT_TYPES.has(type) ? type : null;
  const values: SqlValue[] = accepted ? [accepted] : [];
  values.push(Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 30)));
  const rows = await db
    .prepare(
      `SELECT e.* FROM coffee_events e JOIN coffees c ON c.id=e.coffee_id WHERE c.visibility='public' AND ${coffeeOnlySql()} AND (e.type<>'NEW' OR ${GENUINE_NEW}) ${accepted ? 'AND e.type=?' : ''} ORDER BY e.created_at DESC,e.id DESC LIMIT ?`,
    )
    .bind(...values)
    .all<EventRow>();
  return rows.results.map(eventFromRow);
}
