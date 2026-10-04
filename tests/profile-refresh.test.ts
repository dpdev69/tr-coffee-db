import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import type {CatalogDatabase,Statement,SqlValue} from '../shared/v2/database';
import {ingestCrawl,registerRoaster} from '../shared/v2/ingestion';
import type {SourceCoffee} from '../shared/v2/types';
import {applyMigrations} from './helpers/v2-sqlite';
import {applyProfileRefresh,planProfileRefresh,type ProfileCapture} from '../scripts/v2-refresh-local-profiles';

class SQLiteD1 implements CatalogDatabase {
 constructor(readonly sqlite:DatabaseSync){}
 prepare(sql:string):Statement{return new Prepared(this.sqlite,sql);}
 async batch(statements:Statement[]){this.sqlite.exec('BEGIN');try{const result=statements.map(statement=>{const p=statement as Prepared;return this.sqlite.prepare(p.sql).run(...p.values);});this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
}
class Prepared implements Statement {
 values:SqlValue[]=[];constructor(readonly sqlite:DatabaseSync,readonly sql:string){}
 bind(...values:SqlValue[]){this.values=values;return this;}
 async first<T>(){return(this.sqlite.prepare(this.sql).get(...this.values)??null)as T|null;}
 async all<T>(){return{results:this.sqlite.prepare(this.sql).all(...this.values)as T[],success:true};}
}
const now='2026-09-14T20:00:00.000Z';
const eligibility={feature:'catalog_eligibility',value:{is_public:true},sourceType:'RULE_INFERRED' as const,confidence:null,version:'eligibility-v1',sourceReference:'https://shop.test/a'};
const profile={feature:'normalized_origin',value:'Guatemala',sourceType:'RULE_INFERRED' as const,confidence:null,version:'v2-profile-1',sourceReference:'https://shop.test/a'};
async function setup(){
 const sqlite=new DatabaseSync(':memory:');applyMigrations(sqlite);
 const db=new SQLiteD1(sqlite);await registerRoaster(db,{id:'r',slug:'petra',name:'Petra',websiteUrl:'https://shop.test',adapter:'test'});
 const product:SourceCoffee={sourceProductId:'a',canonicalUrl:'https://shop.test/a',name:'Guatemala Coffee',visibility:'public',rawMetadata:{description:'Guatemala washed'},features:[eligibility],offers:[{sourceVariantId:'sku',label:'250g',weightG:250,price:100,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:'https://shop.test/a'}]};
 await ingestCrawl(db,{id:'baseline',roasterId:'r',startedAt:now,completedAt:now,status:'success',parserVersion:'v2-source-2-eligibility',mode:'baseline',products:[product],diagnostics:[]});
 const coffee=sqlite.prepare('SELECT id FROM coffees').get()!;
 sqlite.prepare('INSERT INTO coffee_feature_values VALUES(?,?,?,?,?,?,?,?,?)').run(coffee.id,'normalized_origin','"Colombia"','MANUAL',1,'manual-v1','review',now,now);
 sqlite.prepare('INSERT INTO coffee_feature_values VALUES(?,?,?,?,?,?,?,?,?)').run(coffee.id,'farm','"Source Farm"','ROASTER_DECLARED',null,'source-v1','source',now,now);
 const capture:ProfileCapture={file:'local-fixture',sha256:'fixture',summary:{slug:'petra',startedAt:now,completedAt:now},snapshot:{complete:true,parserVersion:'v2-source-3-profile',products:[{...product,features:[eligibility,profile]}]}};
 return{sqlite,capture};
}
function unchanged(sqlite:DatabaseSync){return ['coffees','offers','price_observations','crawl_runs','coffee_events','roasters'].map(table=>[table,sqlite.prepare(`SELECT * FROM ${table}`).all()]);}
test('feature-only refresh changes no observations or runs, preserves manual/source/eligibility rows and replays without writes',async()=>{
 const{sqlite,capture}=await setup();const original=unchanged(sqlite);const protectedRows=sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY feature,source_type').all();
 const plan=planProfileRefresh(sqlite,[capture]);assert.equal(plan[0].products[0].changed,true);assert.deepEqual(unchanged(sqlite),original);
 assert.deepEqual(sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY feature,source_type').all(),protectedRows);
 const result=applyProfileRefresh(sqlite,[capture],'2026-09-15T00:00:00.000Z');assert.equal(result.changedProducts,1);
 assert.deepEqual(unchanged(sqlite),original);
 for(const row of protectedRows)assert.deepEqual(sqlite.prepare('SELECT * FROM coffee_feature_values WHERE coffee_id=? AND feature=? AND source_type=?').get(row.coffee_id,row.feature,row.source_type),row);
 const first=sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY feature,source_type').all();
 assert.equal(applyProfileRefresh(sqlite,[capture],'2026-09-16T00:00:00.000Z').changedProducts,0);
 assert.deepEqual(sqlite.prepare('SELECT * FROM coffee_feature_values ORDER BY feature,source_type').all(),first);sqlite.close();
});
test('changed raw data, offers, visibility or capture manual values fail before any mutation',async()=>{
 for(const kind of ['raw','offer','visibility','manual']as const){
  const{sqlite,capture}=await setup();const original=unchanged(sqlite);const features=sqlite.prepare('SELECT * FROM coffee_feature_values').all();
  const product=capture.snapshot.products[0];
  if(kind==='raw')product.rawMetadata.description='Changed';
  if(kind==='offer')product.offers[0].price=200;
  if(kind==='visibility')product.visibility='hidden';
  if(kind==='manual')product.features!.push({...profile,sourceType:'MANUAL'});
  assert.throws(()=>applyProfileRefresh(sqlite,[capture]),/differs|differ|MANUAL/);
  assert.deepEqual(unchanged(sqlite),original);assert.deepEqual(sqlite.prepare('SELECT * FROM coffee_feature_values').all(),features);sqlite.close();
 }
});
test('a failed multi-source validation is atomic and cannot update the preceding valid coffee',async()=>{
 const{sqlite,capture}=await setup();const before=sqlite.prepare('SELECT * FROM coffee_feature_values').all();
 const missing=structuredClone(capture);missing.summary.slug='daphne';
 assert.throws(()=>applyProfileRefresh(sqlite,[capture,missing]),/Roaster missing/);
 assert.deepEqual(sqlite.prepare('SELECT * FROM coffee_feature_values').all(),before);sqlite.close();
});
