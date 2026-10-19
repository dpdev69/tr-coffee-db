import { cleanCoffeeName, FACT_FEATURES, truthfulFeatures, truthfulMetadata } from './profile-truth';
import { coffeeOnlySql, fold, foldSql } from './coffee-eligibility';
import { countryFilterAliases } from './country-labels';
import type { CatalogDatabase, SqlValue } from './database';
import { canonicalizeUrl, unitPriceTry } from './identity';
import type { CoffeeEvent, FeatureValue, Json, PriceObservation, RawMetadata } from './types';

export interface CatalogOffer {
  id: string; coffeeId: string; sourceVariantId: string | null; label: string | null;
  weightG: number | null; currency: string | null; priceMinor: number | null; compareAtMinor: number | null;
  inStock: boolean | null; purchaseUrl: string | null; unitPriceTry: number | null;
  firstSeenAt: string; lastSeenAt: string; lastPriceChangeAt: string | null;
  /** Grind/roast variants with the same weight, price and stock collapse into one package; their ids stay here for event lookup. */
  variantOfferIds: string[];
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
export interface CoffeeRow {
  id:string;roaster_id:string;source_product_id:string|null;canonical_url:string;name:string;slug:string;raw_metadata_json:string;
  first_seen_at:string;last_seen_at:string;discontinued_at:string|null;
  roaster_slug:string;roaster_name:string;website_url:string;city:string|null;trusted_hosts_json:string;
}
interface OfferRow {id:string;coffee_id:string;source_variant_id:string|null;label:string|null;weight_g:number|null;currency:string|null;current_price_minor:number|null;compare_at_price_minor:number|null;in_stock:number|null;purchase_url:string;first_seen_at:string;last_seen_at:string;last_price_change_at:string|null}
interface FeatureRow {coffee_id:string;feature:string;value_json:string;source_type:FeatureValue['sourceType'];confidence:number|null;version:string;source_reference:string|null}
interface EventRow {id:string;coffee_id:string;offer_id:string|null;type:CoffeeEvent['type'];created_at:string;before_json:string;after_json:string;idempotency_key:string;observation_id:string|null}
export const COFFEE_COLUMNS='c.*,r.slug AS roaster_slug,r.name AS roaster_name,r.website_url,r.city,r.trusted_hosts_json';
const EVENT_TYPES=new Set(['NEW','PRICE_DROP','RESTOCKED','DEAL','OUT_OF_STOCK']);
// One package = coffee + weight + price + currency. Grind options at the same price are not separate packages.
const PACKAGE_KEY="o.coffee_id||'|'||coalesce(o.weight_g,'')||'|'||coalesce(o.current_price_minor,'')||'|'||coalesce(o.currency,'')";
// Every offer read here is a current_offers row (migration 0007): unretired and validated within 7 days of its roaster's last success.
// A listed coffee shows its own offers plus those of current size twins that point at it (migration 0006).
const GROUP_OFFERS='JOIN coffee_group_members g ON g.group_id=c.id JOIN current_offers o ON o.coffee_id=g.coffee_id';
const IN_GROUP='IN (SELECT g.coffee_id FROM coffee_group_members g WHERE g.group_id=c.id)';
// The package a card shows (in stock, closest to 250 g, then cheapest) is the one price sort and price filters use.
const PREFERRED_PRICE=`(SELECT o.current_price_minor FROM current_offers o WHERE o.coffee_id ${IN_GROUP} AND o.in_stock=1 AND o.currency='TRY' AND o.current_price_minor IS NOT NULL ORDER BY o.weight_g IS NULL,abs(coalesce(o.weight_g,250)-250),o.current_price_minor,o.id LIMIT 1)`;
// Common spelling pairs in roaster copy; a search for one finds the other.
const SEARCH_SYNONYMS=[['geisha','gesha'],['etiyopya','ethiopia'],['kolombiya','colombia'],['brezilya','brazil'],['kenya','kenia'],['natural','dogal'],['washed','yikanmis']];
const placeholders=(length:number)=>Array.from({length},()=>'?').join(',');
function parseJson<T>(value:string,fallback:T):T { try{return JSON.parse(value) as T;}catch{return fallback;} }
/** A result that is the same for every visitor until the next refresh goes through the database's derived cache when it has one
 * (shared/v2/read-cache.ts); tests and scripts read live. Only for results that do not depend on the clock or the visitor. */
function derived<T>(db:CatalogDatabase,name:string,compute:()=>Promise<T>):Promise<T>{return db.derive?db.derive(name,compute):compute();}
function eventFromRow(row:EventRow):CoffeeEvent { return {id:row.id,coffeeId:row.coffee_id,offerId:row.offer_id,type:row.type,createdAt:row.created_at,before:parseJson<Json>(row.before_json,null),after:parseJson<Json>(row.after_json,null),idempotencyKey:row.idempotency_key,observationId:row.observation_id}; }

export async function getCatalogCounts(db:CatalogDatabase):Promise<{coffees:number;roasters:number;offers:number}> {
  return derived(db,'counts',async()=>{
  const counts=await db.prepare(`SELECT count(DISTINCT c.id) AS coffees,count(DISTINCT c.roaster_id) AS roasters,count(DISTINCT ${PACKAGE_KEY}) AS offers FROM public_catalog_coffees c ${GROUP_OFFERS} AND o.in_stock=1 WHERE ${coffeeOnlySql()}`).first<{coffees:number;roasters:number;offers:number}>();
  return counts??{coffees:0,roasters:0,offers:0};
  });
}

/** Every current-list count and row query starts from the same canonical view. */
export async function listCatalog(db:CatalogDatabase,filters:CatalogFilters={},now=Date.now()):Promise<{coffees:CatalogCoffee[];total:number;page:number;perPage:number;totalPages:number}> {
  const {where,values}=buildFilters(filters);
  const page=Number.isFinite(filters.page)?Math.max(1,Math.floor(filters.page!)):1;
  const perPage=Number.isFinite(filters.perPage)?Math.min(100,Math.max(1,Math.floor(filters.perPage!))):24;
  const from='FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id';
  const sorts:Record<string,string>={
    // Genuine arrivals first, newest first; coffees whose arrival is unknown follow in the order they entered the catalog.
    newest:'a.arrived_at DESC NULLS LAST,c.first_seen_at DESC,c.id',
    price_asc:`${PREFERRED_PRICE} ASC NULLS LAST,c.id`,
    price_desc:`${PREFERRED_PRICE} DESC NULLS LAST,c.id`,
    unit_price_asc:`(SELECT min(1.0*o.current_price_minor/o.weight_g) FROM current_offers o WHERE o.coffee_id ${IN_GROUP} AND o.in_stock=1 AND o.currency='TRY' AND o.weight_g>0) ASC NULLS LAST,c.id`,
  };
  // One pass: the total rides on each row (the ORDER BY already visits every match), instead of a second scan to count.
  const order=sorts[filters.sort??'newest']??sorts.newest;
  // Arrival times only matter to the newest sort (about 3,000 rows); price sorts skip them.
  const rows=(await db.prepare(`SELECT ${COFFEE_COLUMNS},count(*) OVER() AS total_count ${from} ${order===sorts.newest?ARRIVALS_JOIN:''} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values,perPage,(page-1)*perPage).all<CoffeeRow&{total_count:number}>()).results;
  // Only a page past the end comes back empty while matches exist; then the count is asked for separately.
  const total=rows.length?rows[0].total_count:page>1?(await db.prepare(`SELECT count(*) AS count ${from} WHERE ${where}`).bind(...values).first<{count:number}>())?.count??0:0;
  return {coffees:await hydrate(db,rows,now),total,page,perPage,totalPages:Math.ceil(total/perPage)};
}

/** The unfiltered newest listing is kept as a last-good copy, one entry per page (src/lib/v2-runtime.ts, catalogLastGood);
 * any filter, search or other sort has none. The name is that entry's, or null. */
export function lastGoodListingName(filters:CatalogFilters):string|null{
  const lists=[filters.origin,filters.process,filters.taste,filters.roaster,filters.roast,filters.brewMethod];
  const texts=[filters.search,filters.farm,filters.producer,filters.variety,filters.altitude];
  if(lists.some(list=>list?.length)||texts.some(text=>text?.trim())||filters.priceMin!==undefined||filters.priceMax!==undefined||filters.traceability||filters.event||(filters.sort&&filters.sort!=='newest'))return null;
  const page=Number.isFinite(filters.page)?Math.max(1,Math.floor(filters.page!)):1;
  const perPage=Number.isFinite(filters.perPage)?Math.min(100,Math.max(1,Math.floor(filters.perPage!))):24;
  return `listing:newest:${perPage}:${page}`;
}

export async function countCatalog(db:CatalogDatabase,filters:CatalogFilters):Promise<number> {
  const {where,values}=buildFilters(filters);
  return (await db.prepare(`SELECT count(*) AS count FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${where}`).bind(...values).first<{count:number}>())?.count??0;
}

/** Listed coffees and their roasters for one filter, counted with the catalog's own filter rules (origin and process landing pages). */
export async function catalogFacts(db:CatalogDatabase,filters:CatalogFilters):Promise<{coffees:number;roasters:number}> {
  return (await catalogFactsMany(db,[filters]))[0];
}
/** catalogFacts for several filters in one pass over the listed coffees per query, not one pass per filter.
 * Callers pass a bounded set (the landing pages), since each distinct set is one derived-cache entry. */
export async function catalogFactsMany(db:CatalogDatabase,list:CatalogFilters[]):Promise<Array<{coffees:number;roasters:number}>> {
  return derived(db,`facts:${JSON.stringify(list)}`,async()=>{
    const built=list.map(filters=>buildFilters(filters));
    const facts:Array<{coffees:number;roasters:number}>=[];
    for(let start=0;start<built.length;){
      // D1 binds at most 100 parameters per statement.
      let end=start+1,bound=built[start].values.length;
      while(end<built.length&&bound+built[end].values.length<=100)bound+=built[end++].values.length;
      const chunk=built.slice(start,end);
      // Each filter is evaluated once per coffee (MATERIALIZED), then counted like catalogFacts' own count(*) and count(DISTINCT roaster).
      const row=await db.prepare(`WITH m AS MATERIALIZED (SELECT c.roaster_id${chunk.map((item,index)=>`,(${item.conditions.slice(1).join(' AND ')||'1'}) AS m${index}`).join('')}
        FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()})
        SELECT ${chunk.map((_,index)=>`count(CASE WHEN m${index} THEN 1 END) AS c${index},count(DISTINCT CASE WHEN m${index} THEN roaster_id END) AS r${index}`).join(',')} FROM m`)
        .bind(...chunk.flatMap(item=>item.values)).first<Record<string,number>>();
      chunk.forEach((_,index)=>facts.push({coffees:row?.[`c${index}`]??0,roasters:row?.[`r${index}`]??0}));
      start=end;
    }
    return facts;
  });
}

export const CHANGE_EVENTS=['NEW','PRICE_DROP','RESTOCKED'] as const;
export type ChangeDay={day:string}&Record<typeof CHANGE_EVENTS[number],number>;
const ISTANBUL_MS=3*3600000;
/** Same for every visitor: per Istanbul calendar day (oldest first, 30 days ending today), the listed coffees whose latest NEW, PRICE_DROP or RESTOCKED event fell on that day.
 * A coffee counts once per type, in the bucket of its latest event, so summing the days since a date equals the old "has an event since" count. */
export async function catalogChangesByDay(db:CatalogDatabase,now=Date.now()):Promise<ChangeDay[]> {
  const days=Array.from({length:30},(_,i)=>({day:new Date(now+ISTANBUL_MS-(29-i)*86400000).toISOString().slice(0,10),NEW:0,PRICE_DROP:0,RESTOCKED:0}));
  const from=new Date(Date.parse(`${days[0].day}T00:00:00Z`)-ISTANBUL_MS).toISOString();
  const perType=CHANGE_EVENTS.map(type=>`(e.type='${type}'${eventValidity(type)})`).join(' OR ');
  // Valid events first (a few per day), then the groups they belong to: pairing every listed coffee with every valid event read 148,000 rows.
  const rows=await db.prepare(`WITH valid AS MATERIALIZED (SELECT e.coffee_id,e.type,e.created_at FROM coffee_events e WHERE e.created_at>=? AND (${perType}))
    SELECT day,type,count(*) AS count FROM (SELECT date(max(e.created_at),'+3 hours') AS day,e.type AS type FROM valid e CROSS JOIN coffee_group_members g ON g.coffee_id=e.coffee_id JOIN public_catalog_coffees c ON c.id=g.group_id JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} GROUP BY c.id,e.type) GROUP BY day,type`).bind(from).all<{day:string;type:typeof CHANGE_EVENTS[number];count:number}>();
  for(const row of rows.results)days.find(d=>d.day===row.day)![row.type]=row.count;
  return days;
}

/** One listed coffee per Istanbul calendar day, the same for everyone, chosen among coffees with tasting notes and an image.
 * Candidates are dealt round-robin by roaster, so consecutive days land on different roasters while the list is stable.
 * ponytail: a catalog that changes size overnight can shift the slot and repeat a roaster; store yesterday's pick if that matters. */
export async function getCoffeeOfTheDay(db:CatalogDatabase,now=Date.now()):Promise<CatalogCoffee|null> {
  const order=await derived(db,'day-order',async()=>{
    const candidates=await db.prepare(`SELECT c.id,c.roaster_id FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} AND json_array_length(c.raw_metadata_json,'$.tastingNotes')>0 AND json_extract(c.raw_metadata_json,'$.imageUrl') LIKE 'http%' ORDER BY c.roaster_id,c.id`).all<{id:string;roaster_id:string}>();
    const byRoaster=new Map<string,string[]>();
    for(const row of candidates.results)byRoaster.set(row.roaster_id,[...(byRoaster.get(row.roaster_id)??[]),row.id]);
    const queues=[...byRoaster.values()];const order:string[]=[];
    for(let round=0;order.length<candidates.results.length;round++)for(const queue of queues)if(queue[round])order.push(queue[round]);
    return order;
  });
  const day=Math.floor((now+3*3600000)/86400000);
  // Read repair can still empty a listing's notes; the next slot stands in.
  for(let step=0;step<Math.min(order.length,5);step++){
    const row=await db.prepare(`SELECT ${COFFEE_COLUMNS} FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.id=?`).bind(order[(day+step)%order.length]).first<CoffeeRow>();
    const [coffee]=await hydrate(db,row?[row]:[],now);
    if(coffee?.rawMetadata.tastingNotes?.length&&/^https?:\/\//.test(coffee.rawMetadata.imageUrl??''))return coffee;
  }
  return null;
}

export const SAVED_SLUG=/^[a-z0-9_-]{1,240}$/i;
export const SAVED_LIMIT=50;
/** Current state of saved coffees, including sold-out ones. A twin's slug resolves to its group's parent. A deactivated roaster's coffees are left out (they read as gone). */
export async function getSavedCoffees(db:CatalogDatabase,slugs:string[],now=Date.now()):Promise<Array<{savedSlug:string;availability:'listed'|'sold_out'|'gone';coffee:CatalogCoffee}>> {
  const wanted=[...new Set(slugs.filter(slug=>SAVED_SLUG.test(slug)))].slice(0,SAVED_LIMIT);
  if(!wanted.length)return [];
  const rows=await db.prepare(`SELECT ${COFFEE_COLUMNS},x.slug AS saved_slug,EXISTS(SELECT 1 FROM public_catalog_coffees p WHERE p.id=c.id) AS listed FROM coffees x JOIN coffees c ON c.id=coalesce(x.canonical_coffee_id,x.id) JOIN roasters r ON r.id=c.roaster_id WHERE x.slug IN (${placeholders(wanted.length)}) AND r.active=1 AND c.visibility='public' AND ${coffeeOnlySql()}`).bind(...wanted).all<CoffeeRow&{saved_slug:string;listed:number}>();
  const coffees=await hydrate(db,rows.results,now);
  return coffees.map((coffee,index)=>({savedSlug:rows.results[index].saved_slug,coffee,
    availability:rows.results[index].listed?'listed':!coffee.discontinuedAt&&coffee.offers.some(offer=>offer.inStock===false)?'sold_out':'gone'}));
}

/** Origin filter options follow the filter rule: a MANUAL origin replaces raw and inferred origins for its coffee. */
export async function listOrigins(db:CatalogDatabase):Promise<string[]> {
  return derived(db,'origins',async()=>{
  const features=FACT_FEATURES.country.map(feature=>`'${feature}'`).join(',');
  const manual=`EXISTS(SELECT 1 FROM coffee_feature_values m WHERE m.coffee_id=c.id AND m.source_type='MANUAL' AND m.feature IN (${features}))`;
  const rows=await db.prepare(`SELECT DISTINCT value FROM (SELECT json_extract(c.raw_metadata_json,'$.country') AS value FROM public_catalog_coffees c WHERE NOT ${manual} UNION ALL SELECT j.value FROM coffee_feature_values f JOIN public_catalog_coffees c ON c.id=f.coffee_id JOIN json_each(f.value_json) j WHERE f.feature IN (${features}) AND j.type='text' AND (f.source_type='MANUAL' OR NOT ${manual})) WHERE value IS NOT NULL AND value<>'unknown' ORDER BY value`).all<{value:string}>();
  return rows.results.map(row=>row.value);
  });
}

/** The one definition of "new" (alias e = a NEW event): the roaster started selling this coffee between two crawls we can date.
 * A NEW event is emitted only by a live crawl (imports and a roaster's first baseline emit none). It counts when:
 * - the roaster's previous successful crawl ran at most 7 days earlier;
 * - the shop's own date agrees: a Shopify published_at after that previous crawl confirms it, one before it means we
 *   missed the product then. Without a shop date, both crawls must use the same parser version (after a parser or
 *   discovery change, a first sighting can be an old product the old parser missed, so it proves nothing);
 * - no older coffee of the roaster is the same coffee under another identity: same group, same name, or the same name
 *   plus a size ("Koyu" / "Koyu 2.5KG"), which covers a re-identified product, a regrouped size and a re-listing.
 * Rows are never rewritten; past artefact events stay stored and simply fail this rule.
 * ponytail: the name match is a folded-string heuristic (a renamed product reads as new); store a name key if that bites. */
// "a" is "b" plus a size: separators, then a digit ("koyu 2.5kg", "guji (250g)", "guji - 1 kg"). No GLOB on the
// name itself: D1 refuses LIKE/GLOB patterns longer than 50 bytes ("pattern too complex").
const sizeTwin=(a:string,b:string)=>{const rest=`substr(${a},length(${b})+1)`,trimmed=`ltrim(${rest},' -–—(/|,.:')`;
  return `(length(${a})>length(${b}) AND substr(${a},1,length(${b}))=${b} AND ${trimmed}<>${rest} AND ${trimmed} GLOB '[0-9]*')`;};
const GENUINE_NEW=`EXISTS(SELECT 1 FROM coffees x JOIN crawl_runs r ON r.id=json_extract(e.after_json,'$.firstObservationRunId') AND r.roaster_id=x.roaster_id
    JOIN crawl_runs p ON p.id=(SELECT q.id FROM crawl_runs q WHERE q.roaster_id=r.roaster_id AND q.status='success' AND q.mode<>'import' AND q.started_at<r.started_at ORDER BY q.started_at DESC LIMIT 1)
    WHERE x.id=e.coffee_id AND julianday(r.started_at)-julianday(p.started_at)<=7
    AND coalesce(julianday(json_extract(x.raw_metadata_json,'$.sourceData.published_at'))>=julianday(p.started_at),p.parser_version=r.parser_version)
    AND NOT EXISTS(SELECT 1 FROM (SELECT s.id,s.canonical_coffee_id,${foldSql('s.name')} AS sn,${foldSql('x.name')} AS xn FROM coffees s
      WHERE s.roaster_id=x.roaster_id AND s.id<>x.id AND julianday(s.first_seen_at)<julianday(r.started_at)) s
      WHERE s.id=x.canonical_coffee_id OR s.canonical_coffee_id=x.id OR s.canonical_coffee_id=x.canonical_coffee_id OR s.sn=s.xn OR ${sizeTwin('s.xn','s.sn')} OR ${sizeTwin('s.sn','s.xn')}))`;
/** When the listed coffee (alias c) genuinely arrived, or NULL when that is unknown. */
/** Each listed coffee's genuine arrival time (a.arrived_at), NULL when unknown. Not correlated: computed once per query. */
const ARRIVALS_JOIN=`LEFT JOIN (SELECT g.group_id,max(e.created_at) AS arrived_at FROM coffee_events e JOIN coffee_group_members g ON g.coffee_id=e.coffee_id WHERE e.type='NEW' AND ${GENUINE_NEW} GROUP BY g.group_id) a ON a.group_id=c.id`;

/** Extra rule an event must meet to still count, as " AND ..." SQL (alias e = the event). */
function eventValidity(type:string):string {
  if(type==='NEW')return ` AND ${GENUINE_NEW}`;
  // A deal/drop badge is valid only while its triggering observation still matches the current offer price.
  if(type==='DEAL'||type==='PRICE_DROP')return " AND EXISTS(SELECT 1 FROM current_offers o JOIN price_observations p ON p.id=e.observation_id WHERE o.id=e.offer_id AND o.in_stock=1 AND o.current_price_minor=p.price_minor AND o.currency=p.currency AND o.weight_g=p.weight_g)";
  // Another available SKU cannot keep a sold-out/retired package in the restock feed.
  if(type==='RESTOCKED')return " AND EXISTS(SELECT 1 FROM current_offers o WHERE o.id=e.offer_id AND o.coffee_id=e.coffee_id AND o.in_stock=1)";
  return '';
}

function buildFilters(filters:CatalogFilters):{where:string;values:SqlValue[];conditions:string[]} {
  const conditions=[coffeeOnlySql()];const values:SqlValue[]=[];
  // Querying declared and inferred fields together is useful; their display/provenance remains separate.
  const metadata=(field:string,accepted?:string[],expand?:(input:string[])=>string[])=>{
    const selected=accepted?.map(value=>value.trim()).filter(Boolean).slice(0,20);
    if(!selected?.length)return;
    const input=JSON.stringify(expand?expand(selected):selected);
    // JSON arrays bound as values keep alias expansion and combined filters below D1's parameter limit.
    const matches="IN (SELECT value FROM json_each(?))";
    // Feature names are code constants, not input. A reviewed MANUAL row decides alone: raw and inferred values it contradicts never match.
    const features=FACT_FEATURES[field].map(feature=>`'${feature}'`).join(',');
    const manual=`EXISTS(SELECT 1 FROM coffee_feature_values m WHERE m.coffee_id=c.id AND m.source_type='MANUAL' AND m.feature IN (${features}))`;
    conditions.push(`(NOT ${manual} AND (json_extract(c.raw_metadata_json,?) ${matches} OR EXISTS(SELECT 1 FROM json_each(c.raw_metadata_json,?) j WHERE j.value ${matches})) OR EXISTS(SELECT 1 FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${features}) AND (f.source_type='MANUAL' OR NOT ${manual}) AND (json_extract(f.value_json,'$') ${matches} OR EXISTS(SELECT 1 FROM json_each(f.value_json) j WHERE j.value ${matches}))))`);
    values.push(`$.${field}`,input,`$.${field}`,input,input,input);
  };
  metadata('country',filters.origin,countryFilterAliases);
  metadata('process',filters.process);
  metadata('roast',filters.roast);
  metadata('tastingNotes',filters.taste);
  metadata('brewMethods',filters.brewMethod);
  if(filters.roaster?.length){const input=filters.roaster.slice(0,20);conditions.push(`r.slug IN (${placeholders(input.length)})`);values.push(...input);}
  if(filters.search?.trim()){
    // SQLite only folds ASCII case, so both sides are folded (İ/ı/ş/ğ/ü/ö/ç) before matching.
    const term=fold(filters.search.trim().slice(0,100));
    const terms=[...new Set([term,...SEARCH_SYNONYMS.flatMap(pair=>pair.flatMap(word=>term.includes(word)?pair.map(other=>term.replaceAll(word,other)):[]))])].slice(0,4);
    const fields=[foldSql('c.name'),foldSql('r.name'),foldSql("coalesce(json_extract(c.raw_metadata_json,'$.description'),'')")];
    // instr, not LIKE: D1 refuses LIKE patterns over 50 bytes, which broke every search of about 48 characters or more.
    // Both sides are already folded, and instr treats % and _ literally, so nothing needs escaping.
    conditions.push(`(${terms.flatMap(()=>fields.map(field=>`instr(${field},?)>0`)).join(' OR ')})`);
    values.push(...terms.flatMap(value=>fields.map(()=>value)));
  }
  for(const [filter,field] of [['farm','farm'],['producer','producer'],['variety','varieties']] as const){
    const input=filters[filter];
    if(input?.trim())metadata(field,[input.trim()]);
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
    if(Number.isFinite(filters.priceMin)){conditions.push(`${PREFERRED_PRICE}>=?`);values.push(Math.round(Math.max(0,filters.priceMin!)*100));}
    if(Number.isFinite(filters.priceMax)){conditions.push(`${PREFERRED_PRICE}<=?`);values.push(Math.round(Math.max(0,filters.priceMax!)*100));}
  }
  if(filters.event&&EVENT_TYPES.has(filters.event)){
    const eventConditions=['e.type=?'];values.push(filters.event);
    if(filters.since&&Number.isFinite(Date.parse(filters.since))){eventConditions.push('e.created_at>=?');values.push(new Date(filters.since).toISOString());}
    const validity=eventValidity(filters.event);if(validity)eventConditions.push(validity.slice(5));
    // Not correlated with c: the few valid events are found once, not checked again for every listed coffee.
    conditions.push(`c.id IN (SELECT g.group_id FROM coffee_events e JOIN coffee_group_members g ON g.coffee_id=e.coffee_id WHERE ${eventConditions.join(' AND ')})`);
  }
  return {where:conditions.join(' AND '),values,conditions};
}

/** Details are durable even after stock loss/discontinuation; hidden/unclassified coffees stay private. */
export async function getCoffeeDetail(db:CatalogDatabase,slugOrId:string,now=Date.now()):Promise<(CatalogCoffee&{priceHistory:PriceObservation[]})|null> {
  const row=await db.prepare(`SELECT ${COFFEE_COLUMNS} FROM coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.visibility='public' AND ${coffeeOnlySql()} AND c.id IN (SELECT coalesce(x.canonical_coffee_id,x.id) FROM coffees x WHERE x.id IN (SELECT id FROM coffees WHERE slug=? UNION SELECT id FROM coffees WHERE id=? UNION SELECT coffee_id FROM coffee_aliases WHERE alias_type='slug' AND alias=?)) LIMIT 1`).bind(slugOrId,slugOrId,slugOrId).first<CoffeeRow>();
  if(!row)return null;
  const [coffee]=await hydrate(db,[row],now);
  const history=await db.prepare(`SELECT p.* FROM price_observations p JOIN offers o ON o.id=p.offer_id JOIN coffee_group_members g ON g.coffee_id=o.coffee_id WHERE g.group_id=? ORDER BY p.observed_at DESC,p.id DESC LIMIT 200`).bind(row.id).all<{id:string;offer_id:string;crawl_run_id:string;observed_at:string;price_minor:number|null;compare_at_minor:number|null;weight_g:number|null;currency:string|null;in_stock:number|null;source:'crawl'|'import'}>();
  return {...coffee,priceHistory:history.results.map(p=>({id:p.id,offerId:p.offer_id,crawlRunId:p.crawl_run_id,observedAt:p.observed_at,priceMinor:p.price_minor,compareAtMinor:p.compare_at_minor,weightG:p.weight_g,currency:p.currency,inStock:p.in_stock===null?null:p.in_stock===1,source:p.source}))};
}

function trustedSourceUrl(row:CoffeeRow):string|null {
  const hosts=parseJson<string[]>(row.trusted_hosts_json,[]);
  if(!hosts.length)return null;
  try{return canonicalizeUrl(row.canonical_url,hosts);}catch{return null;}
}

export async function hydrate(db:CatalogDatabase,rows:CoffeeRow[],now:number):Promise<CatalogCoffee[]> {
  if(!rows.length)return [];
  const ids=rows.map(row=>row.id);const list=placeholders(ids.length);
  const [offers,features,events]=await Promise.all([
    db.prepare(`SELECT o.*,g.group_id FROM coffee_group_members g JOIN current_offers o ON o.coffee_id=g.coffee_id WHERE g.group_id IN (${list}) ORDER BY o.in_stock DESC NULLS LAST,o.current_price_minor ASC NULLS LAST,o.id`).bind(...ids).all<OfferRow&{group_id:string}>(),
    db.prepare(`SELECT * FROM coffee_feature_values WHERE coffee_id IN (${list}) ORDER BY feature,source_type`).bind(...ids).all<FeatureRow>(),
    db.prepare(`SELECT * FROM (SELECT e.*,g.group_id,row_number() OVER(PARTITION BY g.group_id,e.type ORDER BY e.created_at DESC,e.id DESC) AS position FROM coffee_group_members g JOIN coffee_events e ON e.coffee_id=g.coffee_id WHERE g.group_id IN (${list}) AND (e.type<>'NEW' OR ${GENUINE_NEW})) WHERE position=1 ORDER BY created_at DESC`).bind(...ids).all<EventRow&{group_id:string}>(),
  ]);
  return rows.map(row=>{
    // A group shows its members' sizes, so a size left in the parent's name would describe only one of them.
    const grouped=offers.results.some(o=>o.group_id===row.id&&o.coffee_id!==row.id);
    const own=features.results.filter(f=>f.coffee_id===row.id).map(f=>({feature:f.feature,value:parseJson<Json>(f.value_json,null),sourceType:f.source_type,confidence:f.confidence,version:f.version,sourceReference:f.source_reference}));
    return {id:row.id,name:grouped?withoutTrailingSize(cleanCoffeeName(row.name)):cleanCoffeeName(row.name),slug:row.slug,canonicalUrl:row.canonical_url,sourceUrl:trustedSourceUrl(row),sourceProductId:row.source_product_id,
    roaster:{id:row.roaster_id,slug:row.roaster_slug,name:row.roaster_name,websiteUrl:row.website_url,city:row.city},
    rawMetadata:truthfulMetadata(parseJson<RawMetadata>(row.raw_metadata_json,{}),row.name,own),
    features:truthfulFeatures(own,parseJson<RawMetadata>(row.raw_metadata_json,{})),
    offers:collapsePackages(offers.results.filter(o=>o.group_id===row.id).map(o=>{
      let purchaseUrl:string|null=null;
      try{const hosts=parseJson<string[]>(row.trusted_hosts_json,[]);if(hosts.length)purchaseUrl=canonicalizeUrl(o.purchase_url,hosts);}catch{/* Invalid imported URL has no purchase action. */}
      return {id:o.id,coffeeId:o.coffee_id,sourceVariantId:o.source_variant_id,label:o.label,weightG:o.weight_g,currency:o.currency,priceMinor:o.current_price_minor,compareAtMinor:o.compare_at_price_minor,
        inStock:o.in_stock===null?null:o.in_stock===1,purchaseUrl,unitPriceTry:unitPriceTry(o.current_price_minor,o.weight_g,o.currency),firstSeenAt:o.first_seen_at,lastSeenAt:o.last_seen_at,lastPriceChangeAt:o.last_price_change_at,variantOfferIds:[o.id]};
    })),
    latestEvents:events.results.filter(e=>e.group_id===row.id).map(eventFromRow),
    firstSeenAt:row.first_seen_at,lastSeenAt:row.last_seen_at,discontinuedAt:row.discontinued_at,stale:now-Date.parse(row.last_seen_at)>3*86400000,
  };});
}

/** "Koyu 2.5KG" → "Koyu"; a name that is only a size stays as it is. */
export function withoutTrailingSize(name:string):string{return name.replace(/[\s,/|(–—-]*\d+(?:[.,]\d+)?\s*(?:kg|kilo|gr|gram|g)\b\.?\)?$/iu,'').trim()||name;}

/** Rows arrive in display order (in stock, cheapest first); the first variant of each package keeps its purchase link. */
function collapsePackages(offers:CatalogOffer[]):CatalogOffer[] {
  const packages=new Map<string,CatalogOffer>();
  for(const offer of offers){
    const key=[offer.weightG,offer.priceMinor,offer.currency,offer.inStock].join('|');
    const existing=packages.get(key);
    if(!existing){packages.set(key,offer);continue;}
    // The variant label (grind/roast option) no longer describes the merged package; the weight does.
    packages.set(key,{...existing,label:null,variantOfferIds:[...existing.variantOfferIds,offer.id]});
  }
  return [...packages.values()];
}

export async function listRoasters(db:CatalogDatabase):Promise<CatalogRoaster[]> {
  return derived(db,'roasters',async()=>{
  const rows=await db.prepare(`SELECT r.*,count(DISTINCT c.id) AS coffee_count,count(DISTINCT ${PACKAGE_KEY}) AS offer_count FROM roasters r JOIN public_catalog_coffees c ON c.roaster_id=r.id ${GROUP_OFFERS} AND o.in_stock=1 WHERE ${coffeeOnlySql()} GROUP BY r.id ORDER BY r.name,r.id`)
    .all<{id:string;slug:string;name:string;website_url:string;city:string|null;adapter:string;coffee_count:number;offer_count:number;last_attempt_at:string|null;last_success_at:string|null;crawl_health:string}>();
  return rows.results.map(r=>({id:r.id,slug:r.slug,name:r.name,websiteUrl:r.website_url,city:r.city,adapter:r.adapter,coffeeCount:r.coffee_count,offerCount:r.offer_count,lastAttemptAt:r.last_attempt_at,lastSuccessAt:r.last_success_at,crawlHealth:r.crawl_health}));
  });
}
export async function getRoasterDetail(db:CatalogDatabase,slug:string):Promise<{roaster:CatalogRoaster;catalog:Awaited<ReturnType<typeof listCatalog>>}|null> {
  const row=await db.prepare('SELECT id,slug,name,website_url,city,adapter,last_attempt_at,last_success_at,crawl_health FROM roasters WHERE slug=?').bind(slug)
    .first<{id:string;slug:string;name:string;website_url:string;city:string|null;adapter:string;last_attempt_at:string|null;last_success_at:string|null;crawl_health:string}>();
  if(!row)return null;
  const catalog=await listCatalog(db,{roaster:[slug]});
  const offerCount=await db.prepare(`SELECT count(DISTINCT ${PACKAGE_KEY}) AS count FROM public_catalog_coffees c ${GROUP_OFFERS} WHERE c.roaster_id=? AND o.in_stock=1 AND ${coffeeOnlySql()}`).bind(row.id).first<{count:number}>();
  return {roaster:{id:row.id,slug:row.slug,name:row.name,websiteUrl:row.website_url,city:row.city,adapter:row.adapter,coffeeCount:catalog.total,offerCount:offerCount?.count??0,lastAttemptAt:row.last_attempt_at,lastSuccessAt:row.last_success_at,crawlHealth:row.crawl_health},catalog};
}

export async function listEvents(db:CatalogDatabase,type?:CoffeeEvent['type'],limit=30):Promise<CoffeeEvent[]> {
  const accepted=type&&EVENT_TYPES.has(type)?type:null;
  const values:SqlValue[]=accepted?[accepted]:[];
  values.push(Math.min(100,Math.max(1,Number.isFinite(limit)?Math.floor(limit):30)));
  const rows=await db.prepare(`SELECT e.* FROM coffee_events e JOIN coffees c ON c.id=e.coffee_id WHERE c.visibility='public' AND ${coffeeOnlySql()} AND (e.type<>'NEW' OR ${GENUINE_NEW}) ${accepted?'AND e.type=?':''} ORDER BY e.created_at DESC,e.id DESC LIMIT ?`).bind(...values).all<EventRow>();
  return rows.results.map(eventFromRow);
}

const SIMILARITY_FEATURES=[...FACT_FEATURES.country,...FACT_FEATURES.process,...FACT_FEATURES.tastingNotes].map(feature=>`'${feature}'`).join(',');
/** What similarity reads of a candidate, already resolved: the three fact lists (after the MANUAL rule) and the name, lower-cased.
 * Stored once per refresh as a derived result, so it is kept small: about 290 bytes a coffee, 1.45 MB at the 5,000 cap. */
export type SimilarityCandidate={id:string;roasterId:string;name:string;url:string;firstSeenAt:string;origin:string[];process:string[];flavor:string[]};
const lowerTr=(values:string[])=>[...new Set(values.map(value=>value.toLocaleLowerCase('tr-TR')))];
/** Every listed coffee's origin, process and flavor facts (after the MANUAL rule), newest first. The same for every coffee
 * page, so it is read once per refresh (derived cache), not per view; comparison pages pick their coffees from it too.
 * ponytail: cap at the same 5,000 newest candidates; move ranking into indexed SQL if the catalog outgrows it. */
export function similarityCandidates(db:CatalogDatabase):Promise<SimilarityCandidate[]> {
  return derived(db,'similar-candidates',async()=>(await db.prepare(`SELECT ${COFFEE_COLUMNS},(SELECT json_group_array(json_object('feature',f.feature,'value',json(f.value_json),'sourceType',f.source_type)) FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${SIMILARITY_FEATURES})) AS similarity_features_json FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} ORDER BY c.first_seen_at DESC,c.id LIMIT 5000`).all<CoffeeRow&{similarity_features_json:string}>()).results.map((row):SimilarityCandidate=>{
    const raw=parseJson<RawMetadata>(row.raw_metadata_json,{});
    const all=parseJson<Array<Pick<FeatureValue,'feature'|'value'|'sourceType'>>>(row.similarity_features_json,[]);
    // Same rule as the filters: a MANUAL fact replaces raw and inferred values of its kind.
    const facts=(field:string,declared:string|null|undefined,...names:string[])=>{
      const manual=all.filter(f=>f.sourceType==='MANUAL'&&FACT_FEATURES[field].includes(f.feature));
      return lowerTr(manual.length?featureStrings({features:manual},...names):featureStrings({features:all},...names).concat(declared??[]));
    };
    return {id:row.id,roasterId:row.roaster_id,name:row.name.toLocaleLowerCase('tr-TR'),url:row.canonical_url,firstSeenAt:row.first_seen_at,
      origin:facts('country',raw.country,'normalized_origin','origin_country'),process:facts('process',raw.process,'process_family','process'),flavor:facts('tastingNotes',null,'flavor_families','flavor_categories')};
  }));
}
/** Explainable catalog similarity, never a personalized numerical match. */
export async function getSimilarCoffees(db:CatalogDatabase,coffee:CatalogCoffee,limit=4):Promise<Array<CatalogCoffee&{similarityReasons:string[]}>> {
  const candidates=await similarityCandidates(db);
  const origin=lowerTr(featureStrings(coffee,'normalized_origin','origin_country').concat(coffee.rawMetadata.country??[]));
  const process=lowerTr(featureStrings(coffee,'process_family','process').concat(coffee.rawMetadata.process??[]));
  const flavor=lowerTr(featureStrings(coffee,'flavor_families','flavor_categories'));
  const name=coffee.name.toLocaleLowerCase('tr-TR');
  const overlaps=(left:string[],right:string[])=>left.some(value=>right.includes(value));
  const selected=candidates.filter(c=>c.id!==coffee.id&&c.url!==coffee.canonicalUrl&&!(c.roasterId===coffee.roaster.id&&c.name===name))
    .map(row=>{
      const reasons:string[]=[];
      if(overlaps(origin,row.origin))reasons.push('Aynı kökenden');
      if(overlaps(process,row.process))reasons.push('Benzer işleme yöntemi');
      if(overlaps(flavor,row.flavor))reasons.push('Benzer tat profili');
      return {row,similarityReasons:reasons};
    }).filter(c=>c.similarityReasons.length>0).sort((a,b)=>b.similarityReasons.length-a.similarityReasons.length||b.row.firstSeenAt.localeCompare(a.row.firstSeenAt)||a.row.id.localeCompare(b.row.id))
    .slice(0,Math.min(12,Math.max(0,Number.isFinite(limit)?Math.floor(limit):4)));
  const rows=await listedRows(db,selected.map(candidate=>candidate.row.id));
  const hydrated=await hydrate(db,rows,Date.now());
  return hydrated.map(candidate=>({...candidate,similarityReasons:selected.find(item=>item.row.id===candidate.id)!.similarityReasons}));
}
/** Listed coffees by id, in the order given; one that left the catalog since its id was cached is skipped. */
export async function listedRows(db:CatalogDatabase,ids:string[]):Promise<CoffeeRow[]> {
  if(!ids.length)return [];
  const rows=(await db.prepare(`SELECT ${COFFEE_COLUMNS} FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.id IN (${placeholders(ids.length)})`).bind(...ids).all<CoffeeRow>()).results;
  return ids.flatMap(id=>rows.filter(row=>row.id===id));
}
function featureStrings(coffee:{features:Array<Pick<FeatureValue,'feature'|'value'>>},...names:string[]):string[]{return coffee.features.filter(f=>names.includes(f.feature)).flatMap(f=>typeof f.value==='string'?[f.value]:Array.isArray(f.value)?f.value.filter((v):v is string=>typeof v==='string'):[]);}
