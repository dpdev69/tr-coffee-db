import type { CatalogDatabase, Statement } from './database';

/** The catalog changes once a night, so a page or JSON response is the same for every visitor until the next refresh.
 * Workers Cache (tiered, shared by every location) keeps it for 6 hours and the nightly job purges it once corrections
 * are applied (src/app/api/cache/route.ts); 6 hours bounds the lag if a purge is missed. A render that could not read
 * the catalog is never stored (keepOutOfEdgeCache), so the edge keeps serving the last good copy for a day.
 * Browsers always revalidate with the edge. docs/read-budget.md has the arithmetic. */
export const EDGE_CACHE_CONTROL = 'public, max-age=21600, stale-while-revalidate=86400, stale-if-error=86400';
/** Route handlers set both headers: the edge reads CDN-Cache-Control, browsers Cache-Control. */
export const EDGE_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=0, must-revalidate', 'CDN-Cache-Control': EDGE_CACHE_CONTROL };
/** For redirects that count a click: the edge stores each one but never answers from it while the Worker can (max-age=0, so
 * every click still runs and is counted); only when the Worker fails, for instance with the daily database allowance
 * spent, does the edge send the visitor on with the last redirect it saw for that address, for up to a day. */
export const OUTAGE_ONLY_HEADERS = { 'Cache-Control': 'max-age=0, must-revalidate', 'CDN-Cache-Control': 'public, max-age=0, stale-if-error=86400' };
type Purge = { purge(options: { purgeEverything: true }): unknown };
/** Purges Workers Cache with the first handle that has purge() (the request's ctx.cache, then cloudflare:workers).
 * A missing, throwing or unsuccessful purge is false, never an exception, so the caller answers 503 rather than 500. */
export async function purgeEverything(...handles: unknown[]): Promise<boolean> {
  const cache = handles.find((handle): handle is Purge => typeof (handle as Partial<Purge> | null | undefined)?.purge === 'function');
  try { return ((await cache?.purge({ purgeEverything: true })) as { success?: boolean } | undefined)?.success === true; } catch { return false; }
}
/** Per-click and campaign tags change nothing on a page; an address carrying one is redirected without it so it cannot split the edge cache. */
export const TRACKING_PARAM = /^(?:utm_.+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|yclid|igshid|ttclid|twclid|li_fat_id|mc_cid|mc_eid|_ga|_gl|srsltid)$/i;

const INVALIDATED = 'invalidated';
/** Same statement as migrations/d1/0008_derived_cache.sql, so the nightly writers also work before that migration is applied. */
export const DERIVED_CACHE_TABLE = 'CREATE TABLE IF NOT EXISTS derived_cache (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;';
/** Results that are the same for every visitor until the next refresh (counts, roaster and origin lists, landing facts,
 * similarity and quiz candidates) are kept in D1 itself, so one computation serves every isolate and location; the
 * Cache API used before is local to one data center and inert on workers.dev.
 * A row is used while it is younger than ttlSeconds and was written after the last invalidation. Its time is the
 * database clock read before computing, so a computation that overlaps an invalidation is never trusted.
 * Any failure (including a database without migration 0008) falls through to the live query. */
export function withDerivedCache(db:CatalogDatabase,namespace:string,ttlSeconds=86400):CatalogDatabase {
  return {prepare:sql=>db.prepare(sql),batch:statements=>db.batch(statements),async derive<T>(name:string,compute:()=>Promise<T>):Promise<T>{
    const key=`${namespace}:${name}`;
    let now:string|null=null;
    try{
      const row=await db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS now,d.value_json,d.created_at,(SELECT created_at FROM derived_cache WHERE key='${INVALIDATED}') AS invalidated_at
        FROM (SELECT 1) LEFT JOIN derived_cache d ON d.key=?`).bind(key).first<{now:string;value_json:string|null;created_at:string|null;invalidated_at:string|null}>();
      now=row?.now??null;
      if(row?.value_json&&row.created_at&&(!row.invalidated_at||row.created_at>row.invalidated_at)&&Date.parse(row.now)-Date.parse(row.created_at)<ttlSeconds*1000)return JSON.parse(row.value_json) as T;
    }catch{/* No cache table or no database: compute below, and let the live query report a real outage. */}
    const value=await compute();
    if(now)try{await db.batch([db.prepare('INSERT INTO derived_cache(key,value_json,created_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,created_at=excluded.created_at').bind(key,JSON.stringify(value),now)]);}
    catch{/* A full or read-only database still serves the computed value. */}
    return value;
  }};
}
/** After a refresh: every derived row is dropped and anything computed before this moment is ignored. Put it in the writer's own batch. */
export function invalidateDerived(db:CatalogDatabase):Statement[] {
  return [db.prepare(DERIVED_CACHE_TABLE),db.prepare(`DELETE FROM derived_cache WHERE key<>'${INVALIDATED}'`),
    db.prepare(`INSERT INTO derived_cache(key,value_json,created_at) VALUES('${INVALIDATED}','',strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET created_at=excluded.created_at`)];
}
