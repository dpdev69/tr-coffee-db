import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import BrewGuidePage, { metadata as brewMetadata } from '../src/app/rehber/filtre-kahve-nasil-yapilir/page';
import BeanGuidePage, { metadata as beanMetadata } from '../src/app/rehber/filtre-kahve-cekirdegi/page';
import { canonicalQuery } from '../src/lib/canonical-address';
import { BEAN_GUIDE_UPDATED, BREW_GUIDE_UPDATED } from '../src/lib/content-dates';
import { BEAN_GUIDE_PATH, BREW_GUIDE_PATH, GUIDE_PATHS, MIN_STATED, faqPage, leading, sideFacts, tasteCount } from '../src/lib/rehber';
import type { ComparisonData, SideFacts } from '../src/lib/comparisons';
import { staticSitemap } from '../src/lib/sitemap-entries';
import { absoluteUrl } from '../src/lib/site';
import { guard, type GuardEnv } from '../workers/miss-guard';

const PER_100G = /100\s?g(?:r|ram)?\s?(?:fiyat|başına)|\/\s?100\s?g|birim fiyat/i;
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]) as Record<string, unknown>);
const pages = [
  { path: BREW_GUIDE_PATH, meta: brewMetadata, render: BrewGuidePage, h1: 'Filtre kahve nasıl yapılır?', updated: BREW_GUIDE_UPDATED, types: ['Article', 'HowTo', 'FAQPage', 'BreadcrumbList'] },
  { path: BEAN_GUIDE_PATH, meta: beanMetadata, render: BeanGuidePage, h1: 'En iyi filtre kahve çekirdeği: tadına göre seç', updated: BEAN_GUIDE_UPDATED, types: ['Article', 'FAQPage', 'BreadcrumbList'] },
];

test('both guides fit a search result: title with the brand under 60, description 120 to 160, self canonical', () => {
  for (const page of pages) {
    const title = typeof page.meta.title === 'string' ? `${page.meta.title} | KahveDrop` : String((page.meta.title as { absolute: string }).absolute);
    assert.ok(title.length <= 60, title);
    const description = String(page.meta.description);
    assert.ok(description.length >= 120 && description.length <= 160, `${page.path}: ${description.length}`);
    assert.equal(page.meta.alternates?.canonical, page.path);
    assert.equal((page.meta.openGraph as { type?: string }).type, 'article');
  }
});

test('without the catalog each guide still renders its copy, one H1, and structured data that matches what it shows', async () => {
  for (const page of pages) {
    const html = renderToStaticMarkup(await page.render());
    assert.equal(html.match(/<h1/g)?.length, 1, page.path);
    assert.ok(html.includes(`>${escape(page.h1)}</h1>`), page.path);
    const data = jsonLd(html);
    assert.deepEqual(data.map(item => item['@type']), page.types, page.path);
    const faq = data.find(item => item['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    assert.ok(faq.mainEntity.length >= 5);
    for (const item of faq.mainEntity) {
      assert.ok(html.includes(`<summary>${escape(item.name)}</summary>`), item.name);
      assert.ok(html.includes(`<p>${escape(item.acceptedAnswer.text)}</p>`), item.name);
    }
    const article = data.find(item => item['@type'] === 'Article') as { url: string; dateModified: string; publisher: { parentOrganization: { '@id': string } } };
    assert.equal(article.url, absoluteUrl(page.path));
    assert.equal(article.dateModified, page.updated);
    assert.equal(article.publisher.parentOrganization['@id'], 'https://hellobasalt.dev/#org');
    const crumbs = data.find(item => item['@type'] === 'BreadcrumbList') as { itemListElement: Array<{ item: string }> };
    assert.deepEqual(crumbs.itemListElement.map(item => item.item), [absoluteUrl('/guide'), absoluteUrl(page.path)]);
    // No invented numbers when the catalog is out: no counts, no prices, no zeros.
    assert.doesNotMatch(html, /itibarıyla|\b0 çekirdek|ortanca fiyat/, page.path);
    assert.doesNotMatch(html, PER_100G, page.path);
    assert.doesNotMatch(html, /\b(?:animate-|transition)/, `${page.path}: no motion`);
  }
});

test('the brewing guide states the agreed method: ratio, temperature, per-method times, cold brew, and HowTo steps the page shows', async () => {
  const html = renderToStaticMarkup(await BrewGuidePage());
  for (const fact of ['1:15–1:17', '92–96 °C', '2,5–3,5 dakika', '3,5–4,5 dakika', '4 dakika', '12–18 saat', 'Filtre kahve makinesi']) assert.ok(html.includes(fact), fact);
  const how = jsonLd(html).find(item => item['@type'] === 'HowTo') as { step: Array<{ name: string; url: string }> };
  how.step.forEach((step, index) => { assert.ok(html.includes(`id="adim-${index + 1}"`)); assert.equal(step.url, absoluteUrl(`${BREW_GUIDE_PATH}#adim-${index + 1}`)); });
  assert.ok(html.includes(`href="${BEAN_GUIDE_PATH}"`), 'links the bean guide');
});

test('the bean guide ranks no brand and links the taste, origin and roast listings it describes', async () => {
  const html = renderToStaticMarkup(await BeanGuidePage());
  assert.match(html, /marka sıralaması yok/);
  for (const href of ['/kahveler/koken/etiyopya', '/kahveler/koken/kenya', '/kahveler/koken/kolombiya', '/kahveler/koken/brezilya', '/kahveler?taste=Fruity&amp;brewMethod=filter', '/kahveler?taste=Chocolate&amp;brewMethod=filter', '/kahveler?roast=light', '/karsilastir/kenya-vs-etiyopya', BREW_GUIDE_PATH]) assert.ok(html.includes(`href="${href}"`), href);
  // Every listing link is already in its canonical form, so it never costs a redirect.
  for (const [, href] of html.matchAll(/href="(\/kahveler\?[^"]+)"/g)) {
    const url = new URL(href.replace(/&amp;/g, '&'), 'https://kahvedrop.test');
    assert.equal(canonicalQuery(url.pathname, url.searchParams), url.search.slice(1), href);
  }
});

const side = (override: Partial<SideFacts> = {}): SideFacts => ({ coffees: 40, roasters: 9, city: null, price250: { coffees: 30, min: 400, median: 700, max: 1200 }, cheapest250: null,
  stated: { origin: 40, process: 30, roast: 4, taste: 36, brew: 12 }, origins: [], processes: [], roasts: [{ key: 'medium', label: 'Orta', count: 3 }],
  tastes: [{ key: 'Fruity', label: 'Meyvemsi', count: 30 }, { key: 'Floral', label: 'Çiçeksi', count: 12 }, { key: 'Sweet', label: 'Tatlı', count: 8 }, { key: 'Nutty', label: 'Kuruyemiş', count: 2 }],
  brews: [], topRoasters: [], shown: [], ...override });

test('shares are printed only when enough coffees state the fact, and a missing side is no side', () => {
  const facts = side();
  assert.equal(leading(facts.tastes, facts.stated.taste), 'Meyvemsi 30, Çiçeksi 12 ve Tatlı 8');
  assert.equal(leading(facts.roasts, facts.stated.roast), null, `fewer than ${MIN_STATED} coffees state a roast`);
  assert.equal(tasteCount(facts, 'Floral'), 12);
  assert.equal(tasteCount(facts, 'Chocolate'), 0);
  assert.equal(tasteCount(side({ stated: { ...facts.stated, taste: 3 } }), 'Fruity'), null);
  const data: ComparisonData = { at: '2026-10-30T03:00:00.000Z', sides: { 'brew:filter': facts } };
  assert.equal(sideFacts(data, { kind: 'brew', value: 'filter' }), facts);
  assert.equal(sideFacts(data, { kind: 'origin', value: 'Kenya' }), null);
  assert.equal(sideFacts(null, { kind: 'brew', value: 'filter' }), null);
  assert.deepEqual(faqPage([{ question: 'S?', answer: 'C.' }]), { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'S?', acceptedAnswer: { '@type': 'Answer', text: 'C.' } }] });
});

test('the guides are in the sitemap with their copy date, in llms.txt, linked from the footer, home and guide, and kept at the edge', async () => {
  const sitemap = staticSitemap();
  for (const path of GUIDE_PATHS) {
    const entry = sitemap.find(item => item.url === absoluteUrl(path));
    assert.ok(entry, path);
    assert.deepEqual(entry.lastModified, new Date(path === BREW_GUIDE_PATH ? BREW_GUIDE_UPDATED : BEAN_GUIDE_UPDATED));
    assert.ok(readFileSync('public/llms.txt', 'utf8').includes(`https://kahve.hellobasalt.dev${path})`), `llms.txt: ${path}`);
    for (const file of ['src/components/layout/footer.tsx', 'src/app/page.tsx', 'src/app/guide/page.tsx']) assert.ok(readFileSync(file, 'utf8').includes(`href="${path}"`), `${file} → ${path}`);
    assert.equal(canonicalQuery(path, new URLSearchParams('utm_source=x&page=2')), '', 'one cached address per guide');
  }
  assert.match(readFileSync('next.config.ts', 'utf8'), /"\/rehber\/:guide"/);
  const keys: string[] = [];
  const env: GuardEnv = { PAGE_LIMITER: { async limit({ key }: { key: string }) { keys.push(key); return { success: true }; } } };
  await guard(new Request(`https://kahvedrop.test${BEAN_GUIDE_PATH}`, { headers: { 'cf-connecting-ip': '203.0.113.9' } }), env, { waitUntil() {} } as never);
  assert.equal(keys.length, 1, 'a miss is counted against the page limit');
});
