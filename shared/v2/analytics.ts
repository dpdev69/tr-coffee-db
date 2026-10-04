import type { CatalogDatabase } from './database';

export const CLIENT_PRODUCT_EVENTS = ['coffee_detail_view', 'feed_filter_change', 'newsletter_signup_submit', 'quiz_started', 'quiz_completed'] as const;
export type ClientProductEventName = typeof CLIENT_PRODUCT_EVENTS[number];
export type ProductEventName = ClientProductEventName | 'newsletter_signup_success' | 'outbound_roaster_click';
export const ANALYTICS_PAGES = ['home', 'new', 'deals', 'catalog', 'coffee', 'roasters', 'roaster', 'quiz', 'guide', 'compare', 'other'] as const;
export const ANALYTICS_SOURCES = ['home', 'home-hero', 'home-bottom', 'feed', 'catalog', 'detail', 'similar', 'roaster', 'compare', 'quiz', 'guide', 'navigation', 'unknown'] as const;
export const ANALYTICS_FILTER_KEYS = ['origin', 'process', 'taste', 'roaster', 'priceMin', 'priceMax', 'search', 'farm', 'producer', 'variety', 'altitude', 'traceability', 'roast', 'brewMethod', 'sort'] as const;
export const ANALYTICS_FEED_TYPES = ['NEW', 'PRICE_DROP', 'RESTOCKED', 'DEAL'] as const;
export type AnalyticsPage = typeof ANALYTICS_PAGES[number];
export type AnalyticsSource = typeof ANALYTICS_SOURCES[number];
export type AnalyticsFilterKey = typeof ANALYTICS_FILTER_KEYS[number];
export type AnalyticsFeedType = typeof ANALYTICS_FEED_TYPES[number];
export interface ClientProductEvent {
  event: ClientProductEventName;
  page: AnalyticsPage;
  source: AnalyticsSource;
  coffeeId?: string;
  filterKeys?: AnalyticsFilterKey[];
  feedType?: AnalyticsFeedType;
}
export interface ProductEvent extends Omit<ClientProductEvent, 'event'> {
  event: ProductEventName;
  roasterId?: string;
  offerId?: string;
}
/** Minimal injected capabilities keep this shared module usable by Node crawler tooling.
 * The web route still receives Wrangler's generated CloudflareEnv. */
export interface AnalyticsEnvironment {
  ANALYTICS?: { writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void };
  EVENT_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  DEPLOYMENT_STAGE?: string;
}

const MAX_BODY_BYTES = 4096;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const COFFEE_ID = /^coffee_[a-f0-9]{64}$/;
const OFFER_ID = /^offer_[a-f0-9]{64}$/;
const ROASTER_ID = /^roaster_[a-f0-9]{64}$/;
const CLIENT_KEYS = new Set(['event', 'page', 'source', 'coffeeId', 'filterKeys', 'feedType']);
const SERVER_KEYS = new Set([...CLIENT_KEYS, 'roasterId', 'offerId']);
const SERVER_EVENTS = new Set<ProductEventName>([...CLIENT_PRODUCT_EVENTS, 'newsletter_signup_success', 'outbound_roaster_click']);
const includes = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T);
export function isCoffeeAnalyticsId(value: unknown): value is string { return typeof value === 'string' && (UUID.test(value) || COFFEE_ID.test(value)); }
export function isOfferAnalyticsId(value: unknown): value is string { return typeof value === 'string' && OFFER_ID.test(value); }
function isRoasterId(value: unknown): value is string { return typeof value === 'string' && (UUID.test(value) || ROASTER_ID.test(value)); }
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }

function parseEvent(value: unknown, trusted: boolean): ProductEvent | null {
  const input = object(value);
  if (!input || Object.keys(input).some(key => !(trusted ? SERVER_KEYS : CLIENT_KEYS).has(key))) return null;
  if (trusted ? !SERVER_EVENTS.has(input.event as ProductEventName) : !includes(CLIENT_PRODUCT_EVENTS, input.event)) return null;
  if (!includes(ANALYTICS_PAGES, input.page) || !includes(ANALYTICS_SOURCES, input.source)) return null;
  if (input.coffeeId !== undefined && !isCoffeeAnalyticsId(input.coffeeId)) return null;
  if (input.roasterId !== undefined && !isRoasterId(input.roasterId)) return null;
  if (input.offerId !== undefined && !isOfferAnalyticsId(input.offerId)) return null;
  if (input.feedType !== undefined && !includes(ANALYTICS_FEED_TYPES, input.feedType)) return null;
  if (input.filterKeys !== undefined && (!Array.isArray(input.filterKeys) || input.filterKeys.length > ANALYTICS_FILTER_KEYS.length || input.filterKeys.some(key => !includes(ANALYTICS_FILTER_KEYS, key)))) return null;
  if (input.event === 'coffee_detail_view' && !input.coffeeId) return null;
  if (input.event === 'feed_filter_change' && !Array.isArray(input.filterKeys)) return null;
  if (input.event === 'outbound_roaster_click' && (!input.offerId || !input.coffeeId || !input.roasterId)) return null;
  return {
    event: input.event as ProductEventName, page: input.page, source: input.source,
    ...(input.coffeeId ? { coffeeId: input.coffeeId as string } : {}),
    ...(input.roasterId ? { roasterId: input.roasterId as string } : {}),
    ...(input.offerId ? { offerId: input.offerId as string } : {}),
    ...(input.feedType ? { feedType: input.feedType as AnalyticsFeedType } : {}),
    ...(Array.isArray(input.filterKeys) ? { filterKeys: [...new Set(input.filterKeys as AnalyticsFilterKey[])].sort() } : {}),
  };
}
export function parseClientProductEvent(value: unknown): ClientProductEvent | null { return parseEvent(value, false) as ClientProductEvent | null; }

/** No arbitrary strings or payload serialization reach the dataset. Cloudflare queues writes itself;
 * writeDataPoint is synchronous and does not need waitUntil. A missing/broken sink never throws. */
export function emitProductEvent(env: AnalyticsEnvironment, input: ProductEvent): boolean {
  const event = parseEvent(input, true);
  if (!event || !env.ANALYTICS) return false;
  const stage = env.DEPLOYMENT_STAGE === 'production' ? 'production' : env.DEPLOYMENT_STAGE === 'staging' ? 'staging' : 'local';
  try {
    env.ANALYTICS.writeDataPoint({
      indexes: [event.roasterId || event.event],
      blobs: ['v1', event.event, stage, event.page, event.source, event.roasterId || '', event.coffeeId || '', event.offerId || '', (event.filterKeys || []).join('|'), event.feedType || ''],
      doubles: [1, event.filterKeys?.length || 0],
    });
    return true;
  } catch { return false; }
}

/** Request metadata is inspected only to suppress automated noise; none is written to analytics. */
export function isAnalyticsNoise(request: Request): boolean {
  if (request.method === 'HEAD') return true;
  if (/prefetch|prerender/i.test(`${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`)) return true;
  if (request.headers.has('next-router-prefetch') || request.headers.has('x-middleware-prefetch')) return true;
  const cf = (request as Request & { cf?: { botManagement?: { verifiedBot?: boolean; score?: number } } }).cf;
  if (cf?.botManagement?.verifiedBot || (typeof cf?.botManagement?.score === 'number' && cf.botManagement.score < 10)) return true;
  return /bot\b|crawler|spider|slurp|headless|preview|facebookexternalhit/i.test((request.headers.get('user-agent') || '').slice(0, 512));
}
export async function allowAnalyticsRequest(request: Request, env: AnalyticsEnvironment, namespace: 'events' | 'outbound'): Promise<boolean | null> {
  if (!env.EVENT_LIMITER) return null;
  const candidate = request.headers.get('cf-connecting-ip');
  // Only Cloudflare's boundary header is used. Keys are transient limiter state, never analytics fields.
  // Shared network addresses share a budget. X-Forwarded-For is deliberately ignored.
  const ip = candidate && /^[a-fA-F0-9:.]{1,64}$/.test(candidate) ? candidate : 'unknown';
  try { return (await env.EVENT_LIMITER.limit({ key: `${namespace}:${ip}` })).success; }
  catch { return null; }
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new RangeError('Body size');
  if (!request.body) throw new SyntaxError('Missing body');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError('Body size'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function analyticsResponse(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...(status === 429 ? { 'Retry-After': '60' } : {}), ...(status === 405 ? { Allow: 'POST' } : {}) } });
}
export async function handleProductEvent(request: Request, env: AnalyticsEnvironment, db: CatalogDatabase): Promise<Response> {
  if (request.method !== 'POST') return analyticsResponse(405);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return analyticsResponse(403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return analyticsResponse(415);
  if (isAnalyticsNoise(request)) return analyticsResponse(204);
  const allowed = await allowAnalyticsRequest(request, env, 'events');
  if (allowed === false) return analyticsResponse(429);
  if (allowed === null || !env.ANALYTICS) return analyticsResponse(503);
  let payload: ClientProductEvent | null;
  try { payload = parseClientProductEvent(await readLimitedJson(request)); }
  catch (error) { return analyticsResponse(error instanceof RangeError ? 413 : 400); }
  if (!payload) return analyticsResponse(400);
  let identity: { id: string; roaster_id: string } | null = null;
  try {
    if (payload.coffeeId) {
      identity = await db.prepare("SELECT id,roaster_id FROM coffees WHERE id=? AND visibility='public'").bind(payload.coffeeId).first<{ id: string; roaster_id: string }>();
      if (!identity) return analyticsResponse(404);
    }
  } catch { return analyticsResponse(503); }
  const written = emitProductEvent(env, { ...payload, ...(identity ? { coffeeId: identity.id, roasterId: identity.roaster_id } : {}) });
  return analyticsResponse(written ? 204 : 503);
}
