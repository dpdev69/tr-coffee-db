import type { CatalogDatabase, Statement } from './database';

/** The part of a Workers KV namespace the last-good copies use (the LAST_GOOD binding). */
export interface LastGoodStore {
  get(key: string): Promise<string | null>;
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<unknown>;
}
/** Bump when a stored shape changes, so an outage never hands new code a value written by older code. */
export const LAST_GOOD_SCHEMA = 1;
/** A copy younger than this is not rewritten. With about two dozen keys this stays far under KV's 1,000 free writes a day. */
export const LAST_GOOD_REFRESH_MS = 12 * 3600_000;
/** KV refuses keys over 512 bytes; longer names (a landing-facts filter list) are stored under their SHA-256. */
const MAX_PLAIN_KEY = 400;
/** Keys this isolate has already checked recently, so a busy page does not read KV on every render. */
const checked = new Map<string, number>();

export interface LastGood {
  store?: LastGoodStore;
  /** Runs the copy-refresh after the response (ctx.waitUntil); without it the refresh is awaited. */
  background?: (work: Promise<unknown>) => void;
  /** Called when a value came from a stored copy instead of the database. */
  onFallback?: (writtenAt: string | null) => void;
}

export async function lastGoodKey(name: string): Promise<string> {
  const plain = `v${LAST_GOOD_SCHEMA}:${name}`;
  if (new TextEncoder().encode(plain).byteLength <= MAX_PLAIN_KEY) return plain;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)));
  return `v${LAST_GOOD_SCHEMA}:sha256:${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Keeps the last value `compute` produced in KV, and answers with it when `compute` fails (the daily D1 allowance is spent,
 * or the database does not answer in time). A failure with no stored copy is rethrown unchanged. KV has its own free
 * allowance (100,000 reads a day), so a D1 outage does not take the copies with it. Writing the copy never fails a request. */
export async function withLastGood<T>(lastGood: LastGood | undefined, name: string, compute: () => Promise<T>): Promise<T> {
  const store = lastGood?.store;
  if (!store) return compute();
  let value: T;
  try {
    value = await compute();
  } catch (error) {
    const stored = await store.getWithMetadata<{ at?: string }>(await lastGoodKey(name)).catch(() => null);
    if (stored?.value == null) throw error;
    lastGood.onFallback?.(stored.metadata?.at ?? null);
    return JSON.parse(stored.value) as T;
  }
  const refresh = remember(store, name, value);
  if (lastGood.background) lastGood.background(refresh); else await refresh;
  return value;
}

async function remember(store: LastGoodStore, name: string, value: unknown, now = Date.now()): Promise<void> {
  try {
    const key = await lastGoodKey(name);
    if (now - (checked.get(key) ?? 0) < LAST_GOOD_REFRESH_MS / 12) return;
    checked.set(key, now);
    const { metadata } = await store.getWithMetadata<{ at?: string }>(key);
    if (metadata?.at && now - Date.parse(metadata.at) < LAST_GOOD_REFRESH_MS) return;
    await store.put(key, JSON.stringify(value), { metadata: { at: new Date(now).toISOString() } });
  } catch (error) {
    console.error(`Last-good copy not stored: ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/** For tests: forget which keys this isolate has checked. */
export function forgetLastGoodChecks(): void { checked.clear(); }

/** D1 errors that mean the database will not answer for a while: the daily allowance is spent, or it timed out.
 * A plain SQL error is a bug in one query and does not stop the others. */
const OUTAGE = /\b(?:7500|limit|exceeded|timed? ?out|timeout|overloaded|unavailable)\b/i;
export class DatabaseDeadlineError extends Error {
  constructor(ms: number) { super(`D1 did not answer within ${ms} ms (timeout)`); this.name = 'DatabaseDeadlineError'; }
}

/** Each statement gets `ms` to answer. After the first outage-like failure in this request the remaining statements fail
 * at once, so a page whose database is out of reads renders its fallback in seconds instead of hanging until the
 * platform gives up. The wrapper is per request (getCatalogDatabase builds one for each), so one bad request does not
 * stop the next. */
export function withDeadline(db: CatalogDatabase, ms: number): CatalogDatabase {
  let outage: Error | null = null;
  const guard = <T>(run: () => Promise<T>): Promise<T> => {
    if (outage) return Promise.reject(outage);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DatabaseDeadlineError(ms)), ms); });
    return Promise.race([run(), deadline]).catch((error: unknown) => {
      if (error instanceof DatabaseDeadlineError || OUTAGE.test(error instanceof Error ? error.message : String(error))) outage ??= error instanceof Error ? error : new Error(String(error));
      throw error;
    }).finally(() => clearTimeout(timer));
  };
  const raw = new WeakMap<Statement, Statement>();
  const wrap = (statement: Statement): Statement => {
    const wrapped: Statement = {
      bind: (...values) => wrap(statement.bind(...values)),
      first: <T>() => guard(() => statement.first<T>()),
      all: <T>() => guard(() => statement.all<T>()),
    };
    raw.set(wrapped, statement);
    return wrapped;
  };
  return {
    prepare: sql => wrap(db.prepare(sql)),
    batch: statements => guard(() => db.batch(statements.map(statement => raw.get(statement) ?? statement))),
  };
}
