import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crawlRules, SEO_TOOL_CRAWLERS } from '../src/lib/robots-rules';
import { ORIGINAL_KEY, pathlessStreamedIconKey, STREAMED_ICON_MODULE } from '../vite-streamed-icons';
import { stableSlug } from '../shared/v2/identity';

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const list = (value: string | string[] | undefined) => value === undefined ? [] : Array.isArray(value) ? value : [value];

test('production robots: SEO-tool crawlers are shut out, search engines and AI crawlers keep the * group', () => {
  const rules = crawlRules(true) as Rule[];
  const everyone = rules.find(rule => list(rule.userAgent).includes('*'))!;
  const tools = rules.find(rule => list(rule.userAgent).includes('DataForSeoBot'))!;
  assert.deepEqual(list(tools.disallow), ['/']);
  assert.deepEqual(list(tools.userAgent).sort(), ['AhrefsBot', 'BLEXBot', 'Barkrowler', 'DataForSeoBot', 'DotBot', 'MJ12bot', 'SeekportBot', 'SemrushBot', 'serpstatbot'].sort());
  assert.deepEqual(SEO_TOOL_CRAWLERS, list(tools.userAgent));
  // A crawler with its own group ignores *; none of these may have one.
  for (const agent of ['Googlebot', 'Bingbot', 'YandexBot', 'DuckDuckBot', 'Applebot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'])
    assert.ok(!rules.some(rule => list(rule.userAgent).some(listed => listed.toLowerCase() === agent.toLowerCase())), agent);
  assert.deepEqual(list(everyone.allow), ['/']);
  for (const path of ['/api/', '/go/', '/compare', '/quiz/sonuc', '/*search=', '/*priceMin=', '/*:']) assert.ok(list(everyone.disallow).includes(path), path);
  assert.ok(!list(everyone.disallow).includes('/'), 'the site itself stays crawlable');
});

test('staging robots still keep everyone out', () => {
  assert.deepEqual(crawlRules(false), { userAgent: '*', disallow: '/' });
});

test('no page address contains a colon, so Disallow: /*: blocks nothing real', () => {
  for (const name of ['Etiyopya Guji: Hambela', 'Kolombiya: 250g', 'İşlem: natürel', 'a:b:c']) assert.ok(!stableSlug(name, 'coffee_0123456789abcdef').includes(':'), name);
  // Static routes (app directory names) and the landing slugs.
  const routes = readFileSync(new URL('../src/lib/catalog-landing.tsx', import.meta.url), 'utf8');
  assert.ok(!/path:\s*`[^`]*:/.test(routes));
});

test('streamed icon keys are built without the page path', () => {
  const id = fileURLToPath(new URL('../node_modules/vinext/dist/server/app-page-route-wiring.js', import.meta.url));
  assert.match(id, STREAMED_ICON_MODULE);
  const source = readFileSync(id, 'utf8');
  assert.ok(source.includes(ORIGINAL_KEY), 'vinext still builds the key from the path in this one place');
  const patched = pathlessStreamedIconKey(source, id);
  assert.ok(!patched.includes(ORIGINAL_KEY));
  // Run the patched function on its own: the key starts with a scheme-like word, not a path, and still changes with the path.
  const body = patched.slice(patched.indexOf('function createStreamedIconKey'), patched.indexOf('\n}\n', patched.indexOf('function createStreamedIconKey')) + 3);
  const key = new Function(`${body}; return createStreamedIconKey;`)() as (pathname: string, html: string) => string;
  const a = key('/kahveler/islem/naturel', '<link rel="icon" href="/icon.svg">'), b = key('/kahve/guji', '<link rel="icon" href="/icon.svg">');
  assert.match(a, /^vinext-icon-[0-9a-z]+$/);
  assert.notEqual(a, b);
  assert.ok(!a.includes('/') && !a.includes(':'));
  // The client keeps matching by prefix and reading the order after the last colon.
  const marker = `${a}:0`;
  assert.equal(marker.startsWith(`${a}:`), true);
  assert.equal(Number(marker.slice(marker.lastIndexOf(':') + 1)), 0);
  assert.throws(() => pathlessStreamedIconKey('function createStreamedIconKey() {}', 'x.js'), /changed/);
});
