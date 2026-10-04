import { getV2Environment } from '@/lib/v2-runtime';
import { serveCoffeeImage } from '@/lib/coffee-image';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const env = await getV2Environment().catch(() => null);
  const cache = typeof caches !== 'undefined' ? (caches as CacheStorage & { default?: Cache }).default : undefined;
  const response = await serveCoffeeImage(request, env?.IMAGES, fetch, cache);
  return new Response(response.body, { status: response.status, headers: new Headers(response.headers) });
}
