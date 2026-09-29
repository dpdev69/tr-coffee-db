import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {TestCatalogDatabase} from '../tests/helpers/v2-sqlite';
import {registerRoaster} from '../shared/v2/ingestion';
import {ALL_ROASTER_CONFIGS} from '../scrapers/src/roasters/configs';
import {refreshCatalog} from './v2-refresh.mts';

// Replay public HTTP captures against SQLite only: no D1 credentials or remote writes.
const [baselineDirectory,capturePath]=process.argv.slice(2);
assert.ok(baselineDirectory&&capturePath,'Usage: tsx scripts/v2-benchmark-refresh.mts BASELINE_DIRECTORY RESPONSES_JSONL');
const baseline=await import(pathToFileURL(resolve(baselineDirectory,'scripts/v2-refresh.mts')).href) as {refreshCatalog:typeof refreshCatalog};
type Capture={key:string;ms:number;status:number;headers:[string,string][];cookies:string[];body:string;error?:string};
const captures=(await readFile(capturePath,'utf8')).trim().split('\n').map(line=>JSON.parse(line) as Capture);
const scale=0.1;

async function run(runner:typeof refreshCatalog) {
  const db=new TestCatalogDatabase();
  for(const config of ALL_ROASTER_CONFIGS)await registerRoaster(db,{id:config.slug,slug:config.slug,name:config.name,websiteUrl:config.websiteUrl,trustedHosts:[new URL(config.shopUrl).hostname],adapter:config.platform},'2026-09-27T12:00:00.000Z');
  async function replay(refresh:typeof refreshCatalog,day:string,delayScale:number) {
    const pending=new Map<string,Capture[]>();
    for(const capture of captures){const entries=pending.get(capture.key)??[];entries.push(capture);pending.set(capture.key,entries);}
    let calls=0,active=0,peak=0;
    const started=performance.now();
    const results=await refresh(db,{scheduledAt:`${day}T00:00:00.000Z`,now:()=> `${day}T12:00:00.000Z`,source:{
      sleep:async ms=>{if(delayScale)await new Promise(resolve=>setTimeout(resolve,ms*delayScale));},
      fetch:async(input,init)=>{
        calls++;
        const key=JSON.stringify([String(input),init?.method??'GET',init?.body??null]);
        const capture=pending.get(key)?.shift();assert.ok(capture,`Uncaptured request: ${String(input)}`);
        peak=Math.max(peak,++active);
        try {
          if(delayScale)await new Promise(resolve=>setTimeout(resolve,capture.ms*delayScale));
          if(capture.error)throw new Error(capture.error);
          const headers=new Headers(capture.headers);for(const cookie of capture.cookies)headers.append('set-cookie',cookie);
          return new Response([204,205,304].includes(capture.status)?null:capture.body,{status:capture.status,headers});
        }finally{active--;}
      },
    }});
    const elapsedMs=performance.now()-started;
    assert.ok([...pending.values()].every(entries=>!entries.length),'Replay skipped captured requests');
    assert.equal(calls,captures.length,'Replay issued additional requests');
    const outcomes=results.map(result=>{const outcome={...result};delete outcome.elapsedMs;return outcome;});
    return {elapsedMs,calls,peak,results:outcomes.sort((a,b)=>String(a.slug).localeCompare(String(b.slug)))};
  }
  try {
    // Identical prior state exercises live identities, immutable history and event decisions.
    await replay(baseline.refreshCatalog,'2026-09-28',0);
    const measurement=await replay(runner,'2026-09-29',scale);
    const tables=db.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[];
    const state=tables.map(({name})=>[name,db.sqlite.prepare(`SELECT * FROM "${name}"`).all().map(row=>JSON.stringify(row)).sort()]);
    const stateHash=createHash('sha256').update(JSON.stringify(state)).digest('hex');
    return {...measurement,stateHash};
  }finally{db.sqlite.close();}
}

const trials=[];
for(let trial=0;trial<3;trial++){
  const before=await run(baseline.refreshCatalog),after=await run(refreshCatalog);
  assert.equal(after.stateHash,before.stateHash,'Catalog/history changed');
  assert.equal(after.calls,before.calls);assert.deepEqual(after.results,before.results);
  trials.push({beforeMs:before.elapsedMs,afterMs:after.elapsedMs,calls:after.calls,peakBefore:before.peak,peakAfter:after.peak,stateHash:after.stateHash});
  console.log(JSON.stringify({trial:trial+1,...trials.at(-1)}));
}
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[1];
const beforeMs=median(trials.map(trial=>trial.beforeMs)),afterMs=median(trials.map(trial=>trial.afterMs));
const summary={node:process.version,delayScale:scale,captureSha256:createHash('sha256').update(JSON.stringify(captures)).digest('hex'),sources:ALL_ROASTER_CONFIGS.length,beforeMs,afterMs,reductionPercent:100*(1-afterMs/beforeMs),trials};
await writeFile(`${capturePath}.benchmark.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
