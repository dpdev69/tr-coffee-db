/** Server request logic. Credentials are injected only by the route; no client or persistent storage imports. */
import { emitProductEvent, type AnalyticsEnvironment } from '../../shared/v2/analytics';

export const SUBSCRIBE_MESSAGE = 'Başvurun alındı. Gerekliyse aboneliğini onaylamak için e-posta kutunu kontrol et.';
const BODY_LIMIT = 4096;
const PROVIDER_TIMEOUT_MS = 8000;
const SOURCES = new Set(['home-hero', 'home-bottom', 'catalog', 'detail']);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const STATES = new Set(['active', 'inactive', 'cancelled', 'bounced', 'complained']);
export interface SubscribeEnvironment extends Pick<AnalyticsEnvironment, 'ANALYTICS' | 'DEPLOYMENT_STAGE'> {
  KIT_API_KEY?: string;
  KIT_FORM_ID?: string;
  SUBSCRIBE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
export type SubscribeOutcome = 'accepted' | 'suppressed' | 'honeypot' | 'invalid' | 'limited' | 'unavailable' | 'provider_error';
export interface SubscribeResult {
  status: number;
  body: { ok: boolean; message: string };
  /** Internal classification; never serialized into the public response. */
  outcome: SubscribeOutcome;
  diagnostic?: { stage: 'create_subscriber' | 'attach_form'; status: number | null; errorClass: 'http' | 'network' | 'timeout' | 'invalid_json' | 'invalid_subscriber' };
}
class KitFailure extends Error {
  constructor(readonly diagnostic: NonNullable<SubscribeResult['diagnostic']>) { super('Kit request failed'); }
}
type Fetcher = typeof fetch;
export interface SubscribeDependencies { fetch?: Fetcher; timeoutMs?: number }
const accepted = (outcome: SubscribeOutcome): SubscribeResult => ({ status: 200, body: { ok: true, message: SUBSCRIBE_MESSAGE }, outcome });
const failure = (status: number, message: string, outcome: SubscribeOutcome): SubscribeResult => ({ status, body: { ok: false, message }, outcome });
const invalid = () => failure(400, 'Geçerli bir e-posta adresiyle yeniden deneyebilirsin.', 'invalid');
export const subscribeUnavailable = () => failure(503, 'Abonelik şu anda kullanılamıyor. Lütfen daha sonra yeniden dene.', 'unavailable');

async function boundedJson(input: Request | Response, limit: number): Promise<unknown> {
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
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
}
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
  return path === '/' || /^\/(?:kahveler|yeni|firsatlar|kavurucular|coffees|roasters|guide|quiz|compare|rankings|privacy|terms)\/?$/.test(path)
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
  if (typeof source === 'string' && SOURCES.has(source) && !clean.searchParams.has('utm_content')) clean.searchParams.set('utm_content', source);
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
  const post = async (path: string, body: Record<string, string>, stage: NonNullable<SubscribeResult['diagnostic']>['stage']) => {
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
    const response = await post('subscribers', { email_address: email, state: 'inactive' }, 'create_subscriber');
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

export async function handleSubscribe(request: Request, env: SubscribeEnvironment, dependencies: SubscribeDependencies = {}): Promise<SubscribeResult> {
  let origin: string;
  try { origin = new URL(request.url).origin; } catch { return invalid(); }
  if (request.method !== 'POST' || request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') return invalid();
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return invalid();
  if (!env.KIT_API_KEY?.trim() || !env.KIT_FORM_ID || !/^\d+$/.test(env.KIT_FORM_ID) || !env.SUBSCRIBE_LIMITER || typeof env.SUBSCRIBE_LIMITER.limit !== 'function') return subscribeUnavailable();
  // Cloudflare supplies this header at its boundary. Missing/invalid local headers share one conservative bucket.
  const incomingIp = request.headers.get('cf-connecting-ip');
  const ip = incomingIp && /^[a-fA-F0-9:.]{1,64}$/.test(incomingIp) ? incomingIp : 'unknown';
  try {
    if (!(await env.SUBSCRIBE_LIMITER.limit({ key: `subscribe:${ip}` })).success) return failure(429, 'Çok fazla deneme yaptın. Bir dakika sonra yeniden deneyebilirsin.', 'limited');
  } catch { return subscribeUnavailable(); }
  let body: Record<string, unknown> | null;
  try { body = record(await boundedJson(request, BODY_LIMIT)); } catch { return invalid(); }
  if (!body) return invalid();
  if (body.website !== undefined && (typeof body.website !== 'string' || body.website.trim() !== '')) return accepted('honeypot');
  const email = emailAddress(body.email); if (!email) return invalid();
  const referrer = sanitizeSubscribeReferrer(body.referrer, request.url, body.source);
  try {
    const outcome = await subscribeWithKit(email, referrer, env.KIT_API_KEY, env.KIT_FORM_ID, dependencies);
    if (outcome === 'accepted') {
      const source = body.source === 'home-hero' || body.source === 'home-bottom' || body.source === 'catalog' || body.source === 'detail' ? body.source : 'unknown';
      const page = source === 'home-hero' || source === 'home-bottom' ? 'home' : source === 'catalog' ? 'catalog' : source === 'detail' ? 'coffee' : 'other';
      // Counts accepted requests, never confirmed/new unique subscribers. No email, referrer, ID or provider state is passed.
      try { emitProductEvent(env, { event: 'newsletter_signup_success', page, source }); }
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
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store', ...(result.status === 429 ? { 'Retry-After': '60' } : {}) } });
}
