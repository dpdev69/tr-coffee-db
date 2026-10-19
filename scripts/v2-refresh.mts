import { relayFetch } from '../shared/v2/relay';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beginCrawl, expireCrawls, ingestCrawl, registerRoaster, safeDiagnostic } from '../shared/v2/ingestion';
import { stableId } from '../shared/v2/identity';
import type { CatalogDatabase } from '../shared/v2/database';
import { isQualifiedSource } from '../shared/v2/qualified-sources';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs';
import { crawlRoaster, PARSER_VERSION, type CrawlOptions } from '../scrapers/src/v2/crawl';
import { collectRoasterProductHosts } from '../scrapers/src/url-policy';
import { D1RestDatabase } from './v2-d1-rest';
import { invalidateDerived } from '../shared/v2/read-cache';

/** configs.ts is the single source of truth for roasters; one missing from it is deactivated, never deleted. */
export async function syncRoasters(db: CatalogDatabase, configs = ALL_ROASTER_CONFIGS, now = new Date().toISOString()) {
  for (const config of configs) await registerRoaster(db, { id: config.slug, slug: config.slug, name: config.name, websiteUrl: config.websiteUrl, city: config.city,
    adapter: config.platform, active: config.active !== false, trustedHosts: collectRoasterProductHosts(config) }, now);
  await db.batch([db.prepare('UPDATE roasters SET active=0,revision=revision+1,updated_at=? WHERE active=1 AND slug NOT IN (SELECT value FROM json_each(?))').bind(now, JSON.stringify(configs.map(config => config.slug)))]);
}
/** Red means attention: an active qualified source without a successful crawl for 3 days, or under 80% of this run succeeding. One-night blips stay green. */
export async function attentionNeeded(db: CatalogDatabase, results: Record<string, unknown>[], now: string): Promise<string[]> {
  const cutoff = new Date(Date.parse(now) - 3 * 86_400_000).toISOString();
  const stale = (await db.prepare('SELECT slug FROM roasters WHERE active=1 AND (last_success_at IS NULL OR last_success_at<?) ORDER BY slug').bind(cutoff).all<{ slug: string }>()).results.map(row => row.slug).filter(isQualifiedSource); // An unqualified source is never 'success' by design.
  const succeeded = results.filter(result => result.status === 'success' || result.status === 'already_completed').length;
  return [...(stale.length ? [`No successful crawl for 3 days: ${stale.join(', ')}`] : []), ...(succeeded < results.length * 0.8 ? [`Only ${succeeded}/${results.length} sources succeeded in this run`] : [])];
}
export async function refreshCatalog(db: CatalogDatabase, options: { slugs?: string[]; scheduledAt: string; source?: CrawlOptions; relay?: typeof fetch; now?: () => string; report?: (result: Record<string, unknown>) => Promise<void> }) {
  const now = options.now ?? (() => new Date().toISOString());
  await expireCrawls(db, now());
  const active = (await db.prepare('SELECT id,slug FROM roasters WHERE active=1 ORDER BY slug').all<{id:string;slug:string}>()).results;
  if (options.slugs?.some(slug => !active.some(row => row.slug === slug))) throw new Error('Requested roaster is not active.');
  const results: Record<string, unknown>[] = [];
  const pending = active.filter(r => !options.slugs?.length || options.slugs.includes(r.slug)).values();
  // Each worker crawls a different storefront; per-source pacing remains unchanged.
  const workers = await Promise.allSettled(Array.from({length:3}, async () => {
    for (const roaster of pending) {
      const config = ALL_ROASTER_CONFIGS.find(config => config.slug === roaster.slug);
      if (!config) throw new Error(`Active roaster lacks configuration: ${roaster.slug}`);
      const jobKey = await stableId('job',roaster.id,options.scheduledAt);
      if (await db.prepare("SELECT id FROM crawl_runs WHERE job_key=? AND status='success' LIMIT 1").bind(jobKey).first()) {
        const result={slug:roaster.slug,status:'already_completed'};results.push(result);await options.report?.(result);continue;
      }
      const started = performance.now();
      const startedAt = now();
      const mode = await db.prepare("SELECT id FROM crawl_runs WHERE roaster_id=? AND status='success' AND mode<>'import' LIMIT 1").bind(roaster.id).first() ? 'live' : 'baseline';
      const id = await stableId('run',jobKey,startedAt);
      await beginCrawl(db,{id,jobKey,roasterId:roaster.id,startedAt,mode,parserVersion:PARSER_VERSION});
      let status = 'failed', products = 0, offers = 0, restored = 0, diagnostics: unknown[] = [];
      try {
        // Shops that refuse this network are fetched through our relay Worker when one is configured.
        const crawl = await crawlRoaster(config,config.runsFrom==='relay'&&options.relay?{...options.source,fetch:options.relay}:options.source);
        if (crawl.complete && !isQualifiedSource(roaster.slug)) {
          crawl.complete = false;
          crawl.diagnostics.push({stage:'coverage',code:'source_unqualified',message:'Parser produced a snapshot but source coverage has not passed review.'});
        }
        status = crawl.complete ? 'success' : crawl.products.length ? 'partial' : 'failed';
        diagnostics = crawl.diagnostics;
        const result = await ingestCrawl(db,{id,jobKey,roasterId:roaster.id,startedAt,completedAt:now(),mode,parserVersion:PARSER_VERSION,status:status as 'success'|'partial'|'failed',products:crawl.products,diagnostics:crawl.diagnostics});
        products = result.coffees; offers = result.offers; restored = result.restored;
      } catch(error) {
        // A response can be lost after a successful atomic commit. Read before marking failure.
        const committed = await db.prepare('SELECT status,products_seen,offers_seen FROM crawl_runs WHERE id=?').bind(id).first<{status:string;products_seen:number;offers_seen:number}>();
        if (committed?.status === 'success') { status='success'; products=committed.products_seen; offers=committed.offers_seen; }
        else {
          status='failed'; const message=safeDiagnostic(error instanceof Error?error.message:'Refresh failed');
          diagnostics=[{stage:'reconcile',code:'ingestion_failed',message}];
          if (committed?.status==='running') await ingestCrawl(db,{id,jobKey,roasterId:roaster.id,startedAt,completedAt:now(),mode,parserVersion:PARSER_VERSION,status:'failed',products:[],diagnostics:[{stage:'reconcile',code:'ingestion_failed',message}]});
        }
      }
      const result={slug:roaster.slug,status,mode,products,offers,restored,diagnostics,elapsedMs:Math.round(performance.now()-started)};results.push(result);await options.report?.(result);
    }
  }));
  // Finish all in-flight work before the caller writes the final report.
  const failure = workers.find(worker => worker.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results;
}
export interface Freshness { listed: number; fresh: number; stale: number; rowsRead: number | null }
/** The one catalog-wide read of the night's report: listed coffees (public_catalog_coffees, the site's own rule) split into
 * fresh (confirmed by a crawl since `since`, the run's day) and stale (still listed on an earlier crawl, dropped after 7 days
 * unconfirmed). About 4,500 rows on today's catalog (docs/read-budget.md: one scan of the view); the summary prints the real count. */
export async function catalogFreshness(db: CatalogDatabase & { rowsRead?: number }, since: string): Promise<Freshness> {
  const before = db.rowsRead;
  const row = await db.prepare('SELECT count(*) AS listed, coalesce(sum(datetime(last_seen_at)<datetime(?)),0) AS stale FROM public_catalog_coffees').bind(since).first<{ listed: number; stale: number }>();
  const listed = Number(row?.listed ?? 0), stale = Number(row?.stale ?? 0);
  return { listed, fresh: listed - stale, stale, rowsRead: before === undefined || db.rowsRead === undefined ? null : db.rowsRead - before };
}
const SUCCEEDED = new Set(['success', 'already_completed']);
/** Source tallies from this run's own results; no database read. */
export function sourceCounts(results: Record<string, unknown>[]) {
  return { attempted: results.length, succeeded: results.filter(r => SUCCEEDED.has(String(r.status))).length,
    partial: results.filter(r => r.status === 'partial').length, failed: results.filter(r => r.status === 'failed').length,
    restored: results.reduce((sum, r) => sum + (Number(r.restored) || 0), 0) };
}
/** The job summary's data section: whether data was written, freshness, and one row per source. */
export function refreshSummaryMarkdown(input: { results: Record<string, unknown>[]; failure: string | null; rowsRead: number; rowsWritten: number; freshness: Freshness | { error: string } | null }) {
  const counts = sourceCounts(input.results), f = input.freshness;
  const freshness = !f ? '' : 'error' in f ? `**Catalog freshness:** not counted (${f.error}).\n\n`
    : `**Catalog freshness** after this run: ${f.listed} coffees listed: **${f.fresh} fresh** (confirmed today), **${f.stale} stale** (listed from an earlier crawl; dropped after 7 days unconfirmed), **${counts.restored} restored** (confirmed again after dropping out).${f.rowsRead === null ? '' : ` Counted with one query, ${f.rowsRead} rows read.`}\n\n`;
  return `## Catalog data\n\n${input.failure ? `**Refresh stopped:** ${input.failure}\n\n` : ''}`
    + `**Sources:** ${counts.attempted} attempted, ${counts.succeeded} succeeded, ${counts.partial} partial, ${counts.failed} failed. D1 rows read ${input.rowsRead}; written ${input.rowsWritten}.\n\n`
    + freshness
    + `| Source | Status | Products | Offers | Restored |\n|---|---|---:|---:|---:|\n${input.results.map(r => `| ${r.slug} | ${r.status} | ${r.products ?? 0} | ${r.offers ?? 0} | ${r.restored ?? 0} |`).join('\n')}\n`;
}
async function main() {
  const started=performance.now();
  const directory=resolve('.local/v2/refresh');await mkdir(directory,{recursive:true});
  const db=new D1RestDatabase(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.CLOUDFLARE_D1_DATABASE_ID??'',process.env.CLOUDFLARE_D1_API_TOKEN??'');
  const scheduledAt=process.env.REFRESH_SCHEDULED_AT??`${new Date().toISOString().slice(0,10)}T00:00:00.000Z`;
  let results:Record<string,unknown>[]=[],failure:string|null=null;
  try {
    // Idempotent index installation also repairs deployments awaiting the quota reset.
    await db.batch([db.prepare(await readFile(new URL('../migrations/d1/0004_alias_lookup.sql',import.meta.url),'utf8')),db.prepare("INSERT OR IGNORE INTO d1_migrations(name) VALUES ('0004_alias_lookup.sql')")]);
    await syncRoasters(db);
    results=await refreshCatalog(db,{scheduledAt,slugs:process.argv.slice(2),relay:process.env.CRAWL_RELAY_URL&&process.env.CRAWL_RELAY_TOKEN?relayFetch(process.env.CRAWL_RELAY_URL,process.env.CRAWL_RELAY_TOKEN):undefined,report:async result=>{results.push(result);console.log(JSON.stringify(result));await appendFile(resolve(directory,'results.jsonl'),JSON.stringify(result)+'\n');}});
  } catch(error) { failure=safeDiagnostic(error instanceof Error?error.message:String(error));console.error(failure);process.exitCode=1; }
  // Also run alone (workflow_dispatch for a few roasters): shared results are recomputed from the new data. Corrections invalidate again.
  await db.batch(invalidateDerived(db)).catch(error=>console.error(safeDiagnostic(error instanceof Error?error.message:String(error))));
  // Skipped when the run stopped: if the database refused (allowance spent, budget cap) this query would fail the same way.
  const freshness=failure?null:await catalogFreshness(db,scheduledAt).catch(error=>({error:safeDiagnostic(error instanceof Error?error.message:String(error))}));
  const summary={scheduledAt,results,failure,sources:sourceCounts(results),freshness,elapsedMs:Math.round(performance.now()-started),rowsRead:db.rowsRead,rowsWritten:db.rowsWritten};
  await writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2));
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,refreshSummaryMarkdown({results,failure,rowsRead:db.rowsRead,rowsWritten:db.rowsWritten,freshness}));
  const attention=failure?[]:await attentionNeeded(db,results,new Date().toISOString());
  for(const reason of attention)console.error(`::error::${reason}`);
  if(process.env.GITHUB_STEP_SUMMARY&&attention.length)await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n**Needs attention:**\n${attention.map(reason=>`- ${reason}`).join('\n')}\n`);
  if(attention.length)process.exitCode=1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(safeDiagnostic(error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
