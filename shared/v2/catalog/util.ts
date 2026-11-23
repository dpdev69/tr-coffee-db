import type { CatalogDatabase } from '../database';

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** A result that is the same for every visitor until the next refresh goes through the database's derived cache when it has one
 * (shared/v2/read-cache.ts); tests and scripts read live. Only for results that do not depend on the clock or the visitor. */
export function derived<T>(db: CatalogDatabase, name: string, compute: () => Promise<T>): Promise<T> {
  return db.derive ? db.derive(name, compute) : compute();
}
