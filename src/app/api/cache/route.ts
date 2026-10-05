import { getV2Environment } from '@/lib/v2-runtime';

const HEADERS = { 'Cache-Control': 'no-store' };
type Purge = { purge(options: { purgeEverything: true }): Promise<{ success: boolean }> };

/** POST with `Authorization: Bearer <CACHE_PURGE_TOKEN>`, sent by the nightly refresh once corrections are in (scrape.yml):
 * drops every response Workers Cache holds for this Worker, so the new catalog shows at once rather than when
 * EDGE_CACHE_CONTROL runs out. Without the secret the route answers 404. */
export async function POST(request: Request) {
  const env = await getV2Environment().catch(() => null) as (CloudflareEnv & { CACHE_PURGE_TOKEN?: string }) | null;
  const token = env?.CACHE_PURGE_TOKEN;
  if (!token || token.length < 32) return new Response(null, { status: 404, headers: HEADERS });
  const given = new TextEncoder().encode(request.headers.get('authorization') ?? '');
  const wanted = new TextEncoder().encode(`Bearer ${token}`);
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean };
  if (given.byteLength !== wanted.byteLength || !subtle.timingSafeEqual(given, wanted)) return new Response(null, { status: 401, headers: HEADERS });
  const moduleName = 'cloudflare:workers';
  const { cache } = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName) as { cache?: Purge };
  const result = await cache?.purge({ purgeEverything: true }).catch(() => null);
  return Response.json({ purged: result?.success === true }, { status: result?.success ? 200 : 503, headers: HEADERS });
}
