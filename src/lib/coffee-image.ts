import { imageHosts } from '../../shared/v2/image-hosts';

export const COFFEE_IMAGE_WIDTHS = [256, 384, 640, 960, 1280] as const;
const allowedHosts = new Set<string>(imageHosts);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// An <img> SVG cannot read CSS variables: these mirror --color-tint and --color-muted in src/app/globals.css.
const FALLBACK_COLORS = { background: '#e9edf8', text: '#555a6e' } as const;
const xml = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
/** A dead source image shows whose coffee it is (the roaster's name) instead of an apology. */
function unavailableImage(name: string) {
  const label = name.replace(/\s+/g, ' ').trim().slice(0, 40) || 'Kahve';
  const size = Math.min(32, Math.floor(520 / label.length));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="${FALLBACK_COLORS.background}"/><text x="160" y="160" dominant-baseline="middle" text-anchor="middle" font-family="'Bricolage Grotesque',system-ui,sans-serif" font-weight="500" font-size="${size}" fill="${FALLBACK_COLORS.text}">${xml(label)}</text></svg>`;
}
export function trustedCoffeeImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedHosts.has(url.hostname)) return null;
    // Older Milestones crawls resolved root uploads against the category URL.
    if (url.hostname === 'milestonescoffee.com') url.pathname = url.pathname.replace(/^\/kategori\/[^/]+(?=\/upload\/)/, '');
    return url;
  } catch { return null; }
}
export function coffeeImageUrl(source: string, width: number, name?: string) {
  return `/api/coffee-image?src=${encodeURIComponent(trustedCoffeeImageUrl(source)?.href ?? source)}&w=${width}${name ? `&name=${encodeURIComponent(name.slice(0, 40))}` : ''}`;
}
async function boundedImage(source: Response): Promise<ReadableStream<Uint8Array>> {
  if (Number(source.headers.get('content-length') || 0) > MAX_IMAGE_BYTES || !source.body) throw new Error('Image too large');
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error('Image too large'); }
    chunks.push(value);
  }
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
}
/** A fixed remotePatterns-equivalent host list prevents arbitrary URL proxying; no catalog database reads. */
export async function serveCoffeeImage(request: Request, images: ImagesBinding | undefined, fetchImage: typeof fetch = fetch, cache?: Cache): Promise<Response> {
  const requestUrl = new URL(request.url);
  const width = Number(requestUrl.searchParams.get('w') || 640);
  const sourceUrl = trustedCoffeeImageUrl(requestUrl.searchParams.get('src') || '');
  if (!sourceUrl || !COFFEE_IMAGE_WIDTHS.includes(width as typeof COFFEE_IMAGE_WIDTHS[number])) return new Response('Invalid image request', { status: 400 });
  let url: URL = sourceUrl;
  const format = request.headers.get('accept')?.includes('image/avif') ? 'image/avif' : 'image/webp';
  const cacheUrl = new URL('/api/coffee-image', requestUrl.origin);
  cacheUrl.searchParams.set('src', url.toString()); cacheUrl.searchParams.set('w', String(width)); cacheUrl.searchParams.set('format', format);
  const cacheKey = new Request(cacheUrl);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return new Response(cached.body, { status: cached.status, headers: new Headers(cached.headers) });
  try {
    let source: Response | undefined;
    for (let redirect = 0; redirect < 4; redirect++) {
      source = await fetchImage(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (source.status < 300 || source.status >= 400) break;
      const location = source.headers.get('location');
      const next = location ? trustedCoffeeImageUrl(new URL(location, url).toString()) : null;
      if (!next) throw new Error('Untrusted image redirect');
      url = next;
    }
    if (!source?.ok || !source.body || !/^image\/(?:jpeg|png|webp|avif|gif)(?:;|$)/i.test(source.headers.get('content-type') || '')) throw new Error('Source image unavailable');
    const original = new Response(await boundedImage(source), { headers: { 'Content-Type': source.headers.get('content-type')! } });
    let result = original;
    if (images) {
      try {
        const output = await images.input(original.clone().body!).transform({ width, fit: 'scale-down' }).output({ format, quality: 75 });
        result = output.response();
      } catch { /* A valid source image still works when optimization fails. */ }
    }
    const headers = new Headers(result.headers);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    headers.set('Vary', 'Accept'); headers.set('X-Content-Type-Options', 'nosniff');
    const response = new Response(result.body, { headers });
    await cache?.put(cacheKey, response.clone()).catch(() => undefined);
    return response;
  } catch {
    return new Response(unavailableImage(requestUrl.searchParams.get('name') ?? ''), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  }
}
