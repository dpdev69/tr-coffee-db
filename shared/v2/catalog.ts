import { truthfulFeatures, truthfulMetadata } from './profile-truth';
import { coffeeOnlySql } from './coffee-eligibility';
import { countryFilterAliases } from './country-labels';
import type { CatalogDatabase, SqlValue } from './database';
import { canonicalizeUrl, unitPriceTry } from './identity';
import type { CoffeeEvent, FeatureValue, Json, PriceObservation, RawMetadata } from './types';

export interface CatalogOffer {
  id: string; coffeeId: string; sourceVariantId: string | null; label: string | null;
  weightG: number | null; currency: string | null; priceMinor: number | null; compareAtMinor: number | null;
  inStock: boolean | null; purchaseUrl: string | null; unitPriceTry: number | null;
  firstSeenAt: string; lastSeenAt: string; lastPriceChangeAt: string | null;
}
export interface CatalogCoffee {
  id: string; name: string; slug: string; canonicalUrl: string; sourceUrl: string | null; sourceProductId: string | null;
  roaster: { id: string; slug: string; name: string; websiteUrl: string; city: string | null };
  rawMetadata: RawMetadata; features: FeatureValue[]; offers: CatalogOffer[]; latestEvents: CoffeeEvent[];
  firstSeenAt: string; lastSeenAt: string; discontinuedAt: string | null; stale: boolean;
}
export interface CatalogFilters {
  origin?: string[]; process?: string[]; taste?: string[]; roaster?: string[];
  priceMin?: number; priceMax?: number; search?: string;
  farm?: string; producer?: string; variety?: string; roast?: string[]; brewMethod?: string[];
  altitude?: string; traceability?: 'available' | 'missing';
  event?: CoffeeEvent['type']; since?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'unit_price_asc';
  page?: number; perPage?: number;
}
export interface CatalogRoaster {
  id: string; slug: string; name: string; websiteUrl: string; city: string | null; adapter: string;
  coffeeCount: number; offerCount: number; lastAttemptAt: string | null; lastSuccessAt: string | null; crawlHealth: string;
}
interface CoffeeRow {
  id:string;roaster_id:string;source_product_id:string|null;canonical_url:string;name:string;slug:string;raw_metadata_json:string;
  first_seen_at:string;last_seen_at:string;discontinued_at:string|null;
  roaster_slug:string;roaster_name:string;website_url:string;city:string|null;trusted_hosts_json:string;
}
interface OfferRow {id:string;coffee_id:string;source_variant_id:string|null;label:string|null;weight_g:number|null;currency:string|null;current_price_minor:number|null;compare_at_price_minor:number|null;in_stock:number|null;purchase_url:string;first_seen_at:string;last_seen_at:string;last_price_change_at:string|null}
interface FeatureRow {coffee_id:string;feature:string;value_json:string;source_type:FeatureValue['sourceType'];confidence:number|null;version:string;source_reference:string|null}
interface EventRow {id:string;coffee_id:string;offer_id:string|null;type:CoffeeEvent['type'];created_at:string;before_json:string;after_json:string;idempotency_key:string;observation_id:string|null}
const COFFEE_COLUMNS='c.*,r.slug AS roaster_slug,r.name AS roaster_name,r.website_url,r.city,r.trusted_hosts_json';
const EVENT_TYPES=new Set(['NEW','PRICE_DROP','RESTOCKED','DEAL','OUT_OF_STOCK']);
const placeholders=(length:number)=>Array.from({length},()=>'?').join(',');
function parseJson<T>(value:string,fallback:T):T { try{return JSON.parse(value) as T;}catch{return fallback;} }
function eventFromRow(row:EventRow):CoffeeEvent { return {id:row.id,coffeeId:row.coffee_id,offerId:row.offer_id,type:row.type,createdAt:row.created_at,before:parseJson<Json>(row.before_json,null),after:parseJson<Json>(row.after_json,null),idempotencyKey:row.idempotency_key,observationId:row.observation_id}; }

export async function getCatalogCounts(db:CatalogDatabase):Promise<{coffees:number;roasters:number;offers:number}> {
  const counts=await db.prepare(`SELECT count(DISTINCT c.id) AS coffees,count(DISTINCT c.roaster_id) AS roasters,count(o.id) AS offers FROM public_catalog_coffees c JOIN offers o ON o.coffee_id=c.id AND o.in_stock=1 AND o.retired_at IS NULL WHERE ${coffeeOnlySql()}`).first<{coffees:number;roasters:number;offers:number}>();
  return counts??{coffees:0,roasters:0,offers:0};
}

/** Every current-list count and row query starts from the same canonical view. */
export async function listCatalog(db:CatalogDatabase,filters:CatalogFilters={},now=Date.now()):Promise<{coffees:CatalogCoffee[];total:number;page:number;perPage:number;totalPages:number}> {
  const {where,values}=buildFilters(filters);
  const page=Number.isFinite(filters.page)?Math.max(1,Math.floor(filters.page!)):1;
  const perPage=Number.isFinite(filters.perPage)?Math.min(100,Math.max(1,Math.floor(filters.perPage!))):24;
  const from='FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id';
  const total=await db.prepare(`SELECT count(*) AS count ${from} WHERE ${where}`).bind(...values).first<{count:number}>();
  const sorts:Record<string,string>={
    newest:'c.first_seen_at DESC,c.id',
    price_asc:'(SELECT min(o.current_price_minor) FROM offers o WHERE o.coffee_id=c.id AND o.in_stock=1 AND o.retired_at IS NULL AND o.currency=\'TRY\') ASC NULLS LAST,c.id',
    price_desc:'(SELECT min(o.current_price_minor) FROM offers o WHERE o.coffee_id=c.id AND o.in_stock=1 AND o.retired_at IS NULL AND o.currency=\'TRY\') DESC NULLS LAST,c.id',
    unit_price_asc:'(SELECT min(1.0*o.current_price_minor/o.weight_g) FROM offers o WHERE o.coffee_id=c.id AND o.in_stock=1 AND o.retired_at IS NULL AND o.currency=\'TRY\' AND o.weight_g>0) ASC NULLS LAST,c.id',
  };
  const rows=await db.prepare(`SELECT ${COFFEE_COLUMNS} ${from} WHERE ${where} ORDER BY ${sorts[filters.sort??'newest']??sorts.newest} LIMIT ? OFFSET ?`).bind(...values,perPage,(page-1)*perPage).all<CoffeeRow>();
  return {coffees:await hydrate(db,rows.results,now),total:total?.count??0,page,perPage,totalPages:Math.ceil((total?.count??0)/perPage)};
}

function buildFilters(filters:CatalogFilters):{where:string;values:SqlValue[]} {
  const conditions=[coffeeOnlySql()];const values:SqlValue[]=[];
  // Querying declared and inferred fields together is useful; their display/provenance remains separate.
  const metadata=(rawPath:string,features:string[],accepted?:string[],expand?:(input:string[])=>string[])=>{
    const selected=accepted?.map(value=>value.trim()).filter(Boolean).slice(0,20);
    if(!selected?.length)return;
    const input=JSON.stringify(expand?expand(selected):selected);
    // JSON arrays bound as values keep alias expansion and combined filters below D1's parameter limit.
    const matches="IN (SELECT value FROM json_each(?))";
    conditions.push(`(json_extract(c.raw_metadata_json,?) ${matches} OR EXISTS(SELECT 1 FROM json_each(c.raw_metadata_json,?) j WHERE j.value ${matches}) OR EXISTS(SELECT 1 FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (SELECT value FROM json_each(?)) AND (json_extract(f.value_json,'$') ${matches} OR EXISTS(SELECT 1 FROM json_each(f.value_json) j WHERE j.value ${matches}))))`);
    values.push(rawPath,input,rawPath,input,JSON.stringify(features),input,input);
  };
  metadata('$.country',['normalized_origin','origin_country'],filters.origin,countryFilterAliases);
  metadata('$.process',['process_family','process'],filters.process);
  metadata('$.roast',['roast_classification','roast_level'],filters.roast);
  metadata('$.tastingNotes',['flavor_families','flavor_categories','flavor_notes_normalized'],filters.taste);
  metadata('$.brewMethods',['brew_compatibility','brew_methods'],filters.brewMethod);
  if(filters.roaster?.length){const input=filters.roaster.slice(0,20);conditions.push(`r.slug IN (${placeholders(input.length)})`);values.push(...input);}
  if(filters.search?.trim()){
    const escaped=filters.search.trim().slice(0,100).replace(/[\\%_]/g,'\\$&');
    conditions.push("(c.name LIKE ? ESCAPE '\\' OR r.name LIKE ? ESCAPE '\\' OR json_extract(c.raw_metadata_json,'$.description') LIKE ? ESCAPE '\\')");
    values.push(`%${escaped}%`,`%${escaped}%`,`%${escaped}%`);
  }
  for(const [field,feature] of [['farm','origin_farm'],['producer','origin_producer'],['variety','variety']] as const){
    const input=filters[field];
    if(input?.trim())metadata(field==='variety'?'$.varieties':`$.${field}`,[feature,...(field==='variety'?['normalized_variety']:[])],[input.trim()]);
  }
  if(filters.altitude?.trim()){
    // Source text only: a digit sequence is not evidence of a numeric altitude/range.
    conditions.push("json_type(c.raw_metadata_json,'$.altitude')='text' AND lower(trim(json_extract(c.raw_metadata_json,'$.altitude'))) NOT IN ('','unknown','bilinmiyor') AND instr(lower(json_extract(c.raw_metadata_json,'$.altitude')),lower(?))>0");
    values.push(filters.altitude.trim().slice(0,100));
  }
  if(filters.traceability==='available'||filters.traceability==='missing'){
    // Same archived identity/publication boundary as the retained journey bridge.
    const evidence=`EXISTS(SELECT 1 FROM legacy_id_map m
      JOIN legacy_traceability a ON a.source_table='coffees' AND a.legacy_id=m.legacy_id
      JOIN legacy_traceability l ON l.source_table='coffee_lots' AND l.legacy_id=json_extract(a.payload_json,'$.green_lot_id')
      WHERE m.source_system='supabase' AND m.entity_type='coffee' AND m.canonical_id=c.id
      AND json_extract(l.payload_json,'$.is_public')=1
      AND EXISTS(SELECT 1 FROM legacy_traceability s WHERE s.source_table='trace_sources'
        AND json_extract(s.payload_json,'$.lot_id')=l.legacy_id AND json_extract(s.payload_json,'$.is_public')=1
        AND json_type(s.payload_json,'$.source_url')='text' AND length(trim(json_extract(s.payload_json,'$.source_url')))>0))`;
    conditions.push(filters.traceability==='missing'?`NOT ${evidence}`:evidence);
  }
  if(Number.isFinite(filters.priceMin)||Number.isFinite(filters.priceMax)){
    const priceConditions=["o.coffee_id=c.id","o.in_stock=1","o.retired_at IS NULL","o.currency='TRY'"];
    if(Number.isFinite(filters.priceMin)){priceConditions.push('o.current_price_minor>=?');values.push(Math.round(Math.max(0,filters.priceMin!)*100));}
    if(Number.isFinite(filters.priceMax)){priceConditions.push('o.current_price_minor<=?');values.push(Math.round(Math.max(0,filters.priceMax!)*100));}
    conditions.push(`EXISTS(SELECT 1 FROM offers o WHERE ${priceConditions.join(' AND ')})`);
  }
  if(filters.event&&EVENT_TYPES.has(filters.event)){
    const eventConditions=['e.coffee_id=c.id','e.type=?'];values.push(filters.event);
    if(filters.since&&Number.isFinite(Date.parse(filters.since))){eventConditions.push('e.created_at>=?');values.push(new Date(filters.since).toISOString());}
    // A deal/drop badge is valid only while its triggering observation still matches the current offer price.
    if(filters.event==='DEAL'||filters.event==='PRICE_DROP')eventConditions.push("EXISTS(SELECT 1 FROM offers o JOIN price_observations p ON p.id=e.observation_id WHERE o.id=e.offer_id AND o.retired_at IS NULL AND o.in_stock=1 AND o.current_price_minor=p.price_minor AND o.currency=p.currency AND o.weight_g=p.weight_g)");
    // Another available SKU cannot keep a sold-out/retired package in the restock feed.
    if(filters.event==='RESTOCKED')eventConditions.push('EXISTS(SELECT 1 FROM offers o WHERE o.id=e.offer_id AND o.coffee_id=c.id AND o.retired_at IS NULL AND o.in_stock=1)');
    conditions.push(`EXISTS(SELECT 1 FROM coffee_events e WHERE ${eventConditions.join(' AND ')})`);
  }
  return {where:conditions.join(' AND '),values};
}

/** Details are durable even after stock loss/discontinuation; hidden/unclassified coffees stay private. */
export async function getCoffeeDetail(db:CatalogDatabase,slugOrId:string,now=Date.now()):Promise<(CatalogCoffee&{priceHistory:PriceObservation[]})|null> {
  const row=await db.prepare(`SELECT ${COFFEE_COLUMNS} FROM coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.visibility='public' AND ${coffeeOnlySql()} AND c.id IN (SELECT id FROM coffees WHERE slug=? UNION SELECT id FROM coffees WHERE id=? UNION SELECT coffee_id FROM coffee_aliases WHERE alias_type='slug' AND alias=?) LIMIT 1`).bind(slugOrId,slugOrId,slugOrId).first<CoffeeRow>();
  if(!row)return null;
  const [coffee]=await hydrate(db,[row],now);
  const history=await db.prepare(`SELECT p.* FROM price_observations p JOIN offers o ON o.id=p.offer_id WHERE o.coffee_id=? ORDER BY p.observed_at DESC,p.id DESC LIMIT 200`).bind(row.id).all<{id:string;offer_id:string;crawl_run_id:string;observed_at:string;price_minor:number|null;compare_at_minor:number|null;weight_g:number|null;currency:string|null;in_stock:number|null;source:'crawl'|'import'}>();
  return {...coffee,priceHistory:history.results.map(p=>({id:p.id,offerId:p.offer_id,crawlRunId:p.crawl_run_id,observedAt:p.observed_at,priceMinor:p.price_minor,compareAtMinor:p.compare_at_minor,weightG:p.weight_g,currency:p.currency,inStock:p.in_stock===null?null:p.in_stock===1,source:p.source}))};
}

function trustedSourceUrl(row:CoffeeRow):string|null {
  const hosts=parseJson<string[]>(row.trusted_hosts_json,[]);
  if(!hosts.length)return null;
  try{return canonicalizeUrl(row.canonical_url,hosts);}catch{return null;}
}

async function hydrate(db:CatalogDatabase,rows:CoffeeRow[],now:number):Promise<CatalogCoffee[]> {
  if(!rows.length)return [];
  const ids=rows.map(row=>row.id);const list=placeholders(ids.length);
  const [offers,features,events]=await Promise.all([
    db.prepare(`SELECT * FROM offers WHERE coffee_id IN (${list}) AND retired_at IS NULL ORDER BY in_stock DESC NULLS LAST,current_price_minor ASC NULLS LAST,id`).bind(...ids).all<OfferRow>(),
    db.prepare(`SELECT * FROM coffee_feature_values WHERE coffee_id IN (${list}) ORDER BY feature,source_type`).bind(...ids).all<FeatureRow>(),
    db.prepare(`SELECT * FROM (SELECT e.*,row_number() OVER(PARTITION BY coffee_id,type ORDER BY created_at DESC,id DESC) AS position FROM coffee_events e WHERE coffee_id IN (${list})) WHERE position=1 ORDER BY created_at DESC`).bind(...ids).all<EventRow>(),
  ]);
  return rows.map(row=>({id:row.id,name:row.name,slug:row.slug,canonicalUrl:row.canonical_url,sourceUrl:trustedSourceUrl(row),sourceProductId:row.source_product_id,
    roaster:{id:row.roaster_id,slug:row.roaster_slug,name:row.roaster_name,websiteUrl:row.website_url,city:row.city},
    rawMetadata:truthfulMetadata(parseJson<RawMetadata>(row.raw_metadata_json,{}),row.name),
    features:truthfulFeatures(features.results.filter(f=>f.coffee_id===row.id).map(f=>({feature:f.feature,value:parseJson<Json>(f.value_json,null),sourceType:f.source_type,confidence:f.confidence,version:f.version,sourceReference:f.source_reference})),parseJson<RawMetadata>(row.raw_metadata_json,{})),
    offers:offers.results.filter(o=>o.coffee_id===row.id).map(o=>{
      let purchaseUrl:string|null=null;
      try{const hosts=parseJson<string[]>(row.trusted_hosts_json,[]);if(hosts.length)purchaseUrl=canonicalizeUrl(o.purchase_url,hosts);}catch{/* Invalid imported URL has no purchase action. */}
      return {id:o.id,coffeeId:o.coffee_id,sourceVariantId:o.source_variant_id,label:o.label,weightG:o.weight_g,currency:o.currency,priceMinor:o.current_price_minor,compareAtMinor:o.compare_at_price_minor,
        inStock:o.in_stock===null?null:o.in_stock===1,purchaseUrl,unitPriceTry:unitPriceTry(o.current_price_minor,o.weight_g,o.currency),firstSeenAt:o.first_seen_at,lastSeenAt:o.last_seen_at,lastPriceChangeAt:o.last_price_change_at};
    }),
    latestEvents:events.results.filter(e=>e.coffee_id===row.id).map(eventFromRow),
    firstSeenAt:row.first_seen_at,lastSeenAt:row.last_seen_at,discontinuedAt:row.discontinued_at,stale:now-Date.parse(row.last_seen_at)>3*86400000,
  }));
}

export async function listRoasters(db:CatalogDatabase):Promise<CatalogRoaster[]> {
  const rows=await db.prepare(`SELECT r.*,count(DISTINCT c.id) AS coffee_count,count(DISTINCT o.id) AS offer_count FROM roasters r JOIN public_catalog_coffees c ON c.roaster_id=r.id JOIN offers o ON o.coffee_id=c.id AND o.in_stock=1 AND o.retired_at IS NULL WHERE ${coffeeOnlySql()} GROUP BY r.id ORDER BY r.name,r.id`)
    .all<{id:string;slug:string;name:string;website_url:string;city:string|null;adapter:string;coffee_count:number;offer_count:number;last_attempt_at:string|null;last_success_at:string|null;crawl_health:string}>();
  return rows.results.map(r=>({id:r.id,slug:r.slug,name:r.name,websiteUrl:r.website_url,city:r.city,adapter:r.adapter,coffeeCount:r.coffee_count,offerCount:r.offer_count,lastAttemptAt:r.last_attempt_at,lastSuccessAt:r.last_success_at,crawlHealth:r.crawl_health}));
}
export async function getRoasterDetail(db:CatalogDatabase,slug:string):Promise<{roaster:CatalogRoaster;catalog:Awaited<ReturnType<typeof listCatalog>>}|null> {
  const row=await db.prepare('SELECT id,slug,name,website_url,city,adapter,last_attempt_at,last_success_at,crawl_health FROM roasters WHERE slug=?').bind(slug)
    .first<{id:string;slug:string;name:string;website_url:string;city:string|null;adapter:string;last_attempt_at:string|null;last_success_at:string|null;crawl_health:string}>();
  if(!row)return null;
  const catalog=await listCatalog(db,{roaster:[slug]});
  const offerCount=await db.prepare(`SELECT count(*) AS count FROM offers o JOIN public_catalog_coffees c ON c.id=o.coffee_id WHERE c.roaster_id=? AND o.in_stock=1 AND o.retired_at IS NULL AND ${coffeeOnlySql()}`).bind(row.id).first<{count:number}>();
  return {roaster:{id:row.id,slug:row.slug,name:row.name,websiteUrl:row.website_url,city:row.city,adapter:row.adapter,coffeeCount:catalog.total,offerCount:offerCount?.count??0,lastAttemptAt:row.last_attempt_at,lastSuccessAt:row.last_success_at,crawlHealth:row.crawl_health},catalog};
}

export async function listEvents(db:CatalogDatabase,type?:CoffeeEvent['type'],limit=30):Promise<CoffeeEvent[]> {
  const accepted=type&&EVENT_TYPES.has(type)?type:null;
  const values:SqlValue[]=accepted?[accepted]:[];
  values.push(Math.min(100,Math.max(1,Number.isFinite(limit)?Math.floor(limit):30)));
  const rows=await db.prepare(`SELECT e.* FROM coffee_events e JOIN coffees c ON c.id=e.coffee_id WHERE c.visibility='public' AND ${coffeeOnlySql()} ${accepted?'AND e.type=?':''} ORDER BY e.created_at DESC,e.id DESC LIMIT ?`).bind(...values).all<EventRow>();
  return rows.results.map(eventFromRow);
}

/** Explainable catalog similarity, never a personalized numerical match. */
export async function getSimilarCoffees(db:CatalogDatabase,coffee:CatalogCoffee,limit=4):Promise<Array<CatalogCoffee&{similarityReasons:string[]}>> {
  const candidates:CatalogCoffee[]=[];
  // A catalog of low thousands is cheap to compare in bounded pages; no external model or embeddings.
  for(let page=1;page<=50;page++){
    const result=await listCatalog(db,{page,perPage:100});candidates.push(...result.coffees);
    if(page>=result.totalPages)break;
  }
  const origin=featureStrings(coffee,'normalized_origin','origin_country').concat(coffee.rawMetadata.country??[]);
  const process=featureStrings(coffee,'process_family','process').concat(coffee.rawMetadata.process??[]);
  const flavor=featureStrings(coffee,'flavor_families','flavor_categories');
  return candidates.filter(c=>c.id!==coffee.id&&c.canonicalUrl!==coffee.canonicalUrl&&!(c.roaster.id===coffee.roaster.id&&c.name.toLocaleLowerCase('tr-TR')===coffee.name.toLocaleLowerCase('tr-TR')))
    .map(candidate=>{
      const reasons:string[]=[];
      if(overlaps(origin,featureStrings(candidate,'normalized_origin','origin_country').concat(candidate.rawMetadata.country??[])))reasons.push('Aynı kökenden');
      if(overlaps(process,featureStrings(candidate,'process_family','process').concat(candidate.rawMetadata.process??[])))reasons.push('Benzer işleme yöntemi');
      if(overlaps(flavor,featureStrings(candidate,'flavor_families','flavor_categories')))reasons.push('Benzer tat profili');
      return {...candidate,similarityReasons:reasons};
    }).filter(c=>c.similarityReasons.length>0).sort((a,b)=>b.similarityReasons.length-a.similarityReasons.length||b.firstSeenAt.localeCompare(a.firstSeenAt)||a.id.localeCompare(b.id))
    .slice(0,Math.min(12,Math.max(0,Number.isFinite(limit)?Math.floor(limit):4)));
}
function featureStrings(coffee:CatalogCoffee,...names:string[]):string[]{return coffee.features.filter(f=>names.includes(f.feature)).flatMap(f=>typeof f.value==='string'?[f.value]:Array.isArray(f.value)?f.value.filter((v):v is string=>typeof v==='string'):[]);}
function overlaps(left:string[],right:string[]):boolean{return left.some(a=>right.some(b=>a.toLocaleLowerCase('tr-TR')===b.toLocaleLowerCase('tr-TR')));}
