import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coffeeImageUrl, serveCoffeeImage, trustedCoffeeImageUrl } from '../src/lib/coffee-image';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import nextConfig from '../next.config';
import { imageHosts } from '../shared/v2/image-hosts';

const source = 'https://coffeemolecule.com/coffee.jpg';
const request = (src = source, width = 384, accept = 'image/webp') => new Request(`https://app.test/api/coffee-image?src=${encodeURIComponent(src)}&w=${width}`, { headers: { Accept: accept } });
function imageBinding(calls: { width?: number; format?: string }[]): ImagesBinding {
  return { input() { return { transform(options: { width: number }) { return { async output(options2: { format: string }) { calls.push({ width: options.width, format: options2.format }); return { response() { return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': options2.format } }); } }; } }; } }; } } as unknown as ImagesBinding;
}
const imageResponse = () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/jpeg' } });

test('image service rejects untrusted URLs and unsupported widths before any network request', async () => {
  const fetcher = (async () => { throw new Error('Must not fetch'); }) as typeof fetch;
  for (const url of ['http://coffeemolecule.com/a', 'https://evil.test/a', 'https://user:pass@coffeemolecule.com/a', 'https://coffeemolecule.com:8443/a', 'https://coffeemolecule.com.evil.test/a', 'data:image/png,bad']) {
    assert.equal(trustedCoffeeImageUrl(url), null);
    assert.equal((await serveCoffeeImage(request(url), imageBinding([]), fetcher)).status, 400);
  }
  assert.equal((await serveCoffeeImage(request(source, 999), imageBinding([]), fetcher)).status, 400);
});
test('native image patterns fit the Next limit while the product proxy retains both exact Ordinarius hosts', () => {
  const patterns = nextConfig.images!.remotePatterns! as Parameters<typeof hasRemoteMatch>[1];
  assert.ok(patterns.length <= 50);
  for (const hostname of imageHosts.filter(host => host !== 'ordinariuscoffee.com')) assert.equal(hasRemoteMatch([], patterns, new URL(`https://${hostname}/coffee.jpg`)), true, hostname);
  assert.ok(trustedCoffeeImageUrl('https://ordinariuscoffee.com/coffee.jpg'));
  assert.ok(trustedCoffeeImageUrl('https://www.ordinariuscoffee.com/coffee.jpg'));
  for (const hostname of ['images.ordinariuscoffee.com', 'ordinariuscoffee.com.evil.test', 'www.ordinariuscoffee.com.evil.test', 'wwwordinariuscoffee.com', 'ordinariuscoffeeXcom']) {
    assert.equal(hasRemoteMatch([], patterns, new URL(`https://${hostname}/coffee.jpg`)), false, hostname);
  }
  assert.equal(hasRemoteMatch([], patterns, new URL('http://ordinariuscoffee.com/coffee.jpg')), false);
});
test('valid source uses fixed resize widths and browser format with cache variation', async () => {
  const calls: { width?: number; format?: string }[] = [];
  for (const format of ['image/avif', 'image/webp']) {
    const result = await serveCoffeeImage(request(source, 384, format), imageBinding(calls), (async () => imageResponse()) as typeof fetch);
    assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), format);
    assert.equal(result.headers.get('vary'), 'Accept'); assert.match(result.headers.get('cache-control')!, /max-age=86400/);
  }
  assert.deepEqual(calls, [{ width: 384, format: 'image/avif' }, { width: 384, format: 'image/webp' }]);
});
test('every redirect is validated and untrusted destinations are never fetched', async () => {
  const visited: string[] = [];
  const response = await serveCoffeeImage(request(), imageBinding([]), (async url => { visited.push(String(url)); return Response.redirect('https://evil.test/secret'); }) as typeof fetch);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/svg+xml'); assert.equal(response.headers.get('location'), null); assert.deepEqual(visited, [source]);
});
test('missing, oversized, non-image and failed sources return a safe renderable placeholder', async () => {
  const oversized = (async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '20971521' } })) as typeof fetch;
  for (const fetcher of [oversized, async () => new Response('missing', { status: 404 }), async () => new Response('<html>blocked</html>'), async () => { throw new Error('network'); }]) {
    const result = await serveCoffeeImage(request(), imageBinding([]), fetcher as typeof fetch);
    assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'image/svg+xml'); assert.equal(result.headers.get('location'), null);
    assert.match(await result.text(), /<svg[^>]+>.*Görsel mevcut değil/);
  }
});
test('valid original bytes remain available when the image optimizer is missing or fails', async () => {
  const broken = { input() { throw new Error('optimizer unavailable'); } } as unknown as ImagesBinding;
  const consumed = { input(body: ReadableStream) { return { transform() { return { async output() { await new Response(body).arrayBuffer(); throw new Error('optimizer consumed its input before failing'); } }; } }; } } as unknown as ImagesBinding;
  for (const binding of [undefined, broken, consumed]) {
    const result = await serveCoffeeImage(request(), binding, (async () => imageResponse()) as typeof fetch);
    assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([1, 2]));
  }
});
test('Ordinarius www images and historical Milestones category-relative uploads reach their trusted source', async () => {
  const historical = 'https://milestonescoffee.com/kategori/kahveler-57/upload/coffee.jpg';
  const canonical = 'https://milestonescoffee.com/upload/coffee.jpg';
  assert.equal(trustedCoffeeImageUrl(historical)?.href, canonical);
  assert.equal(new URL(coffeeImageUrl(historical, 384), 'https://app.test').searchParams.get('src'), canonical);
  assert.equal(trustedCoffeeImageUrl('https://coffeemolecule.com/kategori/kahveler-57/upload/coffee.jpg')?.pathname, '/kategori/kahveler-57/upload/coffee.jpg');
  const visited: string[] = [];
  for (const url of [historical, 'https://www.ordinariuscoffee.com/idea/coffee.png']) {
    const result = await serveCoffeeImage(request(url), imageBinding([]), (async input => { visited.push(String(input)); return imageResponse(); }) as typeof fetch);
    assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'image/webp');
  }
  assert.deepEqual(visited, [canonical, 'https://www.ordinariuscoffee.com/idea/coffee.png']);
});
test('cache stores transformed format separately and bypasses upstream work on hit', async () => {
  const stored = new Map<string, Response>(); let reads = 0;
  const cache = { async match(key: Request) { return stored.get(key.url)?.clone(); }, async put(key: Request, value: Response) { stored.set(key.url, value); } } as unknown as Cache;
  const fetcher = (async () => { reads++; return imageResponse(); }) as typeof fetch;
  await serveCoffeeImage(request(), imageBinding([]), fetcher, cache);
  await serveCoffeeImage(request(), imageBinding([]), fetcher, cache);
  await serveCoffeeImage(request(source, 384, 'image/avif'), imageBinding([]), fetcher, cache);
  assert.equal(reads, 2); assert.equal(stored.size, 2);
});
