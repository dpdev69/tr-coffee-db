import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { buildIssueEmail, createIssueDraft, type DigestInput } from '../scripts/v2-digest.mts';
import { bundleIssues } from '../scripts/bulten-bundle.mts';
import { campaignUrl, IssueFormatError, parseIssue, resolvePicks, type ResolvedPick } from '../src/app/bulten/issue';
import { trustedSponsorUrl } from '../src/components/v2/sponsor-card';
import { brand } from '../src/lib/brand';
import { listCatalog, type CatalogCoffee } from '../shared/v2/catalog';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { rankCandidates, type QuizCandidate } from '../shared/v2/quiz-rank';
import type { CoffeeEvent, SourceCoffee } from '../shared/v2/types';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const fixtures = new URL('./fixtures/bulten/', import.meta.url);
const fixture = (month: string) => parseIssue(readFileSync(new URL(`${month}.md`, fixtures), 'utf8'), month);
const now = new Date('2026-11-03T06:00:00Z');
const site = { siteUrl: 'https://kahvedrop.test', now };
const empty: DigestInput = { DEAL: [], PRICE_DROP: [], NEW: [], RESTOCKED: [] };
function coffee(id: string, events: CoffeeEvent[] = []): CatalogCoffee {
  return { id, name: `Kahve ${id}`, slug: `kahve-${id}`, canonicalUrl: `https://shop.test/${id}`, sourceUrl: null, sourceProductId: id, roaster: { id: 'r', slug: 'r', name: 'Kavurucu', websiteUrl: 'https://shop.test', city: null },
    rawMetadata: {}, features: [], latestEvents: events, firstSeenAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-04T00:00:00Z', discontinuedAt: null, stale: false,
    offers: [{ id, coffeeId: id, sourceVariantId: null, label: null, weightG: 250, currency: 'TRY', priceMinor: 90000, compareAtMinor: null, inStock: true, purchaseUrl: null, unitPriceTry: null, firstSeenAt: '2026-09-01T00:00:00Z', lastSeenAt: '2026-10-04T00:00:00Z', lastPriceChangeAt: null, variantOfferIds: [`${id}-sku`] }] };
}
const drop = (id: string): CoffeeEvent => ({ id: `${id}-drop`, coffeeId: id, offerId: `${id}-sku`, type: 'PRICE_DROP', createdAt: '2026-10-20T00:00:00Z', before: { priceMinor: 100000, currency: 'TRY', weightG: 250 }, after: { priceMinor: 90000, currency: 'TRY', weightG: 250 }, idempotencyKey: 'k', observationId: 'o' });
const listedPicks = (picks: { slug: string; note: ResolvedPick['note'] }[]): ResolvedPick[] => picks.map(pick => ({ ...pick, name: `Kahve ${pick.slug}`, coffee: coffee(pick.slug.replace('kahve-', '')), status: 'listed' }));

test('parses the issue format: front matter, picks with notes, paragraphs, continuation lines and scene links', () => {
  const issue = fixture('2026-11');
  assert.equal(issue.published, true);
  assert.equal(issue.title, 'Sonbaharın <em>meyveli</em> kahveleri');
  assert.equal(issue.intro, 'Bu ay "üç" kahve & bir festival.');
  assert.deepEqual(issue.picks.map(pick => pick.slug), ['kahve-a', 'kahve-gone', 'kahve-sold']);
  assert.deepEqual(issue.picks[1].note, [{ text: 'Artık satışta değil ama hâlâ aklımda.' }]);
  assert.deepEqual(issue.picks[2].note[1], { text: 'rehbere', href: '/guide' });
  assert.deepEqual(issue.picksText, [[{ text: 'Bu ay üç kahve öne çıktı.' }]]);
  assert.equal(issue.scene.length, 2);
  assert.deepEqual(issue.scene[1][1], { text: 'Kaynak', href: 'https://haber.test/x?a=1&b=2' });
  assert.equal(issue.sponsor, undefined);
  assert.deepEqual(fixture('2027-01').sponsor, { name: 'Kavurucu & Co', description: 'Yeni hasat <b>Kenya</b> geldi.', link: 'https://www.sponsor.test/kenya?ref=1', host: 'www.sponsor.test' });
  // The owner's template must always be a valid, unpublished file.
  const template = parseIssue(readFileSync(new URL('../content/bulten/_template.md', import.meta.url), 'utf8'), '2026-01');
  assert.equal(template.published, false);
  assert.ok(template.picks.length && template.scene.length);
});

test('malformed issue files fail with the file, line and what to fix', () => {
  const head = 'subject: S\ntitle: T\nintro: I\npublished: true';
  const body = '## Bu ayın favorileri\n\n- kahve-a: Not.\n\n## Sahneden\n\n- Haber. [Kaynak](https://haber.test)\n';
  const file = (front: string, text = body) => `---\n${front}\n---\n\n${text}`;
  const cases: [string, RegExp][] = [
    [body, /satır 1: Dosya "---"/],
    [`---\n${head}\n\n${body}`, /ikinci bir "---"/],
    [file(`${head}\npublshed: true`), /satır 6: Bilinmeyen alan "publshed"/],
    [file(head.replace('published: true', 'published: evet')), /"published" alanı "true" ya da "false"/],
    [file(head.replace('title: T', 'title:')), /"title" alanı eksik/],
    [file(head, body.replace('## Sahneden', '## Etkinlikler')), /satır 12: Bilinmeyen başlık "Etkinlikler"/],
    [file(head, body.replace('## Sahneden', '# Sahneden')), /Yalnızca "## Bu ayın favorileri"/],
    [file(head, body.replace('- Haber. [Kaynak](https://haber.test)', '- Kaynaksız haber.')), /satır 14: Her sahne haberinde en az bir kaynak/],
    [file(head, body.replace('- kahve-a: Not.', '- kahve-a')), /satır 10: Favori satırı/],
    [file(head, body.replace('- kahve-a: Not.', '- ../etc: Not.')), /slug'ı gibi görünmüyor/],
    [file(head, body.replace('(https://haber.test)', '(javascript:alert(1))')), /https:\/\/ ya da \/ ile başlamalı/],
    [file(head, `Giriş metni\n\n${body}`), /satır 8: Metin bir başlığın altında/],
    [file(head, body.split('## Sahneden')[0]), /"## Sahneden" bölümü eksik/],
    [file(head, '## Bu ayın favorileri\n\n## Sahneden\n\n- H [K](https://k.test)\n'), /En az bir favori/],
    [file(`${head}\nsponsor:\n  name: N\n  description: D\n  link: https://evil.test/x\n  host: sponsor.test`), /Sponsor bağlantısı https:\/\/ ile başlamalı ve tam olarak "sponsor.test"/],
    [file(`${head}\nsponsor:\n  name: N\n  link: https://sponsor.test/x\n  host: sponsor.test`), /Sponsor alanı "description" eksik/],
    [file(`${head}\n  name: N`), /Girintili satırlar yalnızca "sponsor:" altında/],
  ];
  for (const [raw, message] of cases) assert.throws(() => parseIssue(raw, '2026-11', 'content/bulten/2026-11.md'), (error: Error) => error instanceof IssueFormatError && message.test(error.message) && error.message.startsWith('content/bulten/2026-11.md, satır'), String(message));
});

test('unpublished issues are never bundled for the site and can never be drafted', () => {
  const files = [...readdirSync(fixtures), '_template.md'].map(name => ({ name, raw: readFileSync(new URL(name === '_template.md' ? '../content/bulten/_template.md' : name, name === '_template.md' ? import.meta.url : fixtures), 'utf8') }));
  assert.deepEqual(bundleIssues(files, { drafts: false }).map(issue => issue.month), ['2027-01', '2026-11'], 'production build: published only, newest first, template ignored');
  assert.deepEqual(bundleIssues(files, { drafts: true }).map(issue => issue.month), ['2027-01', '2026-12', '2026-11'], 'local preview includes drafts');
  const draft = fixture('2026-12');
  assert.throws(() => buildIssueEmail(draft, listedPicks(draft.picks), empty, site), /not "published: true"/);
  // The workflow runs the script, which reads the file itself and refuses the same way before any Kit call.
  assert.match(readFileSync(new URL('../scripts/v2-digest.mts', import.meta.url), 'utf8'), /if \(!issue\.published\) throw new Error\(`\$\{file\} is not "published: true"; refusing/);
});

test('a pick whose coffee is gone still shows the name and note, marked unavailable, without breaking', async () => {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'r', slug: 'roaster', name: 'Roaster', websiteUrl: 'https://shop.test', adapter: 'test' });
  const product = (id: string): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Coffee ${id}`, visibility: 'public', rawMetadata: { country: 'Ethiopia' },
    offers: [{ sourceVariantId: `sku-${id}`, label: '250g', weightG: 250, price: 100, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${id}` }] });
  await ingestCrawl(db, { id: 'run', roasterId: 'r', startedAt: '2026-10-01T00:00:00Z', completedAt: '2026-10-01T00:01:00Z', status: 'success', parserVersion: 'test', products: [product('a'), product('b')], diagnostics: [], mode: 'baseline' });
  db.sqlite.exec(`UPDATE coffees SET discontinued_at='2026-10-02' WHERE source_product_id='b'`);
  const slug = (id: string) => String(db.sqlite.prepare('SELECT slug FROM coffees WHERE source_product_id=?').get(id)?.slug);
  const note = (text: string) => [{ text }];
  const picks = await resolvePicks(db, [{ slug: slug('a'), note: note('Listede.') }, { slug: slug('b'), note: note('Bitti.') }, { slug: 'silinmis-kahve', note: note('Hiç yok.') }]);
  assert.deepEqual(picks.map(pick => [pick.status, pick.name]), [['listed', 'Coffee a'], ['gone', 'Coffee b'], ['gone', 'Silinmis Kahve']]);
  assert.equal(picks[2].coffee, null);
  // Without a database (the page's fallback when the read fails) every pick keeps its note.
  assert.deepEqual((await resolvePicks(null, [{ slug: 'x-y', note: note('N') }])).map(pick => [pick.status, pick.name, pick.note[0].text]), [['unknown', 'X Y', 'N']]);
  const issue = fixture('2026-11');
  const html = buildIssueEmail(issue, picks, empty, site).html;
  assert.match(html, /Silinmis Kahve<\/p><p[^>]*>Artık satışta değil<\/p><p[^>]*>Hiç yok\.<\/p>/);
  assert.match(html, /Coffee b<\/a><\/p><p[^>]*>Artık satışta değil/);
  assert.match(html, /Coffee a<\/a><\/p><p[^>]*>250 g · 100 TL<\/p>/);
  assert.doesNotMatch(html, /silinmis-kahve/, 'a coffee that no longer exists gets no link');
  db.sqlite.close();
});

test('email escapes owner text, tags every site link and keeps the section order', () => {
  const issue = fixture('2026-11');
  const email = buildIssueEmail(issue, listedPicks(issue.picks), { ...empty, PRICE_DROP: [coffee('d', [drop('d')])], NEW: [coffee('n')] }, site);
  const { html } = email;
  assert.equal(email.subject, 'KahveDrop Mektup · Kasım 2026: Guji & <Nyeri>', 'Kit receives the subject as data, not HTML');
  assert.equal(email.description, `${brand.monthlyName} 2026-11 (otomatik taslak)`);
  assert.doesNotMatch(html, /<script|<em>|<b>/);
  assert.match(html, /Sonbaharın &lt;em&gt;meyveli&lt;\/em&gt; kahveleri/);
  assert.match(html, /Bu ay &quot;üç&quot; kahve &amp; bir festival\./);
  assert.match(html, /Yaban mersini &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; bergamot\./);
  assert.match(html, /İzmir&#39;de kahve festivali/);
  const tags = 'utm_source=kahvedrop&amp;utm_medium=newsletter&amp;utm_campaign=2026-11';
  assert.match(html, new RegExp(`href="https://kahvedrop\\.test/kahve/kahve-a\\?${tags}"`));
  assert.match(html, new RegExp(`href="https://kahvedrop\\.test/kahve/kahve-n\\?${tags}"`), 'automated sections use the issue tags');
  assert.match(html, new RegExp(`href="https://kahvedrop\\.test/guide\\?${tags}"`), 'site paths in owner text become tagged absolute links');
  assert.match(html, new RegExp(`href="https://kahvedrop\\.test/bulten/2026-11\\?${tags}"`));
  assert.match(html, /href="https:\/\/shop\.test\/a"/, 'links to other sites stay as written');
  assert.match(html, /href="https:\/\/haber\.test\/x\?a=1&amp;b=2"/);
  const siteLinks = [...html.matchAll(/href="(https:\/\/kahvedrop\.test[^"]*)"/g)].map(match => match[1]);
  assert.ok(siteLinks.length >= 6 && siteLinks.every(link => link.endsWith(tags)), 'every link back to the site is tagged');
  const at = (text: string) => html.indexOf(text);
  assert.ok(at('Bu ayın favorileri') < at('Sahneden') && at('Sahneden') < at('Fiyatı düşenler') && at('Fiyatı düşenler') < at('Yeni gelenler'));
  assert.match(html, /Fiyatı düştü: 1\.000 TL → 900 TL/);
  assert.doesNotMatch(html, /\/ 100 g|100 g başına/, 'no price per 100 g');
  assert.doesNotMatch(html, /<link|<style|class=/, 'inline styles only');
});

test('sponsor link: https on exactly the trusted host, tagged, labelled, and only with the flag on', () => {
  const sponsor = { name: 'S', description: 'D', link: 'https://www.sponsor.test/kenya?ref=1', host: 'www.sponsor.test' };
  assert.equal(trustedSponsorUrl(sponsor)?.toString(), 'https://www.sponsor.test/kenya?ref=1');
  for (const link of ['http://www.sponsor.test/', 'https://sponsor.test/', 'https://www.sponsor.test.evil.test/', 'https://evil.test/?www.sponsor.test', 'https://user@www.sponsor.test/', 'https://www.sponsor.test:8443/', 'javascript:alert(1)', 'not a url'])
    assert.equal(trustedSponsorUrl({ ...sponsor, link }), null, link);
  assert.equal(campaignUrl(trustedSponsorUrl(sponsor)!, '2027-01'), 'https://www.sponsor.test/kenya?ref=1&utm_source=kahvedrop&utm_medium=newsletter&utm_campaign=2027-01');

  const issue = fixture('2027-01');
  const previous = process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED;
    assert.doesNotMatch(buildIssueEmail(issue, listedPicks(issue.picks), empty, site).html, /Sponsorlu|sponsor\.test/, 'flag off: no sponsor block');
    process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED = 'true';
    const html = buildIssueEmail(issue, listedPicks(issue.picks), empty, site).html;
    assert.match(html, />Sponsorlu</);
    assert.match(html, /Kavurucu &amp; Co/);
    assert.match(html, /Yeni hasat &lt;b&gt;Kenya&lt;\/b&gt; geldi\./);
    assert.match(html, /href="https:\/\/www\.sponsor\.test\/kenya\?ref=1&amp;utm_source=kahvedrop&amp;utm_medium=newsletter&amp;utm_campaign=2027-01"/);
    assert.ok(html.indexOf('Sahneden') < html.indexOf('Sponsorlu'));
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED; else process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED = previous; }
});

test('a sponsor changes the order of nothing else: catalog listings, quiz ranking, the issue\'s automated sections', async () => {
  const previous = process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED;
  process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED = 'true';
  try {
    // Issue: the same issue with and without a sponsor (one of whose coffees is in every list) lists the same coffees in the same order.
    const sponsored = fixture('2027-01');
    const plain = { ...sponsored, sponsor: undefined };
    const input = { ...empty, PRICE_DROP: [coffee('d', [drop('d')]), coffee('s', [drop('s')])], NEW: [coffee('n'), coffee('s')] };
    const links = (html: string) => [...html.matchAll(/\/kahve\/([^?"]+)/g)].map(match => match[1]);
    const withSponsor = buildIssueEmail(sponsored, listedPicks(sponsored.picks), input, site), without = buildIssueEmail(plain, listedPicks(plain.picks), input, site);
    assert.match(withSponsor.html, /Sponsorlu/);
    assert.deepEqual(links(withSponsor.html), links(without.html));
    assert.deepEqual(withSponsor.sections, without.sections);
    assert.equal(withSponsor.html.replace(/<div style="margin:32px 0 0;padding:20px;border:1px solid #dedfd7;background:#ffffff">.*?<\/a><\/div>/, ''), without.html, 'the sponsor block is the only difference');

    // Catalog listings: same order with the flag on and a sponsor naming the roaster; listing code never reads sponsor data.
    const db = new TestCatalogDatabase();
    await registerRoaster(db, { id: 'r', slug: 'roaster', name: 'Roaster', websiteUrl: 'https://shop.test', adapter: 'test' });
    const product = (id: string, price: number): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Coffee ${id}`, visibility: 'public', rawMetadata: { country: 'Ethiopia' },
      offers: [{ sourceVariantId: `sku-${id}`, label: '250g', weightG: 250, price, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${id}` }] });
    await ingestCrawl(db, { id: 'run', roasterId: 'r', startedAt: '2026-10-01T00:00:00Z', completedAt: '2026-10-01T00:01:00Z', status: 'success', parserVersion: 'test', products: [product('a', 300), product('b', 100), product('c', 200)], diagnostics: [], mode: 'baseline' });
    const order = async () => (await listCatalog(db, { sort: 'price_asc' })).coffees.map(c => c.sourceProductId);
    const flagOn = await order();
    delete process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED;
    assert.deepEqual(await order(), flagOn);
    db.sqlite.close();

    // Quiz ranking: a sponsored marker on a candidate changes nothing.
    const candidates: QuizCandidate[] = ['x', 'y', 'z'].map((id, index) => ({ id, roasterId: `r${index}`, firstSeenAt: `2026-10-0${index + 1}T00:00:00Z`, raw: { country: 'Ethiopia', process: index ? 'washed' : 'natural', tastingNotes: ['bergamot'] }, features: [] }));
    const answers = { brew: [], taste: ['fruity'], roast: [], process: ['natural'] };
    assert.deepEqual(rankCandidates(answers, candidates.map((c, i) => ({ ...c, sponsored: i === 2 })), 3), rankCandidates(answers, candidates, 3));

    for (const path of ['shared/v2/catalog.ts', 'shared/v2/quiz-rank.ts', 'shared/v2/public-catalog.ts'])
      assert.doesNotMatch(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /sponsor/i, `${path} must not read sponsor data (comments aside)`);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED; else process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED = previous; }
});

test('Kit: the monthly draft is unscheduled, never sent, and not duplicated on a re-run', async () => {
  const issue = fixture('2026-11');
  const email = buildIssueEmail(issue, listedPicks(issue.picks), empty, site);
  const stub = (pages: unknown[], status = 200) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: URL | string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init.method === 'POST') return new Response(JSON.stringify({ broadcast: { id: 77 } }), { status: 201 });
      return new Response(JSON.stringify(pages.shift()), { status });
    }) as typeof fetch;
    return { calls, fetcher };
  };
  const created = stub([{ broadcasts: [{ id: 1, description: 'Haftalık Drop 2026-10-26 (otomatik taslak)' }], pagination: { has_next_page: true, end_cursor: 'c1' } }, { broadcasts: [], pagination: { has_next_page: false } }]);
  assert.deepEqual(await createIssueDraft(email, 'test-key', created.fetcher), { id: 77, existing: false });
  assert.deepEqual(created.calls.map(call => [call.init.method ?? 'GET', call.url]), [['GET', 'https://api.kit.com/v4/broadcasts?per_page=500'], ['GET', 'https://api.kit.com/v4/broadcasts?per_page=500&after=c1'], ['POST', 'https://api.kit.com/v4/broadcasts']]);
  assert.ok(created.calls.every(call => call.init.redirect === 'manual' && (call.init.headers as Record<string, string>)['X-Kit-Api-Key'] === 'test-key'));
  const body = JSON.parse(created.calls[2].init.body as string);
  assert.equal(body.send_at, null);
  assert.equal(body.public, false);
  assert.equal(body.description, `${brand.monthlyName} 2026-11 (otomatik taslak)`);
  assert.equal(body.content, email.html);

  const rerun = stub([{ broadcasts: [{ id: 77, description: `${brand.monthlyName} 2026-11 (otomatik taslak)` }], pagination: { has_next_page: false } }]);
  assert.deepEqual(await createIssueDraft(email, 'test-key', rerun.fetcher), { id: 77, existing: true });
  assert.equal(rerun.calls.filter(call => call.init.method === 'POST').length, 0);

  const redirected = stub([{}], 302);
  await assert.rejects(createIssueDraft(email, 'test-key', redirected.fetcher), /HTTP 302/);
  assert.equal(redirected.calls.length, 1, 'no draft is created when Kit cannot be checked');
});
