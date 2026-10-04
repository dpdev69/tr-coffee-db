import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type SourceRow = Record<string, unknown>;
export interface SourceSnapshot {
  format: 'coffeedb-legacy-v1';
  projectRef: string;
  startedAt: string;
  completedAt: string;
  consistency: 'ordered-paginated-count-verified-not-transactional';
  exclusions: string[];
  tableCounts: Record<string, number>;
  tableSha256: Record<string, string>;
  redactedValues: number;
  tables: Record<string, SourceRow[]>;
}

const PROJECT_REF = 'orwpmyuqkqvlqjhtotou';
const PUBLIC_TABLES = new Set(['supply_chain_organizations', 'coffee_lots', 'trace_sources',
  'coffee_claims', 'trace_events', 'coffee_assessments', 'coffee_certifications']);
const EXPORT_TABLES = ['roasters', 'coffees', 'coffee_specialty_overrides', ...PUBLIC_TABLES,
  'lot_organizations', 'scrape_logs'];
const PAGE_SIZE = 500;

export function loadLocalSourceEnvironment(root = process.cwd()) {
  for (const file of ['.env.local', 'scrapers/.env']) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, '');
      process.env[match[1]] ??= value;
    }
  }
}

export function redactSourceValue(value: unknown, secrets: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSourceValue(item, secrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      /^(?:email|reporter_email|password|token|api_key|authorization)$/i.test(key)
        ? '[redacted]' : redactSourceValue(item, secrets)]));
  }
  if (typeof value !== 'string') return value;
  let safe = value;
  for (const secret of secrets.filter((item) => item.length > 10)) safe = safe.split(secret).join('[redacted]');
  return safe
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi, '[email redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|key|secret|signature|password|api_key|apikey)=)[^&\s"']*/gi, '$1[redacted]')
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[credentials redacted]@');
}

export function readSourceSnapshot(path: string): SourceSnapshot {
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as SourceSnapshot;
  if (snapshot.format !== 'coffeedb-legacy-v1' || snapshot.projectRef !== PROJECT_REF) throw new Error('Unexpected source snapshot format or project');
  if (!Number.isFinite(Date.parse(snapshot.completedAt)) || !Number.isFinite(Date.parse(snapshot.startedAt))) throw new Error('Source snapshot timestamps are invalid');
  if (EXPORT_TABLES.some((table) => !Object.hasOwn(snapshot.tables, table)) || Object.keys(snapshot.tables).some((table) => !EXPORT_TABLES.includes(table))) throw new Error('Source snapshot table allowlist mismatch');
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    if (!Array.isArray(rows) || rows.length !== snapshot.tableCounts[table]) throw new Error(`Source row count mismatch: ${table}`);
    const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    if (hash !== snapshot.tableSha256[table]) throw new Error(`Source checksum mismatch: ${table}`);
  }
  return snapshot;
}

export async function exportSource(outputPath = resolve('.local/v2/source.json')) {
  const localRoot = resolve('.local') + '/';
  if (!resolve(outputPath).startsWith(localRoot)) throw new Error('Export must remain inside ignored .local/');
  execFileSync('git', ['check-ignore', '--quiet', outputPath]);
  if (existsSync(outputPath)) throw new Error('Snapshot exists; choose a new --output filename to preserve previous evidence');
  loadLocalSourceEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Source URL and server service-role key are required');
  if (new URL(url).hostname !== `${PROJECT_REF}.supabase.co`) throw new Error('Source project does not match authorized coffeedb project');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const snapshot: SourceSnapshot = {
    format: 'coffeedb-legacy-v1', projectRef: PROJECT_REF, startedAt: new Date().toISOString(), completedAt: '',
    consistency: 'ordered-paginated-count-verified-not-transactional',
    exclusions: ['auth.*', 'correction_reports', 'redirect_events', 'non-public traceability rows', 'emails and credential-like strings'],
    tableCounts: {}, tableSha256: {}, redactedValues: 0, tables: {},
  };
  for (const table of EXPORT_TABLES) {
    let before = client.from(table).select('*', { count: 'exact', head: true });
    if (PUBLIC_TABLES.has(table)) before = before.eq('is_public', true);
    const countBefore = await before;
    if (countBefore.error) throw new Error(`Source count failed for ${table} (${countBefore.error.code})`);
    const rows: SourceRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = client.from(table).select('*');
      if (PUBLIC_TABLES.has(table)) query = query.eq('is_public', true);
      if (table === 'lot_organizations') query = query.order('lot_id').order('organization_id').order('role');
      else query = query.order('id');
      const result = await query.range(offset, offset + PAGE_SIZE - 1);
      if (result.error) throw new Error(`Source page failed for ${table} (${result.error.code})`);
      rows.push(...(result.data as SourceRow[]));
      if (result.data.length < PAGE_SIZE) break;
    }
    let after = client.from(table).select('*', { count: 'exact', head: true });
    if (PUBLIC_TABLES.has(table)) after = after.eq('is_public', true);
    const countAfter = await after;
    if (countAfter.error || rows.length !== countBefore.count || rows.length !== countAfter.count) throw new Error(`Source changed during export or pagination truncated: ${table}`);
    const keys = rows.map((row) => table === 'lot_organizations' ? `${row.lot_id}:${row.organization_id}:${row.role}` : String(row.id));
    if (new Set(keys).size !== keys.length) throw new Error(`Duplicate source pagination key: ${table}`);
    const visibleRows = table === 'lot_organizations' ? rows.filter((row) =>
      snapshot.tables.coffee_lots.some((lot) => lot.id === row.lot_id) &&
      snapshot.tables.supply_chain_organizations.some((organization) => organization.id === row.organization_id)) : rows;
    const safeRows = visibleRows.map((row) => {
      const safe = redactSourceValue(row, [key]) as SourceRow;
      if (JSON.stringify(row) !== JSON.stringify(safe)) snapshot.redactedValues += 1;
      return safe;
    });
    snapshot.tables[table] = safeRows;
    snapshot.tableCounts[table] = safeRows.length;
    snapshot.tableSha256[table] = createHash('sha256').update(JSON.stringify(safeRows)).digest('hex');
    console.log(`${table}: ${safeRows.length} rows exported`);
  }
  snapshot.completedAt = new Date().toISOString();
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  readSourceSnapshot(outputPath);
  console.log(`Verified local snapshot: ${outputPath}`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  exportSource(outputIndex === -1 ? undefined : resolve(args[outputIndex + 1])).catch((error: Error) => {
    console.error(`Export failed: ${error.message}`);
    process.exitCode = 1;
  });
}
