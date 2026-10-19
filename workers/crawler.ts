import { beginCrawl, expireCrawls, ingestCrawl, safeDiagnostic } from '../shared/v2/ingestion';
import { stableId } from '../shared/v2/identity';
import { crawlRoaster, CRAWLER_HEADERS, PARSER_VERSION, type CrawlOptions } from '../scrapers/src/v2/crawl';
import { relayRequest, siteRequest } from '../shared/v2/relay';
import { isQualifiedSource } from '../shared/v2/qualified-sources';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs';

/** Hosts of the sources marked runsFrom: 'relay'; the relay fetches nothing else. */
const RELAY_HOSTS=new Set(ALL_ROASTER_CONFIGS.filter(config=>config.runsFrom==='relay').flatMap(config=>{const host=new URL(config.shopUrl).hostname.replace(/^www\./,'');return [host,`www.${host}`];}));

export type CrawlJob = { roasterId: string; slug: string; scheduledAt: string };
interface Attempt { id:string;status:string;started_at:string;parser_version:string;mode:'live'|'baseline'|'import' }
function parseJob(body:unknown):CrawlJob|null {
  if(!body||typeof body!=='object')return null;
  const job=body as Record<string,unknown>;
  if(typeof job.roasterId!=='string'||!job.roasterId||job.roasterId.length>200||typeof job.slug!=='string'||typeof job.scheduledAt!=='string'||!Number.isFinite(Date.parse(job.scheduledAt)))return null;
  return {roasterId:job.roasterId,slug:job.slug,scheduledAt:new Date(job.scheduledAt).toISOString()};
}

/** Dependency injection keeps verification on the actual handler/parser without global fetch mocks. */
export function createCrawlerWorker(sourceOptions:CrawlOptions={},now=()=>new Date().toISOString()) {
  return {
    async scheduled(controller,env,ctx) {
      if(String(env.CRAWLS_ENABLED)!=='true')return;
      ctx.waitUntil((async()=>{
        await expireCrawls(env.DB,now());
        const rows=await env.DB.prepare('SELECT id,slug FROM roasters WHERE active=1').all<{id:string;slug:string}>();
        const known=rows.results.filter(row=>isQualifiedSource(row.slug)&&ALL_ROASTER_CONFIGS.some(config=>config.slug===row.slug));
        // Queue batch limit is 100; avoid invalid empty batches and leave room for future coverage.
        for(let offset=0;offset<known.length;offset+=100)await env.CRAWL_QUEUE.sendBatch(known.slice(offset,offset+100).map(row=>({body:{roasterId:row.id,slug:row.slug,scheduledAt:new Date(controller.scheduledTime).toISOString()},contentType:'json' as const})));
      })());
    },
    async queue(batch,env) {
      for(const message of batch.messages) {
        const job=parseJob(message.body);
        const config=job&&ALL_ROASTER_CONFIGS.find(roaster=>roaster.slug===job.slug);
        if(!job||!config||!isQualifiedSource(job.slug)||!Number.isInteger(message.attempts)||message.attempts<1){message.ack();continue;}
        const deadLetter=batch.queue===env.CRAWL_DLQ_QUEUE;
        // Kill switch. retry() counts toward max_retries and would drain held jobs into the DLQ,
        // so the job is re-sent as a fresh message (attempts restart at 1) and this delivery acked.
        // DLQ deliveries only record exhaustion and never crawl, so they still close normally.
        // ponytail: a held job cycles every 12h while disabled; pause queue delivery for long outages.
        if(!deadLetter&&String(env.CRAWLS_ENABLED)!=='true'){await env.CRAWL_QUEUE.send(job,{contentType:'json',delaySeconds:43200});message.ack();continue;}
        const jobKey=await stableId('job',job.roasterId,job.scheduledAt);
        const id=`${jobKey}:${message.attempts}`;
        let startedAt=now();
        let mode:'live'|'baseline'|'import'=String(env.CRAWL_MODE)==='live'?'live':'baseline';
        let parserVersion=PARSER_VERSION;
        const db=env.DB.withSession('first-primary');
        const retryDelay=Math.min(3600,300*2**Math.min(message.attempts-1,4));
        try {
          const registered=await db.prepare('SELECT slug,active FROM roasters WHERE id=?').bind(job.roasterId).first<{slug:string;active:number}>();
          if(!registered||registered.slug!==job.slug||registered.active!==1){message.ack();continue;}
          const completed=await db.prepare("SELECT id FROM crawl_runs WHERE job_key=? AND status='success' LIMIT 1").bind(jobKey).first();
          if(deadLetter) {
            const pending=await db.prepare("SELECT id,status,started_at,parser_version,mode FROM crawl_runs WHERE job_key=? AND status='running'").bind(jobKey).all<Attempt>();
            for(const attempt of pending.results) await ingestCrawl(db,{id:attempt.id,jobKey,roasterId:job.roasterId,startedAt:attempt.started_at,completedAt:now(),mode:attempt.mode,parserVersion:attempt.parser_version,status:'failed',products:[],diagnostics:[{stage:'queue',code:'retries_exhausted',message:'Queue retries exhausted; catalog state preserved.'}]});
            if(!await db.prepare('SELECT id FROM crawl_runs WHERE job_key=? LIMIT 1').bind(jobKey).first()) await ingestCrawl(db,{id:`${jobKey}:exhausted`,jobKey,roasterId:job.roasterId,startedAt:job.scheduledAt,completedAt:now(),mode,parserVersion,status:'failed',products:[],diagnostics:[{stage:'queue',code:'retries_exhausted',message:'Queue retries exhausted; catalog state preserved.'}]});
            console.error(JSON.stringify({event:'crawl_exhausted',roaster:job.slug,jobKey,recovered:Boolean(completed)}));
            message.ack();continue;
          }
          if(completed){message.ack();continue;}
          const attempts=await db.prepare('SELECT id,status,started_at,parser_version,mode FROM crawl_runs WHERE job_key=?').bind(jobKey).all<Attempt>();
          const existing=attempts.results.find(row=>row.id===id);
          if(existing&&existing.status!=='running'){message.retry({delaySeconds:retryDelay});continue;}
          if(attempts.results.some(row=>row.status==='running'&&Number(row.id.split(':').at(-1))>message.attempts)){message.retry({delaySeconds:retryDelay});continue;}
          // A new delivery supersedes an interrupted earlier attempt. Mark it terminal before fetching.
          for(const interrupted of attempts.results.filter(row=>row.id!==id&&row.status==='running')) {
            await ingestCrawl(db,{id:interrupted.id,jobKey,roasterId:job.roasterId,startedAt:interrupted.started_at,completedAt:now(),mode:interrupted.mode,parserVersion:interrupted.parser_version,
              status:'failed',products:[],diagnostics:[{stage:'queue',code:'interrupted_attempt',message:'Previous attempt was interrupted before completion; retry preserves catalog state.'}]});
          }
          startedAt=existing?.started_at??startedAt;mode=existing?.mode??mode;parserVersion=existing?.parser_version??parserVersion;
          // A newly qualified source establishes SKU history without inventing discovery events.
          if(!existing&&mode==='live'&&!await db.prepare("SELECT id FROM crawl_runs WHERE roaster_id=? AND status='success' AND mode<>'import' LIMIT 1").bind(job.roasterId).first())mode='baseline';
          await beginCrawl(db,{id,jobKey,roasterId:job.roasterId,startedAt,parserVersion,mode});
          const result=await crawlRoaster(config,sourceOptions);
          const status=result.complete?'success':result.products.length?'partial':'failed';
          await ingestCrawl(db,{id,jobKey,roasterId:job.roasterId,startedAt,completedAt:now(),mode,parserVersion,status,products:result.products,diagnostics:result.diagnostics});
          console.log(JSON.stringify({event:'crawl_complete',roaster:job.slug,jobKey,attempt:message.attempts,status,products:result.products.length,diagnostics:result.diagnostics.map(d=>({code:d.code,message:safeDiagnostic(d.message)}))}));
          if(status==='success')message.ack();else message.retry({delaySeconds:Math.max(retryDelay,result.retryAfterSeconds??0)});
        } catch(error) {
          // A different delivery can win the job's unique successful-job constraint or commit despite response loss.
          try {
            const completed=await db.prepare("SELECT id FROM crawl_runs WHERE job_key=? AND status='success' LIMIT 1").bind(jobKey).first();
            const current=await db.prepare('SELECT status FROM crawl_runs WHERE id=?').bind(id).first<{status:string}>();
            if(current?.status==='running')await ingestCrawl(db,{id,jobKey,roasterId:job.roasterId,startedAt,completedAt:now(),mode,parserVersion,status:'failed',products:[],diagnostics:[{stage:'reconcile',code:completed?'superseded_attempt':'ingestion_failed',message:safeDiagnostic(error instanceof Error?error.message:'Crawl could not be reconciled; catalog state preserved.')}]});
            if(completed){message.ack();continue;}
          } catch { /* A storage outage leaves the attempt running; next delivery recovers it. */ }
          console.error(JSON.stringify({event:'crawl_failed',roaster:job.slug,runId:id,error:safeDiagnostic(error instanceof Error?error.message:'Unknown ingestion error')}));
          message.retry({delaySeconds:retryDelay});
        }
      }
    },
    async fetch(request,env){
      const path=new URL(request.url).pathname;
      // RELAY_TOKEN is a Worker secret, so it is absent from the generated env type.
      const token=(env as unknown as {RELAY_TOKEN?:string}).RELAY_TOKEN;
      if(path.startsWith('/site/'))return siteRequest(request,token,env.SITE,env.SITE_ORIGIN);
      if(path!=='/relay')return Response.json({service:'catalog-crawler',status:'ok'});
      return relayRequest(request,token,RELAY_HOSTS,CRAWLER_HEADERS);
    },
  } satisfies ExportedHandler<CrawlerEnv,CrawlJob>;
}
export default createCrawlerWorker();
