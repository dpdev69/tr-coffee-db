/** Offline catalog repair from saved, qualified captures. Dry-run by default; never opens remote D1. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { coffeeExclusionReason } from '../shared/v2/coffee-eligibility';
import { getCatalogCounts, listCatalog } from '../shared/v2/catalog';
import { ingestCrawl } from '../shared/v2/ingestion';
import type { CrawlInput, RawMetadata } from '../shared/v2/types';
import { SQLiteD1 } from './v2-baseline-smoke';
import { deriveProfileFeatures, profileInput } from '../scrapers/src/v2/profile';
import { sqlLiteral } from './v2-migrate';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function repairLocalCatalog(path:string,apply=false,root=process.cwd()) {
  const databasePath=realpathSync(path);
  assert(databasePath.startsWith(realpathSync(resolve(root,'.wrangler'))+sep)&&databasePath.endsWith('.sqlite'),'Only an existing project .wrangler SQLite database is allowed');
  const sqlite=new DatabaseSync(databasePath,{readOnly:!apply});const db=new SQLiteD1(sqlite);
  const directory=resolve(root,'.local/v2');mkdirSync(directory,{recursive:true,mode:0o700});
  const manifest=JSON.parse(readFileSync(resolve(directory,'crawls/qualification.json'),'utf8')) as {qualified:Array<{slug:string;captureFile:string}>};
  try {
    const before=await getCatalogCounts(db);
    const initial=sqlite.prepare('SELECT id FROM coffees ORDER BY id').all();
    const archiveHash=hash(sqlite.prepare('SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id').all());
    const importedHash=hash(sqlite.prepare("SELECT * FROM price_observations WHERE source='import' ORDER BY id").all());
    const eventHash=hash(sqlite.prepare('SELECT * FROM coffee_events ORDER BY id').all());
    let backupPath:string|null=null;
    if(apply){backupPath=resolve(directory,`before-catalog-repair-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);sqlite.exec(`VACUUM INTO ${sqlLiteral(backupPath)}`);chmodSync(backupPath,0o600);}
    const baselines=[];
    for(const entry of manifest.qualified){
      const file=resolve(directory,'crawls',basename(entry.captureFile));const captureText=readFileSync(file,'utf8');
      const capture=JSON.parse(captureText) as {summary:{slug:string;startedAt:string;completedAt:string};snapshot:{complete:boolean;parserVersion:string;products:CrawlInput['products'];diagnostics:CrawlInput['diagnostics']}};
      assert(capture.snapshot.complete&&capture.snapshot.products.length>0,'Complete capture required');assert.equal(capture.summary.slug,entry.slug);
      assert.equal(capture.snapshot.parserVersion,'v2-source-3-profile','Qualified profile capture required');
      const roaster=sqlite.prepare('SELECT id,last_success_at FROM roasters WHERE slug=?').get(entry.slug);assert(roaster,`Missing ${entry.slug}`);
      if(roaster.last_success_at&&String(roaster.last_success_at)>=capture.summary.startedAt){baselines.push({slug:entry.slug,status:'already-applied-or-newer'});continue;}
      const input:CrawlInput={id:`catalog-repair-${entry.slug}-${hash(captureText).slice(0,16)}`,roasterId:String(roaster.id),startedAt:capture.summary.startedAt,completedAt:capture.summary.completedAt,mode:'baseline',status:'success',parserVersion:capture.snapshot.parserVersion,products:capture.snapshot.products,diagnostics:capture.snapshot.diagnostics};
      const result=apply?await ingestCrawl(db,input):{coffees:input.products.length,offers:input.products.reduce((sum,p)=>sum+p.offers.length,0),events:0};
      assert.equal(result.events,0);baselines.push({slug:entry.slug,status:apply?'applied':'planned',...result});
    }
    const rows=sqlite.prepare("SELECT id,name,canonical_url,raw_metadata_json FROM coffees WHERE visibility='public'").all() as {id:string;name:string;canonical_url:string;raw_metadata_json:string}[];
    const excluded=rows.flatMap(row=>{const reason=coffeeExclusionReason({name:row.name,canonicalUrl:row.canonical_url,rawMetadata:JSON.parse(row.raw_metadata_json) as RawMetadata});return reason?[{id:row.id,name:row.name,url:row.canonical_url,reason}]:[];});
    if(apply){
      sqlite.exec('BEGIN');
      try{for(const row of excluded)sqlite.prepare("UPDATE coffees SET visibility='hidden' WHERE id=? AND canonical_url=? AND visibility='public'").run(row.id,row.url);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
    let profilesRefreshed=0;
    if(apply){
      const profiles=sqlite.prepare('SELECT c.id,c.name,c.canonical_url,c.source_product_id,c.raw_metadata_json,r.name AS roaster_name FROM coffees c JOIN roasters r ON r.id=c.roaster_id').all();
      const keys=['normalized_origin','process_family','roast_classification','flavor_notes_normalized','flavor_families','normalized_variety','brew_compatibility','is_decaf'];
      sqlite.exec('BEGIN');
      try{for(const row of profiles){
        const raw=JSON.parse(String(row.raw_metadata_json)) as RawMetadata;
        const source=raw.sourceData&&typeof raw.sourceData==='object'&&!Array.isArray(raw.sourceData)?raw.sourceData:null;
        if(!source||source.legacySource)continue;
        const features=deriveProfileFeatures(profileInput(source,String(row.name),String(row.canonical_url),row.source_product_id==null?null:String(row.source_product_id),raw.description??'',String(row.roaster_name)));
        sqlite.prepare(`DELETE FROM coffee_feature_values WHERE coffee_id=? AND source_type='RULE_INFERRED' AND feature IN (${keys.map(()=>'?').join(',')})`).run(row.id,...keys);
        for(const feature of features)sqlite.prepare('INSERT INTO coffee_feature_values(coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(row.id,feature.feature,JSON.stringify(feature.value),feature.sourceType,feature.confidence,feature.version,feature.sourceReference??null,new Date().toISOString(),new Date().toISOString());
        profilesRefreshed++;
      }sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
    assert.equal(hash(sqlite.prepare('SELECT * FROM legacy_traceability ORDER BY source_table,legacy_id').all()),archiveHash,'Archives changed');
    assert.equal(hash(sqlite.prepare("SELECT * FROM price_observations WHERE source='import' ORDER BY id").all()),importedHash,'Imported observations changed');
    assert.equal(hash(sqlite.prepare('SELECT * FROM coffee_events ORDER BY id').all()),eventHash,'Repair must not manufacture discovery events');
    for(const row of initial)assert(sqlite.prepare('SELECT id FROM coffees WHERE id=?').get(row.id),'Original identity lost');
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    const recent=await listCatalog(db,{sort:'newest',perPage:6});
    const report={checkedAt:new Date().toISOString(),mode:apply?'applied':'dry-run',databasePath,backupPath,before,after:await getCatalogCounts(db),baselines,excluded,profilesRefreshed,originalIdentitiesPreserved:initial.length,archivesUnchanged:true,importedObservationsUnchanged:true,eventsUnchanged:true,foreignKeyViolations:0,recent:recent.coffees.map(c=>({name:c.name,firstSeenAt:c.firstSeenAt})),networkCalls:0,remoteWrites:0};
    writeFileSync(resolve(directory,`catalog-repair-${apply?'applied':'plan'}.json`),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    return report;
  }finally{sqlite.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const index=process.argv.indexOf('--local-db');assert(index>=0&&process.argv[index+1],'--local-db <existing .wrangler SQLite> required');console.log(JSON.stringify(await repairLocalCatalog(resolve(process.argv[index+1]),process.argv.includes('--apply')),null,2));}
