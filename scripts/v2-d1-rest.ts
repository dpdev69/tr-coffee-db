import type { CatalogDatabase, SqlValue, Statement } from '../shared/v2/database';
import { safeDiagnostic } from '../shared/v2/ingestion';

type Query = { sql: string; params: SqlValue[] };
type Result = { results: Record<string, unknown>[]; success: boolean; meta?: { rows_read?: number; rows_written?: number } };
/** Runs the same atomic ingestion batches outside the constrained Workers Free runtime. */
export class D1RestDatabase implements CatalogDatabase {
  rowsRead = 0;
  rowsWritten = 0;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private accountId: string, private databaseId: string, private token: string, private request: typeof fetch = fetch) {
    if (!/^[a-f0-9]{32}$/.test(accountId) || !/^[a-f0-9-]{36}$/.test(databaseId) || !token) throw new Error('D1 credentials are missing or invalid.');
  }
  prepare(sql: string) { return new RestStatement(this, sql); }
  async batch(statements: Statement[]) {
    return this.query(statements.map(statement => {
      if (!(statement instanceof RestStatement) || statement.owner !== this) throw new Error('Foreign D1 statement.');
      return { sql: statement.sql, params: statement.values };
    }));
  }
  query(batch: Query[]): Promise<Result[]> {
    // ponytail: one D1 request at a time for quota accounting; reserve budgets if DB latency dominates.
    const result = this.pending.then(() => this.send(batch));
    this.pending = result.catch(() => {});
    return result;
  }
  private async send(batch: Query[]): Promise<Result[]> {
    // Leave room for public reads and health writes within the free daily quota.
    if (this.rowsWritten >= 65_000 || this.rowsRead >= 3_000_000) throw new Error('Refresh database budget reached; remaining sources deferred.');
    const response = await this.request(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }), signal: AbortSignal.timeout(60_000),
    });
    const payload = await response.json() as { success: boolean; result?: Result[]; errors?: {message:string}[] };
    if (!response.ok || !payload.success || !Array.isArray(payload.result) || payload.result.length !== batch.length || payload.result.some(r => !r.success)) {
      throw new Error(`D1 request failed (${response.status}): ${safeDiagnostic(payload.errors?.map(e => e.message).join('; ') || 'Invalid database response')}`);
    }
    for (const result of payload.result) { this.rowsRead += result.meta?.rows_read ?? 0; this.rowsWritten += result.meta?.rows_written ?? 0; }
    return payload.result;
  }
}
class RestStatement implements Statement {
  values: SqlValue[] = [];
  constructor(readonly owner: D1RestDatabase, readonly sql: string) {}
  bind(...values: SqlValue[]) { this.values = values; return this; }
  async all<T>() { const [result] = await this.owner.query([{sql:this.sql, params:this.values}]); return {results:result.results as T[], success:true}; }
  async first<T>() { return (await this.all<T>()).results[0] ?? null; }
}
