import { coffeeOnlySql } from './coffee-eligibility';
import type { CatalogDatabase } from './database';
import { canonicalizeUrl } from './identity';
import { allowAnalyticsRequest, ANALYTICS_FEED_TYPES, ANALYTICS_SOURCES, emitProductEvent, isAnalyticsNoise, isOfferAnalyticsId, type AnalyticsEnvironment, type AnalyticsFeedType, type AnalyticsPage, type AnalyticsSource } from './analytics';

interface Destination { offer_id: string; coffee_id: string; roaster_id: string; purchase_url: string; trusted_hosts_json: string }
const SOURCE_PAGE: Partial<Record<AnalyticsSource, AnalyticsPage>> = { home: 'home', 'home-hero': 'home', 'home-bottom': 'home', catalog: 'catalog', detail: 'coffee', similar: 'coffee', roaster: 'roaster', compare: 'compare', quiz: 'quiz', guide: 'guide' };
const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
function empty(status: number): Response { return new Response(null, { status, headers: { ...HEADERS, ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) } }); }
function feedPage(request: Request, type: AnalyticsFeedType | undefined): AnalyticsPage {
  // Inspect a same-origin referrer only to derive a fixed page enum. Never retain its URL/query.
  try {
    const referrer = new URL(request.headers.get('referer') || '');
    if (referrer.origin === new URL(request.url).origin) {
      if (referrer.pathname === '/firsatlar') return 'deals';
      if (referrer.pathname === '/yeni') return 'new';
    }
  } catch { /* Referrer is optional. */ }
  return type === 'DEAL' || type === 'PRICE_DROP' ? 'deals' : type ? 'new' : 'other';
}

/** Validate the stored destination, not any request URL. Exact host allowlists retain reviewed shop/www variants. */
export function trustedReferralUrl(storedUrl: string, trustedHosts: unknown, source: AnalyticsSource, referralSource = 'kahvedrop'): string | null {
  if (!Array.isArray(trustedHosts) || !trustedHosts.length || trustedHosts.some(host => typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host))) return null;
  try {
    const url = new URL(storedUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const clean = new URL(canonicalizeUrl(storedUrl, trustedHosts));
    // Source configuration can change the brand; neither value comes from a request parameter.
    clean.searchParams.set('utm_source', /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(referralSource) ? referralSource : 'kahvedrop');
    clean.searchParams.set('utm_medium', 'referral');
    if (source !== 'unknown') clean.searchParams.set('utm_content', source);
    return clean.toString();
  } catch { return null; }
}

export async function handleOutbound(request: Request, offerId: string, db: CatalogDatabase, env: AnalyticsEnvironment, referralSource = 'kahvedrop'): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return empty(405);
  if (!isOfferAnalyticsId(offerId)) return empty(404);
  let destination: Destination | null;
  try {
    // Deliberately do not use the stock-filtered catalog view. A current out-of-stock offer
    // on a durable visible coffee page remains a useful source link.
    destination = await db.prepare(`SELECT o.id AS offer_id,c.id AS coffee_id,c.roaster_id,o.purchase_url,r.trusted_hosts_json
      FROM offers o JOIN coffees c ON c.id=o.coffee_id JOIN roasters r ON r.id=c.roaster_id
      WHERE o.id=? AND o.retired_at IS NULL AND c.visibility='public' AND r.active=1 AND ${coffeeOnlySql()}`).bind(offerId).first<Destination>();
  } catch { return empty(503); }
  if (!destination) return empty(404);
  const query = new URL(request.url).searchParams;
  const incomingSource = query.get('source');
  const source = ANALYTICS_SOURCES.includes(incomingSource as AnalyticsSource) ? incomingSource as AnalyticsSource : 'unknown';
  const incomingFeed = query.get('event');
  const feedType = ANALYTICS_FEED_TYPES.includes(incomingFeed as AnalyticsFeedType) ? incomingFeed as AnalyticsFeedType : undefined;
  let hosts: unknown;
  try { hosts = JSON.parse(destination.trusted_hosts_json); } catch { return empty(404); }
  const location = trustedReferralUrl(destination.purchase_url, hosts, source, referralSource);
  if (!location) return empty(404);
  const mode = request.headers.get('sec-fetch-mode');
  if (!isAnalyticsNoise(request) && (!mode || mode === 'navigate')) {
    if (await allowAnalyticsRequest(request, env, 'outbound')) {
      const page = source === 'feed' ? feedPage(request, feedType) : SOURCE_PAGE[source] || 'other';
      emitProductEvent(env, { event: 'outbound_roaster_click', page, source, coffeeId: destination.coffee_id, roasterId: destination.roaster_id, offerId: destination.offer_id, ...(feedType ? { feedType } : {}) });
    }
  }
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: location } });
}
