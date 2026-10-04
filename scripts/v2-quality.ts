import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG_NAME_EXCLUSION_PATTERNS } from '../src/lib/catalog-rules';
import { readSourceSnapshot, type SourceRow, type SourceSnapshot } from './v2-export';

function present(value: unknown) { return typeof value === 'string' ? value.trim().length > 0 && value !== 'unknown' : value != null; }
function positive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function group(rows: SourceRow[], key: (row: SourceRow) => string) {
  const groups = new Map<string, SourceRow[]>();
  for (const row of rows) { const value = key(row); groups.set(value, [...(groups.get(value) ?? []), row]); }
  return groups;
}
function canonical(value: unknown) {
  try {
    const url = new URL(String(value));
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, '');
  } catch { return String(value ?? ''); }
}
function percentage(a: number, b: number) { return b ? `${(a / b * 100).toFixed(1)}%` : 'N/A (no observed runs)'; }
function isCatalog(row: SourceRow, cutoff: string) {
  return row.is_public === true && row.specialty_status === 'specialty' && row.is_available === true
    && typeof row.last_seen_at === 'string' && row.last_seen_at >= cutoff
    && !CATALOG_NAME_EXCLUSION_PATTERNS.some((pattern) => String(row.name).toLocaleLowerCase('tr-TR').includes(pattern.slice(1, -1).toLocaleLowerCase('tr-TR')));
}

export function analyzeSource(snapshot: SourceSnapshot) {
  const coffees = snapshot.tables.coffees;
  const roasters = snapshot.tables.roasters;
  const logs = snapshot.tables.scrape_logs;
  const cutoff = new Date(Date.parse(snapshot.completedAt) - 3 * 86400000).toISOString();
  const active = coffees.filter((row) => isCatalog(row, cutoff));
  const stale = coffees.filter((row) => typeof row.last_seen_at !== 'string' || row.last_seen_at < cutoff);
  const duplicateExternalIds = [...group(coffees, (row) => `${row.roaster_id}:${row.external_id}`).values()].filter((rows) => rows.length > 1);
  const duplicateUrls = [...group(coffees, (row) => `${row.roaster_id}:${canonical(row.product_url)}`).values()].filter((rows) => rows.length > 1);
  const duplicateSlugs = [...group(coffees, (row) => String(row.slug)).values()].filter((rows) => rows.length > 1);
  const missing = (rows: SourceRow[]) => ({
    origin: rows.filter((row) => !present(row.origin_country)).length,
    process: rows.filter((row) => !present(row.process)).length,
    weight: rows.filter((row) => !positive(row.weight_grams)).length,
    price: rows.filter((row) => !positive(row.price_amount)).length,
  });
  const invalidNormalizedPrice = coffees.filter((row) => {
    if (row.price_per_100g == null) return false;
    if (!positive(row.price_amount) || !positive(row.weight_grams) || row.price_currency !== 'TRY' || !positive(row.price_per_100g)) return true;
    return Math.abs(row.price_per_100g - row.price_amount / row.weight_grams * 100) > 0.011;
  });
  const byRoaster = roasters.map((roaster) => {
    const runs = logs.filter((log) => log.roaster_id === roaster.id).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    const success = runs.filter((log) => log.status === 'success');
    return { roaster, runs, success, lastAttempt: runs[0]?.started_at ?? null, lastSuccess: success[0]?.completed_at ?? success[0]?.started_at ?? null };
  });
  return { coffees, roasters, logs, cutoff, active, stale, duplicateExternalIds, duplicateUrls, duplicateSlugs, invalidNormalizedPrice,
    missingAll: missing(coffees), missingActive: missing(active), byRoaster,
    staleRoasters: byRoaster.filter((row) => row.roaster.is_active === true && (!row.lastSuccess || String(row.lastSuccess) < cutoff)) };
}

export function qualityReport(snapshot: SourceSnapshot) {
  const data = analyzeSource(snapshot);
  const metric = (label: string, all: number | string, active: number | string = '—') => `| ${label} | ${all} | ${active} |`;
  return `# Source data quality\n\nMeasured from the read-only legacy Supabase export completed **${snapshot.completedAt}**. Project: coffeedb. Reproduce with \`npx tsx scripts/v2-export.ts --output .local/v2/source-NEW.json\` then \`npx tsx scripts/v2-quality.ts --source .local/v2/source-NEW.json --write-reports\`.\n\n## Scope and counts\n\n“Current public catalog” reproduces the existing 3-day freshness, specialty/public, availability and name-exclusion rules; cutoff **${data.cutoff}**. “All source” includes hidden and stale rows so migration reconciliation does not discard data. A stale record is not proof of stock absence.\n\n| Metric | All source | Current public catalog |\n| --- | ---: | ---: |\n${[
    metric('Roasters', data.roasters.length, new Set(data.active.map((row) => row.roaster_id)).size),
    metric('Roasters marked active', data.roasters.filter((row) => row.is_active === true).length),
    metric('Coffee records', data.coffees.length, data.active.length),
    metric('Coffee records marked available (before freshness/visibility filters)', data.coffees.filter((row) => row.is_available === true).length),
    metric('Canonical SKU offers', 'Not modeled in legacy source', 'Not measurable'),
    metric('Missing origin', data.missingAll.origin, data.missingActive.origin),
    metric('Missing/unknown process', data.missingAll.process, data.missingActive.process),
    metric('Missing/invalid weight', data.missingAll.weight, data.missingActive.weight),
    metric('Missing/invalid price', data.missingAll.price, data.missingActive.price),
    metric('Stale or never-seen coffee records', data.stale.length),
    metric('Stale active roasters (last successful log >3 days or none)', data.staleRoasters.length),
    metric('Duplicate (roaster, external_id) groups', data.duplicateExternalIds.length),
    metric('Duplicate canonical URL groups within a roaster', data.duplicateUrls.length),
    metric('Duplicate legacy slug groups', data.duplicateSlugs.length),
    metric('Stored unit price inconsistent with positive TRY price/known weight', data.invalidNormalizedPrice.length),
  ].join('\n')}\n\n## Trust limitations and migration implications\n\n- Legacy coffees contain one flattened package/price, not all offers. An active-offer count cannot honestly be reconstructed by renaming coffee count. The importer may create one explicitly uncertain legacy offer per row, but that is a migration artifact, not verified complete SKU coverage.\n- **Historical prices: unrecoverable from this source.** There is no legacy price-observation/history table in the repository schema. Only the current snapshot price and observation timestamp can be preserved once; do not generate historical price drops, deals, restocks or NEW events from the import. Trace listed events are mutable current evidence, not a price time series.\n- **Compare-at pricing: not measured.** Legacy source has no separate compare-at column; questionable compare-at pricing counts are N/A, not zero.\n- **Suspicious identity changes: not provable from one snapshot.** Duplicate canonical URL groups (${data.duplicateUrls.length}) are review candidates, not confirmed identity churn. Distinct source IDs must not be merged automatically.\n- Existing normalized process, roast, brew and taste fields have mixed declared/inferred origins. Preserve them as legacy feature provenance with unknown confidence; do not promote them into verified raw source truth.\n- Counts and table hashes were checked during ordered, paginated export. The export is not a transactionally consistent cross-table database backup; a write freeze and final export/reconciliation remain required at cutover.\n- Correction reports, emails, redirect interaction data, and non-public traceability records are excluded. ${snapshot.redactedValues} exported rows had credential/email-like values redacted. Public producer/assessor names in catalog provenance are retained as catalog data.\n\n## Preserved source table counts\n\n| Table | Rows |\n| --- | ---: |\n${Object.entries(snapshot.tableCounts).map(([table, count]) => `| ${table} | ${count} |`).join('\n')}\n\n## Duplicate URL candidates\n\n${data.duplicateUrls.length ? data.duplicateUrls.slice(0, 30).map((rows) => `- Coffee IDs: ${rows.map((row) => String(row.id)).join(', ')}. External IDs: ${rows.map((row) => String(row.external_id)).join(', ')}.`).join('\n') : 'No duplicate canonical URL groups found in this snapshot.'}\n\n## Crawler evidence\n\nSee [crawler-health.md](crawler-health.md) for windowed success rates, adapter error rates, last attempts and last successes. No new crawl or remote mutation was run to generate this source audit.\n`;
}

export function crawlerReport(snapshot: SourceSnapshot) {
  const data = analyzeSource(snapshot);
  const windowRows = [7, 30].map((days) => {
    const cutoff = new Date(Date.parse(snapshot.completedAt) - days * 86400000).toISOString();
    const logs = data.logs.filter((log) => typeof log.started_at === 'string' && log.started_at >= cutoff);
    const success = logs.filter((log) => log.status === 'success').length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    return `| Last ${days} days | ${logs.length} | ${success} | ${failed} | ${percentage(success, logs.length)} |`;
  });
  const adapters = [...new Set(data.roasters.map((row) => String(row.platform)))].sort().map((adapter) => {
    const ids = new Set(data.roasters.filter((row) => row.platform === adapter).map((row) => row.id));
    const logs = data.logs.filter((row) => ids.has(row.roaster_id));
    const failed = logs.filter((row) => row.status === 'failed').length;
    return `| ${adapter} | ${ids.size} | ${logs.length} | ${failed} | ${percentage(failed, logs.length)} |`;
  });
  const successful = data.logs.filter((log) => log.status === 'success').length;
  const failed = data.logs.filter((log) => log.status === 'failed').length;
  return `# Legacy crawler health\n\nSource export completed **${snapshot.completedAt}**. This report summarizes persisted Supabase scrape logs; it does not claim a fresh probe of every storefront. Reproduce using \`npx tsx scripts/v2-quality.ts --source .local/v2/source.json --write-reports\`.\n\n## Observed execution rates\n\n| Window | Logged runs | Success | Failed | Success rate |\n| --- | ---: | ---: | ---: | --- |\n${windowRows.join('\n')}\n| All exported logs | ${data.logs.length} | ${successful} | ${failed} | ${percentage(successful, data.logs.length)} |\n\nSuccess rate uses all logged attempts as denominator, including any nonterminal statuses; absent logs are not counted as failures or successes. A stale schedule can have perfect historical success while providing no current data.\n\n## Adapter errors (all exported history)\n\n| Legacy platform | Roasters | Logged attempts | Failed | Error percentage |\n| --- | ---: | ---: | ---: | --- |\n${adapters.join('\n')}\n\n“Platform” is the stored legacy roaster category, not necessarily the exact current adapter implementation or parser version. Error means logged status \`failed\`; no parser version or stage-specific error table existed.\n\n## Last source activity by roaster\n\n| Roaster | Active | Platform | Last attempt | Last successful completion | Last status |\n| --- | --- | --- | --- | --- | --- |\n${data.byRoaster.sort((a, b) => String(a.roaster.slug).localeCompare(String(b.roaster.slug))).map((row) => `| ${row.roaster.slug} | ${row.roaster.is_active === true ? 'Yes' : 'No'} | ${row.roaster.platform} | ${row.lastAttempt ?? 'No log'} | ${row.lastSuccess ?? 'No success log'} | ${row.runs[0]?.status ?? 'Unknown'} |`).join('\n')}\n\n## Next gate\n\n- ${data.staleRoasters.length} active roasters have no successful recorded crawl inside the current 3-day freshness window. Investigate scheduler execution separately from parser failures.\n- V2 must distinguish attempted, failed, successful, absent-on-success and explicitly unavailable states. Failed or missing log evidence must never synthesize out-of-stock transitions.\n- Run new adapters in staging and compare per-roaster identities, offers, prices, stock and source freshness before disabling the old scheduler. No overlap sample comparison has yet been performed in this report.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--source');
  const snapshot = readSourceSnapshot(resolve(index === -1 ? '.local/v2/source.json' : args[index + 1]));
  if (args.includes('--write-reports')) {
    writeFileSync(resolve('docs/data-quality.md'), qualityReport(snapshot));
    writeFileSync(resolve('docs/crawler-health.md'), crawlerReport(snapshot));
    console.log('Wrote docs/data-quality.md and docs/crawler-health.md from verified source snapshot');
  } else {
    const data = analyzeSource(snapshot);
    console.log(JSON.stringify({ capturedAt: snapshot.completedAt, counts: snapshot.tableCounts,
      currentPublicCoffees: data.active.length, staleCoffees: data.stale.length, missing: data.missingAll }, null, 2));
  }
}
