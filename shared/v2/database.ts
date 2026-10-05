/** Minimal structural D1 contract, also implemented by the real SQLite integration test. */
export type SqlValue = string | number | null;
export interface Statement {
  bind(...values: SqlValue[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
}
export interface CatalogDatabase {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
  /** Optional shared cache for results that are the same for every visitor until the next refresh (read-cache.ts). */
  derive?<T>(name: string, compute: () => Promise<T>): Promise<T>;
}
