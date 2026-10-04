import { coffeeExclusionReason } from './coffee-eligibility';
import type { CatalogDatabase, SqlValue, Statement } from './database';
import type { CoffeeEvent, CrawlInput, PriceObservation, RoasterInput, SourceCoffee } from './types';
import { canonicalizeUrl, offerIdentity, productIdentity, stableId, stableSlug, toMinorUnits, validCurrency, validWeight } from './identity';
import { deriveNewEvent, deriveOfferEvents } from './events';

interface RoasterRow { id: string; revision: number; last_success_at: string | null; trusted_hosts_json: string }
interface CoffeeRow { id: string; source_product_id: string | null; identity_key: string; slug: string }
interface AliasRow { alias_type: string; alias: string; coffee_id: string }
interface OfferRow { id: string; coffee_id: string; identity_key: string; current_price_minor: number | null; currency: string | null; weight_g: number | null }
interface FeatureRow { coffee_id: string; feature: string; value_json: string; source_type: string; confidence: number | null; version: string; source_reference: string | null }
interface ObservationRow { id: string; offer_id: string; crawl_run_id: string; observed_at: string; price_minor: number | null; compare_at_minor: number | null; weight_g: number | null; currency: string | null; in_stock: number | null; source: 'crawl' | 'import' }

function insert(db: CatalogDatabase, table: string, row: Record<string, SqlValue>, suffix = ''): Statement {
  const keys = Object.keys(row);
  return db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ${suffix}`).bind(...keys.map(key => row[key]));
}
function upsertColumns(columns: string[]): string { return `DO UPDATE SET ${columns.map(column => `${column}=excluded.${column}`).join(',')}`; }
function stock(value: boolean | null) { return value === null ? null : Number(value); }
function canonicalTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid crawl timestamp');
  return date.toISOString();
}
export function safeDiagnostic(text: string): string {
  // Diagnostics are machine-authored. Strip likely email/token material even on upstream errors.
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(bearer\s+|(?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]').slice(0, 500);
}

/** Queue invocations have a 15-minute wall limit. Close abandoned attempts after two hours.
 * A storage outage can prevent even a DLQ consumer from recording its final failure.
 */
export async function expireCrawls(db: CatalogDatabase, now: string): Promise<void> {
  const cutoff = new Date(Date.parse(now) - 2 * 60 * 60 * 1000).toISOString();
  const diagnostic = JSON.stringify([{stage:'queue',code:'attempt_expired',message:'Attempt exceeded its execution window; catalog state preserved.'}]);
  await db.batch([
    db.prepare(`INSERT INTO crawl_errors(id,crawl_run_id,roaster_id,stage,code,message,created_at)
      SELECT 'expired:'||id,id,roaster_id,'queue','attempt_expired','Attempt exceeded its execution window; catalog state preserved.',?
      FROM crawl_runs WHERE status='running' AND started_at<?`).bind(now,cutoff),
    db.prepare(`UPDATE roasters SET revision=revision+1,crawl_health='failed',updated_at=?
      WHERE EXISTS(SELECT 1 FROM crawl_runs c WHERE c.roaster_id=roasters.id AND c.status='running' AND c.started_at<? AND c.started_at=roasters.last_attempt_at)`).bind(now,cutoff),
    db.prepare("UPDATE crawl_runs SET status='failed',completed_at=?,diagnostics_json=? WHERE status='running' AND started_at<?").bind(now,diagnostic,cutoff),
  ]);
}
export async function registerRoaster(db: CatalogDatabase, roaster: RoasterInput, now = new Date().toISOString()): Promise<void> {
  const website = canonicalizeUrl(roaster.websiteUrl);
  const host = new URL(website).hostname;
  const hosts = [...new Set([host, host.startsWith('www.') ? host.slice(4) : `www.${host}`, ...(roaster.trustedHosts ?? [])])];
  await db.batch([insert(db, 'roasters', { id: roaster.id, slug: roaster.slug, name: roaster.name, website_url: website,
    city: roaster.city ?? null, adapter: roaster.adapter, trusted_hosts_json: JSON.stringify(hosts), active: Number(roaster.active !== false), created_at: now, updated_at: now },
  `ON CONFLICT(id) ${upsertColumns(['slug','name','website_url','city','adapter','trusted_hosts_json','active','updated_at'])},revision=roasters.revision+1`)]);
}

export type CrawlStart = Pick<CrawlInput,'id'|'jobKey'|'roasterId'|'startedAt'|'parserVersion'|'mode'>;
/** Persist attempt before fetching. A repeated job can inspect its terminal state without crawling again. */
export async function beginCrawl(db: CatalogDatabase, input: CrawlStart): Promise<{ status: string; existed: boolean }> {
  const startedAt=canonicalTime(input.startedAt);
  if (!input.id || !input.roasterId || !input.parserVersion) throw new Error('Missing crawl identity');
  const existing=await db.prepare('SELECT status,roaster_id,started_at,parser_version,mode,job_key FROM crawl_runs WHERE id=?').bind(input.id)
    .first<{status:string;roaster_id:string;started_at:string;parser_version:string;mode:string;job_key:string|null}>();
  if(existing) {
    if(existing.roaster_id!==input.roasterId || existing.started_at!==startedAt || existing.parser_version!==input.parserVersion || existing.mode!==(input.mode??'live') || existing.job_key!==(input.jobKey??null)) throw new Error('Crawl ID reused with different start');
    return {status:existing.status,existed:true};
  }
  const roaster=await db.prepare('SELECT revision FROM roasters WHERE id=?').bind(input.roasterId).first<{revision:number}>();
  if(!roaster) throw new Error('Unknown roaster');
  await db.batch([
    db.prepare('INSERT INTO ingestion_guards(run_id,valid) VALUES(?,COALESCE((SELECT revision=? FROM roasters WHERE id=?),0))').bind(input.id,roaster.revision,input.roasterId),
    insert(db,'crawl_runs',{id:input.id,job_key:input.jobKey??null,roaster_id:input.roasterId,started_at:startedAt,status:'running',mode:input.mode??'live',parser_version:input.parserVersion,created_at:startedAt}),
    db.prepare("UPDATE roasters SET revision=revision+1,last_attempt_at=CASE WHEN last_attempt_at IS NULL OR last_attempt_at<? THEN ? ELSE last_attempt_at END,crawl_health=CASE WHEN last_attempt_at IS NULL OR last_attempt_at<=? THEN 'running' ELSE crawl_health END,updated_at=? WHERE id=?").bind(startedAt,startedAt,startedAt,startedAt,input.roasterId),
    db.prepare('DELETE FROM ingestion_guards WHERE run_id=?').bind(input.id),
  ]);
  return {status:'running',existed:false};
}

/** One complete roaster result is one atomic batch. Call through a primary D1 session when read replication is enabled. */
export async function ingestCrawl(db: CatalogDatabase, input: CrawlInput): Promise<{ replayed: boolean; coffees: number; offers: number; events: number; status: string }> {
  const startedAt = canonicalTime(input.startedAt);
  const completedAt = canonicalTime(input.completedAt);
  if (completedAt < startedAt) throw new Error('Crawl completed before it started');
  if (!input.id || !input.parserVersion || !input.roasterId) throw new Error('Missing crawl identity');
  const inputHash = await stableId('input', JSON.stringify(input));
  const replay = await db.prepare('SELECT input_hash,products_seen,offers_seen,status,roaster_id,started_at,parser_version,mode,job_key FROM crawl_runs WHERE id=?').bind(input.id).first<{input_hash:string|null;products_seen:number;offers_seen:number;status:string;roaster_id:string;started_at:string;parser_version:string;mode:string;job_key:string|null}>();
  if (replay && replay.status !== 'running') {
    if (replay.input_hash !== inputHash) throw new Error('Crawl ID reused with different input');
    return { replayed: true, coffees: replay.products_seen, offers: replay.offers_seen, events: 0, status: replay.status };
  }
  if(replay && (replay.roaster_id!==input.roasterId || replay.started_at!==startedAt || replay.parser_version!==input.parserVersion || replay.mode!==(input.mode??'live') || replay.job_key!==(input.jobKey??null))) throw new Error('Crawl completion does not match started run');
  const roaster = await db.prepare('SELECT id,revision,last_success_at,trusted_hosts_json FROM roasters WHERE id=?').bind(input.roasterId).first<RoasterRow>();
  if (!roaster) throw new Error('Unknown roaster');
  const mode = input.mode ?? 'live';
  if (input.status === 'success' && input.products.length === 0) throw new Error('Empty successful crawl requires review');
  if (input.status === 'success' && roaster.last_success_at && startedAt <= roaster.last_success_at) throw new Error('Stale crawl cannot replace newer state');
  const offersSeen = input.products.reduce((sum, coffee) => sum + coffee.offers.length, 0);
  // Context is deliberately excluded: parser errors can otherwise embed response bodies, emails and keys.
  const diagnostics = input.diagnostics.map(item => ({ stage: safeDiagnostic(item.stage), code: safeDiagnostic(item.code), message: safeDiagnostic(item.message) }));
  const statements: Statement[] = [
    db.prepare('INSERT INTO ingestion_guards(run_id,valid) VALUES(?,COALESCE((SELECT revision=? FROM roasters WHERE id=?),0))').bind(input.id,roaster.revision,input.roasterId),
    insert(db, 'crawl_runs', { id: input.id, job_key: input.jobKey??null, roaster_id: input.roasterId, started_at: startedAt, completed_at: completedAt, status: input.status,
      mode, parser_version: input.parserVersion, products_seen: input.products.length, offers_seen: offersSeen, diagnostics_json: JSON.stringify(diagnostics), input_hash: inputHash, created_at: completedAt },
    `ON CONFLICT(id) ${upsertColumns(['completed_at','status','products_seen','offers_seen','diagnostics_json','input_hash'])}`),
  ];
  for (const [index, error] of diagnostics.entries()) {
    statements.push(insert(db, 'crawl_errors', { id: await stableId('error',input.id,String(index)), crawl_run_id: input.id, roaster_id: input.roasterId,
      stage: error.stage, code: error.code, message: error.message, context_json: null, created_at: completedAt }));
  }
  let eventCount = 0;
  if (input.status === 'success') {
    const hosts = JSON.parse(roaster.trusted_hosts_json) as string[];
    const coffeeRows = (await db.prepare('SELECT id,source_product_id,identity_key,slug FROM coffees WHERE roaster_id=?').bind(input.roasterId).all<CoffeeRow>()).results;
    const aliases = (await db.prepare('SELECT alias_type,alias,coffee_id FROM coffee_aliases WHERE roaster_id=?').bind(input.roasterId).all<AliasRow>()).results;
    const offerRows = (await db.prepare('SELECT o.id,o.coffee_id,o.identity_key,o.current_price_minor,o.currency,o.weight_g FROM offers o JOIN coffees c ON c.id=o.coffee_id WHERE c.roaster_id=?').bind(input.roasterId).all<OfferRow>()).results;
    // Index seek per offer reads two rows, rather than ranking its entire growing history.
    const observationRows = (await db.prepare(`SELECT p.* FROM offers o JOIN coffees c ON c.id=o.coffee_id
      JOIN price_observations p ON p.id IN (SELECT recent.id FROM price_observations recent WHERE recent.offer_id=o.id ORDER BY recent.observed_at DESC LIMIT 2)
      WHERE c.roaster_id=?`).bind(input.roasterId).all<ObservationRow>()).results;
    const featureRows = (await db.prepare("SELECT f.coffee_id,f.feature,f.value_json,f.source_type,f.confidence,f.version,f.source_reference FROM coffee_feature_values f JOIN coffees c ON c.id=f.coffee_id WHERE c.roaster_id=? AND f.source_type<>'MANUAL'").bind(input.roasterId).all<FeatureRow>()).results;
    const seenCoffees = new Set<string>();
    const seenOffers = new Set<string>();
    for (const product of input.products) {
      validateProduct(product);
      const excluded = coffeeExclusionReason(product);
      const url = canonicalizeUrl(product.canonicalUrl, hosts);
      const identity = productIdentity({ ...product, canonicalUrl: url });
      const bySource = coffeeRows.find(row => row.identity_key === identity || (product.sourceProductId !== null && row.source_product_id === product.sourceProductId));
      const byAlias = aliases.find(alias => alias.alias_type === 'url' && alias.alias === url);
      if (bySource && byAlias && bySource.id !== byAlias.coffee_id) throw new Error('Conflicting product source and URL identities');
      const existing = bySource ?? coffeeRows.find(row => row.id === byAlias?.coffee_id);
      if (existing?.source_product_id && product.sourceProductId && existing.source_product_id !== product.sourceProductId) {
        const previousOffers = offerRows.filter(row => row.coffee_id === existing.id);
        const importedPath = new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
        // Legacy HTML adapters used URL paths as IDs. A first exact-URL baseline may
        // replace that placeholder with the native ID, retaining both source aliases.
        const importedIdentity = mode === 'baseline' && byAlias?.coffee_id === existing.id && existing.source_product_id === importedPath &&
          previousOffers.length > 0 && previousOffers.every(row => row.identity_key.startsWith('options:legacy:')) &&
          observationRows.filter(row => previousOffers.some(offer => offer.id === row.offer_id)).every(row => row.source === 'import');
        if (!importedIdentity) throw new Error('Suspicious source identity change requires reconciliation');
      }
      const coffeeId = existing?.id ?? await stableId('coffee', input.roasterId, identity);
      if (seenCoffees.has(coffeeId)) throw new Error('Duplicate product identity in crawl');
      seenCoffees.add(coffeeId);
      const slug = existing?.slug ?? stableSlug(product.name, coffeeId);
      statements.push(insert(db, 'coffees', { id: coffeeId, roaster_id: input.roasterId, source_product_id: product.sourceProductId ?? existing?.source_product_id ?? null,
        identity_key: existing?.identity_key ?? identity, canonical_url: url, name: product.name.trim(), slug, raw_metadata_json: JSON.stringify(product.rawMetadata),
        visibility: excluded ? 'hidden' : product.visibility ?? 'unclassified', first_seen_at: startedAt, last_seen_at: startedAt, created_at: completedAt, updated_at: completedAt },
      `ON CONFLICT(id) ${upsertColumns(['source_product_id','canonical_url','name','raw_metadata_json','visibility','last_seen_at','updated_at'])}`));
      for (const [type, alias] of [['url',url],['slug',slug], ...(product.sourceProductId ? [['source',product.sourceProductId]] : [])]) {
        const known = aliases.find(item => item.alias_type === type && item.alias === alias);
        if (known && known.coffee_id !== coffeeId) throw new Error('Conflicting product alias');
        if(!known) aliases.push({alias_type:type,alias,coffee_id:coffeeId});
        statements.push(insert(db, 'coffee_aliases', { roaster_id: input.roasterId, alias_type: type, alias, coffee_id: coffeeId, created_at: completedAt }, 'ON CONFLICT(roaster_id,alias_type,alias) DO NOTHING'));
      }
      const events: CoffeeEvent[] = existing || excluded ? [] : await deriveNewEvent(coffeeId,input.id,startedAt,mode);
      for (const offer of product.offers) {
        const purchaseUrl = canonicalizeUrl(offer.purchaseUrl, hosts);
        const key = offerIdentity({ ...offer, purchaseUrl });
        if (product.offers.length > 1 && key.startsWith('single:')) throw new Error('Multiple offers need stable SKU IDs or source option identities');
        const existingOffer = offerRows.find(row => row.coffee_id === coffeeId && row.identity_key === key);
        const offerId = existingOffer?.id ?? await stableId('offer',coffeeId,key);
        if (seenOffers.has(offerId)) throw new Error('Duplicate offer identity in crawl');
        seenOffers.add(offerId);
        const priceMinor = toMinorUnits(offer.price);
        const compareAtMinor = toMinorUnits(offer.compareAtPrice);
        const weightG = validWeight(offer.weightG);
        const currency = validCurrency(offer.currency);
        if (offer.inStock !== null && typeof offer.inStock !== 'boolean') throw new Error('Invalid stock');
        const observation: PriceObservation = { id: await stableId('observation',input.id,offerId), offerId,crawlRunId: input.id,observedAt: startedAt,
          priceMinor,compareAtMinor,weightG,currency,inStock: offer.inStock,source: mode === 'import' ? 'import' : 'crawl' };
        const history: PriceObservation[] = observationRows.filter(row => row.offer_id === offerId).map(row => ({ id: row.id,offerId: row.offer_id,crawlRunId: row.crawl_run_id,observedAt: row.observed_at,
          priceMinor: row.price_minor,compareAtMinor: row.compare_at_minor,weightG: row.weight_g,currency: row.currency,inStock: row.in_stock === null ? null : row.in_stock === 1,source: row.source }));
        if (!excluded) events.push(...await deriveOfferEvents({ coffeeId,observation,history,mode }));
        const priceChanged = existingOffer && existingOffer.current_price_minor !== priceMinor && existingOffer.currency === currency && existingOffer.weight_g === weightG;
        statements.push(insert(db, 'offers', { id: offerId,coffee_id: coffeeId,source_variant_id: offer.sourceVariantId,identity_key: key,label: offer.label,weight_g: weightG,currency,
          current_price_minor: priceMinor,compare_at_price_minor: compareAtMinor,in_stock: stock(offer.inStock),purchase_url: purchaseUrl,first_seen_at: startedAt,last_seen_at: startedAt,
          last_price_change_at: priceChanged ? startedAt : null,created_at: completedAt,updated_at: completedAt },
        `ON CONFLICT(id) ${upsertColumns(['label','weight_g','currency','current_price_minor','compare_at_price_minor','in_stock','purchase_url','last_seen_at','updated_at'])},last_price_change_at=COALESCE(excluded.last_price_change_at,offers.last_price_change_at),retired_at=NULL`));
        statements.push(insert(db, 'price_observations', { id: observation.id,offer_id: offerId,crawl_run_id: input.id,price_minor: priceMinor,compare_at_minor: compareAtMinor,currency,weight_g: weightG,
          in_stock: stock(offer.inStock),observed_at: startedAt,source: observation.source }));
      }
      // Complete variant discovery also withdraws old SKUs no longer offered for this
      // observed product. Retirement preserves history and emits no stock assertion.
      if(mode!=='import') for(const previous of offerRows.filter(row=>row.coffee_id===coffeeId && !seenOffers.has(row.id))) statements.push(db.prepare('UPDATE offers SET retired_at=?,updated_at=? WHERE id=? AND retired_at IS NULL').bind(startedAt,completedAt,previous.id));
      // An explicitly unavailable parent has no purchasable SKUs. Retain history;
      // do not synthesize variant prices or stock observations from a parent record.
      if(product.unavailable === true) statements.push(db.prepare('UPDATE offers SET retired_at=?,updated_at=? WHERE coffee_id=? AND retired_at IS NULL').bind(startedAt,completedAt,coffeeId));
      // validateProduct restricts source input to declared/inferred provenance. Reviewed MANUAL
      // records belong to a separate write path and must never be deleted by a crawl.
      // Only provenance types present in this result are refreshed; a rule update leaves declarations intact.
      const features: FeatureRow[] = (product.features ?? []).map(feature => {
        if (feature.confidence !== null && (!Number.isFinite(feature.confidence) || feature.confidence < 0 || feature.confidence > 1)) throw new Error('Invalid feature confidence');
        return { coffee_id: coffeeId,feature: feature.feature,value_json: JSON.stringify(feature.value),source_type: feature.sourceType,confidence: feature.confidence,version: feature.version,source_reference: feature.sourceReference ?? null };
      });
      const featureSources = new Set(features.map(feature => feature.source_type));
      // Identical refreshed provenance rows are left alone; the daily delete/re-insert dominated row writes.
      const featureKey = (row: FeatureRow) => JSON.stringify([row.feature,row.source_type,row.value_json,row.confidence,row.version,row.source_reference]);
      const unchanged = features.map(featureKey).sort().join('\n') === featureRows.filter(row => row.coffee_id === coffeeId && featureSources.has(row.source_type)).map(featureKey).sort().join('\n');
      if (!unchanged) {
        for (const source of featureSources) statements.push(db.prepare('DELETE FROM coffee_feature_values WHERE coffee_id=? AND source_type=?').bind(coffeeId,source));
        for (const feature of features) statements.push(insert(db, 'coffee_feature_values', { ...feature,created_at: completedAt,updated_at: completedAt }));
      }
      for (const event of events) statements.push(insert(db, 'coffee_events', { id: event.id,coffee_id: event.coffeeId,offer_id: event.offerId,type: event.type,created_at: event.createdAt,
        before_json: JSON.stringify(event.before),after_json: JSON.stringify(event.after),idempotency_key: event.idempotencyKey,observation_id: event.observationId }));
      eventCount += events.length;
    }
  }
  // A complete first baseline supersedes all imported synthetic offers, including
  // unmatched old listings. Historical observations are retained without stock events.
  if(input.status==='success' && mode==='baseline') statements.push(db.prepare("UPDATE offers SET retired_at=?,updated_at=? WHERE retired_at IS NULL AND identity_key LIKE 'options:legacy:%' AND coffee_id IN (SELECT id FROM coffees WHERE roaster_id=?)").bind(startedAt,completedAt,input.roasterId));
  // Absence is never an unavailable observation. Failed/partial runs update health only.
  statements.push(db.prepare(`UPDATE roasters SET revision=revision+1,last_attempt_at=CASE WHEN last_attempt_at IS NULL OR last_attempt_at<? THEN ? ELSE last_attempt_at END,
    last_success_at=CASE WHEN ?='success' THEN ? ELSE last_success_at END,crawl_health=CASE WHEN last_attempt_at IS NULL OR last_attempt_at<=? THEN ? ELSE crawl_health END,updated_at=? WHERE id=?`).bind(startedAt,startedAt,input.status,startedAt,startedAt,input.status,completedAt,input.roasterId));
  statements.push(db.prepare('DELETE FROM ingestion_guards WHERE run_id=?').bind(input.id));
  await db.batch(statements);
  return { replayed: false,coffees: input.status === 'success' ? input.products.length : 0,offers: input.status === 'success' ? offersSeen : 0,events: eventCount,status: input.status };
}

function validateProduct(product: SourceCoffee): void {
  if (!product.name.trim() || product.name.length > 500) throw new Error('Invalid coffee name');
  if (!product.offers.length && product.unavailable !== true) throw new Error('Product has no offers');
  if (product.unavailable === true && product.offers.length) throw new Error('Unavailable parent cannot contain offers');
  if (JSON.stringify(product.rawMetadata).length > 100_000) throw new Error('Product metadata too large');
  for (const feature of product.features ?? []) {
    if (feature.sourceType !== 'ROASTER_DECLARED' && feature.sourceType !== 'RULE_INFERRED') {
      throw new Error('Crawl features may only use ROASTER_DECLARED or RULE_INFERRED provenance');
    }
  }
}
