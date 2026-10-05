import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalListing, canonicalQuery, MAX_PAGE } from '../src/lib/canonical-address';
import { parseDiscoveryFilters } from '../src/components/v2/discovery-catalog';
import { quizResultUrl, parseQuizAnswers } from '../src/lib/quiz-filters';
import { buildGlobalSearchUrl } from '../src/lib/search-url';
import { BRAKE_ROWS, clientKey, guard, setUsage, type GuardEnv } from '../workers/miss-guard';
import { readOncePerRequest } from '../shared/v2/read-cache';
import type { CatalogDatabase, Statement } from '../shared/v2/database';

const canonical = (address: string) => { const url = new URL(address, 'https://kahvedrop.test'); return canonicalQuery(url.pathname, url.searchParams); };
const waiter = { waitUntil() {} };
const limiter = (allow = true, keys: string[] = []) => ({ async limit({ key }: { key: string }) { keys.push(key); return { success: allow }; } });
const request = (address: string, headers: Record<string, string> = {}) => new Request(`https://kahvedrop.test${address}`, { headers: { 'cf-connecting-ip': '203.0.113.9', ...headers } });

test('every spelling of a catalog listing has one canonical query', () => {
  // Unknown and tracking keys, empty values (every form submission), defaults and repeats go; the form's key order stays.
  assert.equal(canonical('/kahveler?utm_source=x&fbclid=y&search=&taste=Floral&origin=&roaster=&priceMin=&priceMax=&taste=Fruity&farm=&sort=newest&page=1&x=1'), 'taste=Fruity&taste=Floral');
  assert.equal(canonical('/kahveler?sort=price_asc&search=%20%20Kenya,%20%20V60%20&page=3'), 'search=Kenya+V60&sort=price_asc&page=3');
  // Values that read as the same filter are one address.
  assert.equal(canonical('/kahveler?origin=Etiyopya&origin=Ethiopia&origin=Ethiopia'), canonical('/kahveler?origin=Ethiopia'));
  assert.equal(canonical('/kahveler?priceMin=0500&priceMax=1e3'), 'priceMin=500&priceMax=1000');
  assert.equal(canonical('/kahveler?priceMin=abc&priceMax=999999'), 'priceMax=100000');
  assert.equal(canonical('/kahveler?taste=fruity&taste=Fruity&roast=lightest&process=natural'), 'taste=Fruity&process=natural');
  // Bounded: the search term, values per filter, the page number.
  assert.equal(new URLSearchParams(canonical(`/kahveler?search=${'a'.repeat(500)}`)!).get('search')!.length, 80);
  assert.equal(new URLSearchParams(canonical(`/kahveler?${Array.from({ length: 30 }, (_, i) => `roaster=r${i}`).join('&')}`)!).getAll('roaster').length, 5);
  assert.equal(canonical('/kahveler?page=99999'), `page=${MAX_PAGE}`);
  // Each feed keeps only its own switch; a landing ignores its own facet.
  assert.equal(canonical('/yeni?event=NEW'), '');
  assert.equal(canonical('/yeni?event=RESTOCKED'), 'event=RESTOCKED');
  assert.equal(canonical('/firsatlar?event=DEAL&event=x'), 'event=DEAL');
  assert.equal(canonical('/kahveler?event=DEAL'), '');
  assert.equal(canonical('/kahveler/koken/etiyopya?origin=Kenya&process=natural'), 'process=natural');
  assert.equal(canonical('/kahveler/islem/naturel?process=washed&origin=Kenya'), 'origin=Kenya');
});

test('addresses that ignore the query canonicalise to none; endpoints keep only what they read', () => {
  for (const path of ['/', '/kahve/a', '/kavurucu/b', '/kavurucular', '/bulten/2026-11', '/api/since', '/sitemap.xml']) assert.equal(canonical(`${path}?x=1&utm_source=y`), '', path);
  assert.equal(canonical('/quiz/sonuc?taste=floral,Fruity&brew=filter&brew=&utm_source=x'), 'brew=filter&taste=Fruity,Floral');
  assert.equal(canonical('/api/quiz/match?brew=&taste=Fruity&roast=&process=&limit=4'), 'taste=Fruity');
  assert.equal(canonical('/api/quiz/match?taste=Fruity&limit=8'), 'taste=Fruity&limit=8');
  assert.equal(canonical('/api/saved?slug=b&slug=a&slug=a&slug=%2E%2E&x=1'), 'slug=a&slug=b');
  assert.equal(canonical('/compare?coffee=b&coffee=a&coffee=b&coffee=c&coffee=d'), 'coffee=b&coffee=a&coffee=c');
  assert.equal(canonical('/api/catalog?q=%20kenya%20&page=1&taste=Fruity&x=1'), 'taste=Fruity&q=kenya');
  assert.equal(canonical('/guide?x=1'), null, 'not a catalog address');
});

test('the canonical address reads as the same filters as the address it replaces', () => {
  const address = '/kahveler?search=%20Kenya%20&taste=Floral&taste=Fruity&origin=Etiyopya&priceMin=500&farm=%20Finca%20&sort=price_asc&page=2&utm_source=x';
  const before = parseDiscoveryFilters(Object.fromEntries([...new URLSearchParams(address.split('?')[1])].reduce((map, [key, value]) => map.set(key, [...(map.get(key) ?? []), value]), new Map<string, string[]>())));
  const after = parseDiscoveryFilters(Object.fromEntries([...new URLSearchParams(canonical(address)!)].reduce((map, [key, value]) => map.set(key, [...(map.get(key) ?? []), value]), new Map<string, string[]>())));
  assert.deepEqual({ ...after, taste: after.taste?.slice().sort() }, { ...before, taste: before.taste?.slice().sort() });
});

test('the site builds canonical addresses itself: quiz result, header search, pagination-style listings', () => {
  const quiz = quizResultUrl(parseQuizAnswers({ taste: ['Floral', 'Fruity'], brew: ['filter'] }));
  assert.equal(canonical(quiz), quiz.split('?')[1]);
  const search = buildGlobalSearchUrl({ pathname: '/kahveler', currentQuery: 'taste=Fruity&page=3', nextSearch: 'kenya' });
  assert.equal(search, '/kahveler?search=kenya&taste=Fruity');
  assert.equal(canonical(search), search.split('?')[1]);
  assert.equal(canonicalListing('/yeni', new URLSearchParams('event=NEW')), '/yeni');
});

test('clients are counted by IPv4 address or IPv6 /64; nothing else is trusted', () => {
  assert.equal(clientKey(request('/')), '203.0.113.9');
  assert.equal(clientKey(request('/', { 'cf-connecting-ip': '::ffff:198.51.100.7' })), '198.51.100.7');
  assert.equal(clientKey(request('/', { 'cf-connecting-ip': '2001:db8:0:12:aaaa::1' })), '2001:db8:0:12::/64');
  assert.equal(clientKey(request('/', { 'cf-connecting-ip': '2001:db8::1' })), clientKey(request('/', { 'cf-connecting-ip': '2001:db8:0:0:ffff::9' })), 'one /64');
  assert.equal(clientKey(new Request('https://kahvedrop.test/', { headers: { 'x-forwarded-for': '1.2.3.4' } })), 'unknown');
});

test('a non-canonical address is redirected before any limit, keeping the router pair', async () => {
  const keys: string[] = [];
  const env: GuardEnv = { CATALOG_LIMITER: limiter(false, keys), PAGE_LIMITER: limiter(false, keys) };
  const answer = await guard(request('/kahveler?page=2&utm_source=x&_rsc=abc', { rsc: '1' }), env, waiter) as Response;
  assert.equal(answer.status, 308);
  assert.equal(answer.headers.get('location'), '/kahveler?page=2&_rsc=abc');
  assert.match(answer.headers.get('cdn-cache-control')!, /max-age=21600/, 'a redirect costs no rows and may be stored');
  assert.equal(keys.length, 0);
  assert.equal(((await guard(request('/kahveler.rsc?x=1&_rsc'), env, waiter)) as Response).headers.get('location'), '/kahveler.rsc?_rsc');
});

test('a client over its limit gets a cheap, unstored, plain-Turkish 429; each route class has its own limiter', async () => {
  const catalogKeys: string[] = [], pageKeys: string[] = [];
  const env: GuardEnv = { CATALOG_LIMITER: limiter(false, catalogKeys), PAGE_LIMITER: limiter(true, pageKeys) };
  const page = await guard(request('/kahveler?taste=Fruity'), env, waiter) as Response;
  assert.equal(page.status, 429);
  assert.equal(page.headers.get('retry-after'), '60');
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('cdn-cache-control'), 'no-store');
  assert.match(await page.text(), /<html lang="tr">[\s\S]*Bir dakika sonra yeniden deneyebilirsin/);
  const api = await guard(request('/api/since'), env, waiter) as Response;
  assert.equal(api.status, 429);
  assert.match((await api.json() as { error: string }).error, /yavaşlayalım/);
  assert.deepEqual(catalogKeys, ['203.0.113.9', '203.0.113.9']);
  assert.ok(await guard(request('/kahve/a'), env, waiter) instanceof Request, 'a coffee page counts against the page limiter');
  assert.deepEqual(pageKeys, ['203.0.113.9']);
  assert.ok(await guard(request('/guide'), env, waiter) instanceof Request, 'no catalog read, no limit');
  assert.ok(await guard(new Request('https://kahvedrop.test/api/events', { method: 'POST' }), env, waiter) instanceof Request);
  const broken = { async limit(): Promise<{ success: boolean }> { throw new Error('limiter down'); } };
  assert.ok(await guard(request('/kahveler'), { CATALOG_LIMITER: broken }, waiter) instanceof Request, 'a limiter outage lets the request through');
});

test('a script asking for */* gets a page the edge may store; router and API requests are left alone', async () => {
  const pass = await guard(request('/kahveler', { accept: '*/*' }), {}, waiter) as Request;
  assert.equal(pass.headers.get('accept'), 'text/html');
  assert.equal((await guard(request('/kahveler?_rsc', { accept: 'text/x-component', rsc: '1' }), {}, waiter) as Request).headers.get('accept'), 'text/x-component');
  assert.equal((await guard(request('/api/since', { accept: '*/*' }), {}, waiter) as Request).headers.get('accept'), '*/*');
});

test('the brake stops uncached catalog renders for the rest of the UTC day, and only with the analytics token', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const env: GuardEnv = { D1_ANALYTICS_TOKEN: 'test-only', D1_BUDGET_ACCOUNT_ID: 'acc' };
  setUsage({ day: today, rows: BRAKE_ROWS }, Date.now());
  const answer = await guard(request('/kahveler?taste=Fruity'), env, waiter) as Response;
  assert.equal(answer.status, 503);
  assert.equal(answer.headers.get('cdn-cache-control'), 'no-store');
  assert.ok(Number(answer.headers.get('retry-after')) > 0 && Number(answer.headers.get('retry-after')) <= 86400 + 300);
  assert.match(await answer.text(), /03:00/);
  assert.ok(await guard(request('/kahveler?taste=Fruity'), {}, waiter) instanceof Request, 'without the token there is no brake');
  setUsage({ day: '2000-01-01', rows: BRAKE_ROWS * 2 }, Date.now());
  assert.ok(await guard(request('/kahveler?taste=Fruity'), env, waiter) instanceof Request, 'yesterday’s count does not brake today');
  setUsage({ day: today, rows: BRAKE_ROWS - 1 }, Date.now());
  assert.ok(await guard(request('/kahveler?taste=Fruity'), env, waiter) instanceof Request);
  setUsage(null);
});

test('within one request each catalog read and derived result runs once', async () => {
  let reads = 0, derives = 0;
  const statement = (): Statement => ({ bind: () => statement(), all: async <T>() => { reads++; return { results: [] as T[], success: true }; }, first: async <T>() => { reads++; return null as T | null; } });
  const db: CatalogDatabase = { prepare: () => statement(), batch: async () => [], derive: async <T>(_: string, compute: () => Promise<T>) => { derives++; return compute(); } };
  const scope = {};
  for (let pass = 0; pass < 2; pass++) {
    const shared = readOncePerRequest(db, scope);
    await shared.prepare('SELECT 1 WHERE ?').bind(1).all();
    await shared.prepare('SELECT 1 WHERE ?').bind(1).first();
    await shared.derive!('counts', async () => 1);
  }
  assert.equal(reads, 2, 'all() and first() once each');
  assert.equal(derives, 1);
  await readOncePerRequest(db, {}).prepare('SELECT 1 WHERE ?').bind(1).all();
  assert.equal(reads, 3, 'another request reads again');
  await readOncePerRequest(db, scope).prepare('SELECT 1 WHERE ?').bind(2).all();
  assert.equal(reads, 4, 'other values are another read');
  await readOncePerRequest(db, scope).prepare('INSERT INTO x VALUES(1)').all();
  await readOncePerRequest(db, scope).prepare('INSERT INTO x VALUES(1)').all();
  assert.equal(reads, 6, 'writes are never shared');
});
