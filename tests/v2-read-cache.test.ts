import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheCatalogReads } from '../shared/v2/read-cache';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

class MemoryCache {
  values=new Map<string,Response>();puts=0;
  async match(input:RequestInfo|URL){const key=input instanceof Request?input.url:String(input);return this.values.get(key)?.clone();}
  async put(input:RequestInfo|URL,response:Response){const key=input instanceof Request?input.url:String(input);this.values.set(key,response.clone());this.puts++;}
}
test('successful catalog reads reuse cached result and distinct bindings/methods/namespaces remain separate',async()=>{
  const db=new TestCatalogDatabase();const cache=new MemoryCache();const wrapped=cacheCatalogReads(db,cache,'staging:v4');
  assert.deepEqual({...await wrapped.prepare('SELECT ? value').bind('first').first()},{value:'first'});
  assert.deepEqual({...await wrapped.prepare('SELECT ? value').bind('first').first()},{value:'first'});assert.equal(cache.puts,1);
  await wrapped.prepare('SELECT ? value').bind('second').first();await wrapped.prepare('SELECT ? value').bind('first').all();
  await cacheCatalogReads(db,cache,'other-db:v4').prepare('SELECT ? value').bind('first').first();assert.equal(cache.puts,4);
  assert.equal([...cache.values.values()][0].headers.get('Cache-Control'),'public, max-age=300');db.sqlite.close();
});
test('quota errors are never cached, cache errors fall through, and batches retain native statements',async()=>{
  const db=new TestCatalogDatabase();const cache=new MemoryCache();const wrapped=cacheCatalogReads(db,cache,'staging:v4');
  await assert.rejects(wrapped.prepare('SELECT * FROM missing_table').all());assert.equal(cache.puts,0);
  const broken={match:async()=>{throw new Error('cache unavailable');},put:async()=>{throw new Error('cache unavailable');}};
  assert.deepEqual({...await cacheCatalogReads(db,broken,'staging').prepare('SELECT 1 value').first()},{value:1});
  await wrapped.batch([wrapped.prepare('CREATE TABLE cache_test(value TEXT)'),wrapped.prepare('INSERT INTO cache_test VALUES(?)').bind('ok')]);
  assert.equal((await wrapped.prepare('SELECT value FROM cache_test').first<{value:string}>())?.value,'ok');db.sqlite.close();
});
