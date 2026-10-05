import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { CatalogDatabase, SqlValue, Statement } from '../../shared/v2/database';

/** Applies every D1 migration in ledger order, as `wrangler d1 migrations apply` does. */
export function applyMigrations(sqlite: DatabaseSync) {
  const directory = new URL('../../migrations/d1/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
}
export class TestCatalogDatabase implements CatalogDatabase {
  readonly sqlite = new DatabaseSync(':memory:');
  // D1's own limits, so a query D1 refuses fails here too: GLOB/LIKE patterns over 50 bytes, expressions deeper than 100.
  constructor() { this.sqlite.limits.likePatternLength = 50; this.sqlite.limits.exprDepth = 100; applyMigrations(this.sqlite); }
  prepare(sql: string): Statement { return new TestStatement(this, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const result = statements.map(item => { const statement = item as TestStatement; return this.sqlite.prepare(statement.sql).run(...statement.values); });
      this.sqlite.exec('COMMIT'); return result;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
class TestStatement implements Statement {
  values: SqlValue[] = [];
  constructor(readonly db: TestCatalogDatabase, readonly sql: string) {}
  bind(...values: SqlValue[]) { this.values = values; return this; }
  async first<T>() { return (this.db.sqlite.prepare(this.sql).get(...this.values) || null) as T | null; }
  async all<T>() { return { results: this.db.sqlite.prepare(this.sql).all(...this.values) as T[], success: true }; }
}
