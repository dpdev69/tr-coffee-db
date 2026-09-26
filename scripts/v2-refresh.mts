import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beginCrawl, expireCrawls, ingestCrawl, safeDiagnostic } from '../shared/v2/ingestion';
import { stableId } from '../shared/v2/identity';
import type { CatalogDatabase } from '../shared/v2/database';
import { isQualifiedSource } from '../shared/v2/qualified-sources';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs';
import { crawlRoaster, PARSER_VERSION, type CrawlOptions } from '../scrapers/src/v2/crawl';
import { D1RestDatabase } from './v2-d1-rest';

export async function refreshCatalog(db: CatalogDatabase, options: { slugs?: string[]; scheduledAt: string; source?: CrawlOptions; now?: () => string; report?: (result: Record<string, unknown>) => Promise<void> }) {
  const now = options.now ?? (() => new Date().toISOString());
  await expireCrawls(db, now());
  const active = (await db.prepare('SELECT id,slug FROM roasters WHERE active=1 ORDER BY slug').all<{id:string;slug:string}>()).results;
  if (options.slugs?.some(slug => !active.some(row => row.slug === slug))) throw new Error('Requested roaster is not active.');
  const results: Record<string, unknown>[] = [];
  for (const roaster of active.filter(r => !options.slugs?.length || options.slugs.includes(r.slug))) {
    const config = ALL_ROASTER_CONFIGS.find(config => config.slug === roaster.slug);
    if (!config) throw new Error(`Active roaster lacks configuration: ${roaster.slug}`);
    const jobKey = await stableId('job',roaster.id,options.scheduledAt);
    if (await db.prepare("SELECT id FROM crawl_runs WHERE job_key=? AND status='success' LIMIT 1").bind(jobKey).first()) {
      const result={slug:roaster.slug,status:'already_completed'};results.push(result);await options.report?.(result);continue;
    }
    const startedAt = now();
    const mode = await db.prepare("SELECT id FROM crawl_runs WHERE roaster_id=? AND status='success' AND mode<>'import' LIMIT 1").bind(roaster.id).first() ? 'live' : 'baseline';
    const id = await stableId('run',jobKey,startedAt);
    await beginCrawl(db,{id,jobKey,roasterId:roaster.id,startedAt,mode,parserVersion:PARSER_VERSION});
    let status = 'failed', products = 0, offers = 0, diagnostics: unknown[] = [];
    try {
      const crawl = await crawlRoaster(config,options.source);
      if (crawl.complete && !isQualifiedSource(roaster.slug)) {
        crawl.complete = false;
        crawl.diagnostics.push({stage:'coverage',code:'source_unqualified',message:'Parser produced a snapshot but source coverage has not passed review.'});
      }
      status = crawl.complete ? 'success' : crawl.products.length ? 'partial' : 'failed';
      diagnostics = crawl.diagnostics;
      const result = await ingestCrawl(db,{id,jobKey,roasterId:roaster.id,startedAt,completedAt:now(),mode,parserVersion:PARSER_VERSION,status:status as 'success'|'partial'|'failed',products:crawl.products,diagnostics:crawl.diagnostics});
      products = result.coffees; offers = result.offers;
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
    const result={slug:roaster.slug,status,mode,products,offers,diagnostics};results.push(result);await options.report?.(result);
  }
  return results;
}
async function main() {
  const directory=resolve('.local/v2/refresh');await mkdir(directory,{recursive:true});
  const db=new D1RestDatabase(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.CLOUDFLARE_D1_DATABASE_ID??'',process.env.CLOUDFLARE_D1_API_TOKEN??'');
  const scheduledAt=process.env.REFRESH_SCHEDULED_AT??`${new Date().toISOString().slice(0,10)}T00:00:00.000Z`;
  let results:Record<string,unknown>[]=[],failure:string|null=null;
  try {
    // Idempotent index installation also repairs deployments awaiting the quota reset.
    await db.batch([db.prepare(await readFile(new URL('../migrations/d1/0004_alias_lookup.sql',import.meta.url),'utf8')),db.prepare("INSERT OR IGNORE INTO d1_migrations(name) VALUES ('0004_alias_lookup.sql')")]);
    results=await refreshCatalog(db,{scheduledAt,slugs:process.argv.slice(2),report:async result=>{results.push(result);console.log(JSON.stringify(result));await appendFile(resolve(directory,'results.jsonl'),JSON.stringify(result)+'\n');}});
  } catch(error) { failure=safeDiagnostic(error instanceof Error?error.message:String(error));console.error(failure);process.exitCode=1; }
  const summary={scheduledAt,results,failure,rowsRead:db.rowsRead,rowsWritten:db.rowsWritten};
  await writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2));
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`${failure?`**Refresh stopped:** ${failure}\n\n`:''}Catalog refresh: ${results.filter(r=>r.status==='success'||r.status==='already_completed').length}/${results.length} successful. D1 rows read ${db.rowsRead}; written ${db.rowsWritten}.\n\n| Source | Status | Products | Offers |\n|---|---|---:|---:|\n${results.map(r=>`| ${r.slug} | ${r.status} | ${r.products??0} | ${r.offers??0} |`).join('\n')}\n`);
  if(results.some(r=>r.status!=='success'&&r.status!=='already_completed'))process.exitCode=1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(safeDiagnostic(error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
