import type { CatalogDatabase, SqlValue, Statement } from './database';

/** Cache successful read results inside Workers Cache API; no errors, user data or writes are cached.
 * The namespace must include the DB identity and a schema/policy version. This wrapper is only for
 * web catalog reads: the crawler always uses its uncached primary D1 session.
 */
export function cacheCatalogReads(db:CatalogDatabase,cache:Pick<Cache,'match'|'put'>,namespace:string,ttlSeconds=300):CatalogDatabase {
  const originals=new WeakMap<Statement,Statement>();
  const ttl=Math.max(1,Math.min(900,Math.floor(ttlSeconds)));
  async function read<T>(sql:string,values:SqlValue[],method:'first'|'all',fetch:()=>Promise<T>):Promise<T>{
    if(!/^\s*SELECT\b/i.test(sql))return fetch();
    const bytes=new TextEncoder().encode(JSON.stringify([namespace,sql,values,method]));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    // Reserved internal key; no public route serves these database payloads.
    const request=new Request(`https://catalog-cache.internal/v1/${digest}`);
    try{const hit=await cache.match(request);if(hit)return await hit.json() as T;}catch{/* Cache failure must not hide the catalog. */}
    const result=await fetch();
    if(result&&typeof result==='object'&&'success' in result&&result.success===false)return result;
    try{await cache.put(request,Response.json(result,{headers:{'Cache-Control':`public, max-age=${ttl}`}}));}catch{/* Bounded cache is an optimization. */}
    return result;
  }
  return {batch:statements=>db.batch(statements.map(statement=>originals.get(statement)??statement)),prepare(sql:string):Statement{
    const create=(values:SqlValue[]):Statement=>{const statement:Statement={bind:(...next)=>create(next),
      first:<T>()=>read<T|null>(sql,values,'first',()=>db.prepare(sql).bind(...values).first<T>()),
      all:<T>()=>read<{results:T[];success:boolean}>(sql,values,'all',()=>db.prepare(sql).bind(...values).all<T>()),
    };originals.set(statement,db.prepare(sql).bind(...values));return statement;};return create([]);
  }};
}
