/** Server request logic. Credentials are injected only by the route; no client or persistent storage imports. */
import { ANALYTICS_SOURCES, emitProductEvent, type AnalyticsEnvironment } from '../../shared/v2/analytics';
import { newsletterConsent } from './brand';
import { signupsEnabled } from './signups';

export const SUBSCRIBE_MESSAGE = 'Neredeyse tamam. Aboneliğini tamamlamak için e-posta kutuna gelecek onay iletisindeki bağlantıya tıkla. Gelmezse spam klasörüne de bak.';
const BODY_LIMIT = 4096;
const PROVIDER_TIMEOUT_MS = 8000;
/** Every placement of the signup form and the analytics page it belongs to. Sources for pages built by other agents (quiz, saved, issue) are registered ahead of them. */
export const SUBSCRIBE_SOURCES: Record<string, 'home' | 'catalog' | 'coffee' | 'deals' | 'new' | 'roaster' | 'quiz' | 'other'> = {
  'home-hero': 'home', 'home-bottom': 'home', catalog: 'catalog', detail: 'coffee', deals: 'deals',
  new: 'new', roaster: 'roaster', footer: 'other', quiz: 'quiz', saved: 'other', issue: 'other',
};
export const knownSource = (value: unknown): value is string => typeof value === 'string' && Object.hasOwn(SUBSCRIBE_SOURCES, value);
/** The shared analytics schema has a fixed source list; other placements are counted as 'unknown'. */
export const analyticsSource = (source: string) => ((ANALYTICS_SOURCES as readonly string[]).includes(source) ? source : 'unknown') as typeof ANALYTICS_SOURCES[number];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const STATES = new Set(['active', 'inactive', 'cancelled', 'bounced', 'complained']);
export interface SubscribeEnvironment extends Pick<AnalyticsEnvironment, 'ANALYTICS' | 'DEPLOYMENT_STAGE'> {
  /** The signup switch (src/lib/signups.ts). Anything but "true" refuses every request. */
  SIGNUPS_ENABLED?: string;
  KIT_API_KEY?: string;
  KIT_FORM_ID?: string;
  SUBSCRIBE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
export type SubscribeOutcome = 'accepted' | 'suppressed' | 'honeypot' | 'invalid' | 'consent' | 'limited' | 'unavailable' | 'provider_error' | 'disabled';
export interface SubscribeResult {
  status: number;
  body: { ok: boolean; message: string };
  /** Internal classification; never serialized into the public response. */
  outcome: SubscribeOutcome;
  /** Set only for form-encoded posts: where to send the browser (303). */
  location?: string;
  diagnostic?: { stage: 'create_subscriber' | 'attach_form'; status: number | null; errorClass: 'http' | 'network' | 'timeout' | 'invalid_json' | 'invalid_subscriber' };
}
class KitFailure extends Error {
  constructor(readonly diagnostic: NonNullable<SubscribeResult['diagnostic']>) { super('Kit request failed'); }
}
type Fetcher = typeof fetch;
export interface SubscribeDependencies { fetch?: Fetcher; timeoutMs?: number }
const accepted = (outcome: SubscribeOutcome): SubscribeResult => ({ status: 200, body: { ok: true, message: SUBSCRIBE_MESSAGE }, outcome });
const failure = (status: number, message: string, outcome: SubscribeOutcome): SubscribeResult => ({ status, body: { ok: false, message }, outcome });
const noConsent = () => failure(400, 'Devam etmek için onay kutusunu işaretlemelisin.', 'consent');
const invalid = () => failure(400, 'Geçerli bir e-posta adresiyle yeniden deneyebilirsin.', 'invalid');
export const subscribeUnavailable = () => failure(503, 'Abonelik şu anda kullanılamıyor. Lütfen daha sonra yeniden dene.', 'unavailable');

/** Signups are switched off: a plain, non-error answer. Nothing is validated, rate limited or sent to the provider. */
const signupsOff = (): SubscribeResult => ({ status: 200, body: { ok: false, message: 'Bülten kayıtları şu anda kapalı. E-posta adresi toplamıyoruz.' }, outcome: 'disabled' });

async function boundedText(input: Request | Response, limit: number): Promise<string> {
  const declared = input.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Error('Invalid body');
  if (!input.body) throw new Error('Missing body');
  const reader = input.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error('Invalid body'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(joined);
}
const boundedJson = async (input: Request | Response, limit: number): Promise<unknown> => JSON.parse(await boundedText(input, limit));
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function emailAddress(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim(); if (email.length > 254) return null;
  const parts = email.split('@'); if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  if (!domain.includes('.') || domain.length > 253 || !domain.split('.').every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return null;
  return `${local}@${domain.toLowerCase()}`;
}
function knownPath(path: string): boolean {
  return path === '/' || /^\/(?:kahveler|yeni|firsatlar|kavurucular|coffees|roasters|guide|quiz|quiz\/sonuc|compare|rankings|privacy|terms)\/?$/.test(path)
    || /^\/(?:kahve|kavurucu|coffees|roasters)\/[a-z0-9][a-z0-9-]{0,199}\/?$/.test(path);
}
export function sanitizeSubscribeReferrer(input: unknown, requestUrl: string, source: unknown): string {
  const origin = new URL(requestUrl).origin;
  const clean = new URL('/', origin);
  if (typeof input === 'string' && input.length <= 2048) {
    try {
      const candidate = new URL(input);
      if (candidate.origin === origin && !candidate.username && !candidate.password && knownPath(candidate.pathname)) {
        clean.pathname = candidate.pathname;
        for (const key of UTM_KEYS) {
          const value = candidate.searchParams.get(key);
          if (value && /^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(value)) clean.searchParams.set(key, value);
        }
      }
    } catch { /* Untrusted referrer is optional; use the site root. */ }
  }
  if (knownSource(source) && !clean.searchParams.has('utm_content')) clean.searchParams.set('utm_content', source);
  return clean.toString();
}

/** Kit's create endpoint upserts without changing existing state; form association is idempotent.
 * https://developers.kit.com/api-reference/subscribers/create-a-subscriber
 * https://developers.kit.com/api-reference/forms/add-subscriber-to-form
 */
async function subscribeWithKit(email: string, referrer: string, key: string, form: string, dependencies: SubscribeDependencies): Promise<'accepted' | 'suppressed'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? PROVIDER_TIMEOUT_MS);
  const fetcher = dependencies.fetch ?? fetch;
  const post = async (path: string, body: Record<string, unknown>, stage: NonNullable<SubscribeResult['diagnostic']>['stage']) => {
    let response: Response;
    try {
      response = await fetcher(`https://api.kit.com/v4/${path}`, {
        // Workers supports only follow/manual. Manual plus the status allowlist rejects redirects without forwarding the key.
        method: 'POST', redirect: 'manual', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': key }, body: JSON.stringify(body),
      });
    } catch { throw new KitFailure({ stage, status: null, errorClass: controller.signal.aborted ? 'timeout' : 'network' }); }
    const acceptedStatuses = stage === 'create_subscriber' ? [200, 201, 202] : [200, 201];
    if (!acceptedStatuses.includes(response.status)) {
      try { await response.body?.cancel(); } catch { /* Never expose provider error content. */ }
      throw new KitFailure({ stage, status: response.status, errorClass: 'http' });
    }
    return response;
  };
  try {
    // Consent evidence rides on the subscriber as custom fields (Kit dashboard: create "consent_at" and "consent_version").
    // A signup without that proof is not acceptable (docs/launch-day.md), so a rejection of the fields fails the signup.
    const fields = { consent_at: new Date().toISOString(), consent_version: newsletterConsent.version };
    const response = await post('subscribers', { email_address: email, state: 'inactive', fields }, 'create_subscriber');
    let parsed: unknown;
    try { parsed = await boundedJson(response, 65536); }
    catch { throw new KitFailure({ stage: 'create_subscriber', status: response.status, errorClass: controller.signal.aborted ? 'timeout' : 'invalid_json' }); }
    const subscriber = record(record(parsed)?.subscriber);
    if (!subscriber || !Number.isSafeInteger(subscriber.id) || Number(subscriber.id) <= 0 || typeof subscriber.state !== 'string' || !STATES.has(subscriber.state)) throw new KitFailure({ stage: 'create_subscriber', status: response.status, errorClass: 'invalid_subscriber' });
    if (['cancelled', 'bounced', 'complained'].includes(subscriber.state)) return 'suppressed';
    const attached = await post(`forms/${form}/subscribers/${subscriber.id}`, { referrer }, 'attach_form');
    try { await attached.body?.cancel(); } catch { /* A confirmed association remains successful if body disposal fails. */ }
    return 'accepted';
  } finally { clearTimeout(timer); }
}

const FORM_CODES: Partial<Record<SubscribeOutcome, string>> = { invalid: 'gecersiz', consent: 'onay', limited: 'cok-sik' };

/** Same pipeline for JSON (fetch) and form-encoded (no-JavaScript) posts; form posts additionally get a redirect target. */
export async function handleSubscribe(request: Request, env: SubscribeEnvironment, dependencies: SubscribeDependencies = {}): Promise<SubscribeResult> {
  if (!signupsEnabled(env)) {
    const off = signupsOff();
    // A no-JavaScript form post from a stale cached page lands on the thank-you page, which says signups are closed.
    return /^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ? { ...off, location: '/tesekkurler' } : off;
  }
  const result = await subscribe(request, env, dependencies);
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return result;
  // Success goes to the thank-you page. Failure returns to the page the form was on, at the form's own
  // (CSS :target) error message, so no JavaScript or dynamic rendering is needed to show it.
  if (result.body.ok) return { ...result, location: '/tesekkurler' };
  const page = new URL(sanitizeSubscribeReferrer(request.headers.get('referer'), request.url, undefined)).pathname;
  const source = new URL(request.url).searchParams.get('source');
  return { ...result, location: knownSource(source) ? `${page}#nl-${source}-${FORM_CODES[result.outcome] ?? 'hata'}` : page };
}

async function subscribe(request: Request, env: SubscribeEnvironment, dependencies: SubscribeDependencies): Promise<SubscribeResult> {
  let origin: string;
  try { origin = new URL(request.url).origin; } catch { return invalid(); }
  if (request.method !== 'POST' || request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') return invalid();
  const contentType = request.headers.get('content-type') ?? '';
  const json = /^application\/json(?:\s*;|$)/i.test(contentType);
  if (!json && !/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) return invalid();
  if (!env.KIT_API_KEY?.trim() || !env.KIT_FORM_ID || !/^\d+$/.test(env.KIT_FORM_ID) || !env.SUBSCRIBE_LIMITER || typeof env.SUBSCRIBE_LIMITER.limit !== 'function') return subscribeUnavailable();
  // Cloudflare supplies this header at its boundary. Missing/invalid local headers share one conservative bucket.
  const incomingIp = request.headers.get('cf-connecting-ip');
  const ip = incomingIp && /^[a-fA-F0-9:.]{1,64}$/.test(incomingIp) ? incomingIp : 'unknown';
  try {
    if (!(await env.SUBSCRIBE_LIMITER.limit({ key: `subscribe:${ip}` })).success) return failure(429, 'Çok fazla deneme yaptın. Bir dakika sonra yeniden deneyebilirsin.', 'limited');
  } catch { return subscribeUnavailable(); }
  let body: Record<string, unknown> | null;
  try {
    // A form post has no referrer field; the browser's Referer header stands in (still sanitized below).
    body = json ? record(await boundedJson(request, BODY_LIMIT)) : { referrer: request.headers.get('referer'), ...Object.fromEntries(new URLSearchParams(await boundedText(request, BODY_LIMIT))) };
  } catch { return invalid(); }
  if (!body) return invalid();
  if (body.website !== undefined && (typeof body.website !== 'string' || body.website.trim() !== '')) return accepted('honeypot');
  const email = emailAddress(body.email); if (!email) return invalid();
  // JSON sends true; a checked HTML checkbox sends "on". Anything else, including absence, is no consent.
  if (body.consent !== true && body.consent !== 'on') return noConsent();
  const referrer = sanitizeSubscribeReferrer(body.referrer, request.url, body.source);
  try {
    const outcome = await subscribeWithKit(email, referrer, env.KIT_API_KEY, env.KIT_FORM_ID, dependencies);
    if (outcome === 'accepted') {
      const source = knownSource(body.source) ? body.source : 'unknown';
      const page = knownSource(body.source) ? SUBSCRIBE_SOURCES[body.source] : 'other';
      // Counts accepted requests, never confirmed/new unique subscribers. No email, referrer, ID or provider state is passed.
      try { emitProductEvent(env, { event: 'newsletter_signup_success', page, source: analyticsSource(source) }); }
      catch { /* A telemetry failure cannot undo a successful form association. */ }
    }
    return accepted(outcome);
  }
  catch (error) {
    const result = failure(502, 'Abonelik şu anda tamamlanamadı. Lütfen biraz sonra yeniden dene.', 'provider_error');
    if (error instanceof KitFailure) result.diagnostic = error.diagnostic;
    return result;
  }
}

export function subscribeResponse(result: SubscribeResult): Response {
  if (result.location) return new Response(null, { status: 303, headers: { Location: result.location, 'Cache-Control': 'no-store', ...(result.status === 429 ? { 'Retry-After': '60' } : {}) } });
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store', ...(result.status === 429 ? { 'Retry-After': '60' } : {}) } });
}
