import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { rankCandidates, rankQuizMatches, scoreCandidate, type QuizAnswers, type QuizCandidate } from '../shared/v2/quiz-rank';
import type { FeatureValue, RawMetadata, SourceCoffee } from '../shared/v2/types';
import { formatQuizReason, loadTasteProfile, parseMatchLimit, parseQuizAnswers, quizResultUrl, saveTasteProfile, TASTE_STORAGE_KEY } from '@/lib/quiz-filters';
import { sanitizeSubscribeReferrer } from '@/lib/v2-subscribe';
import { GET } from '../src/app/api/quiz/match/route';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

const answers = (input: Partial<QuizAnswers> = {}): QuizAnswers => ({ brew: [], taste: [], roast: [], process: [], ...input });
const inferred = (feature: string, value: FeatureValue['value']) => ({ feature, value, sourceType: 'RULE_INFERRED' as const });
let day = 0;
const coffee = (id: string, input: { raw?: RawMetadata; features?: QuizCandidate['features']; roaster?: string } = {}): QuizCandidate =>
  ({ id, roasterId: input.roaster ?? id, firstSeenAt: `2026-01-${String(10 + (day++ % 15)).padStart(2, '0')}T00:00:00.000Z`, raw: input.raw ?? {}, features: input.features ?? [] });

test('a skipped step ("Fark etmez") is left out of the score entirely', () => {
  const darkStated = coffee('dark', { raw: { roast: 'Koyu' }, features: [inferred('flavor_families', ['Fruity'])] });
  const noRoast = coffee('none', { features: [inferred('flavor_families', ['Fruity'])] });
  const onlyTaste = answers({ taste: ['Fruity'] });
  assert.equal(scoreCandidate(onlyTaste, darkStated).score, scoreCandidate(onlyTaste, noRoast).score);
  assert.deepEqual(scoreCandidate(onlyTaste, darkStated).reasons.map(reason => reason.dimension), ['taste']);
  assert.equal(scoreCandidate(answers(), darkStated).score, 0);
});

test('missing data and inferred mismatches are neutral; a stated mismatch subtracts', () => {
  const want = answers({ roast: ['light'], process: ['washed'] });
  const unknown = scoreCandidate(want, coffee('unknown'));
  const inferredWrong = scoreCandidate(want, coffee('inferred', { features: [inferred('roast_classification', 'dark'), inferred('process_family', 'natural')] }));
  const statedWrong = scoreCandidate(want, coffee('stated', { raw: { roast: 'Koyu kavrum', process: 'Natural' } }));
  assert.equal(unknown.score, 0);
  assert.equal(inferredWrong.score, 0);
  assert.ok(statedWrong.score < 0);
  assert.deepEqual(unknown.reasons.map(reason => formatQuizReason(reason).text), ['Kavrum bilgisi yok', 'İşlem bilgisi yok']);
  assert.deepEqual(inferredWrong.reasons, [], 'an inferred mismatch makes no claim');
  assert.equal(formatQuizReason(statedWrong.reasons[0]).text, 'Koyu kavrum, seçiminden farklı');
});

test('stated facts outweigh inferred ones, and a MANUAL correction outranks both', () => {
  const want = answers({ process: ['washed'] });
  const labelled = scoreCandidate(want, coffee('labelled', { raw: { process: 'Yıkanmış' } }));
  const guessed = scoreCandidate(want, coffee('guessed', { features: [inferred('process_family', 'washed')] }));
  const manual = scoreCandidate(want, coffee('manual', { features: [{ feature: 'process_family', value: 'washed', sourceType: 'MANUAL' }, inferred('process_family', 'natural')] }));
  assert.ok(manual.score > labelled.score && labelled.score > guessed.score && guessed.score > 0);
  assert.deepEqual([labelled, guessed, manual].map(entry => formatQuizReason(entry.reasons[0]).source), ['kavurucu belirtiyor', 'açıklamadan çıkarıldı', 'doğrulanmış düzeltme']);
  // A stated value is never overridden by a guess that happens to agree with the visitor.
  const stated = scoreCandidate(want, coffee('stated', { raw: { process: 'Natural' }, features: [inferred('process_family', 'washed')] }));
  assert.ok(stated.score < 0);
});

test('a neighbouring roast is a near miss, a blanket "every method" brew list says nothing', () => {
  const want = answers({ roast: ['light'], brew: ['espresso'] });
  const near = scoreCandidate(want, coffee('near', { features: [inferred('roast_classification', 'medium_light')] }));
  assert.equal(formatQuizReason(near.reasons[0]).text, 'Orta-Açık kavrum, seçimine yakın');
  assert.ok(near.score > 0 && !near.exact);
  const blanket = scoreCandidate(want, coffee('blanket', { features: [inferred('brew_compatibility', ['espresso', 'filter', 'french_press', 'aeropress', 'turkish', 'cold_brew', 'moka_pot'])] }));
  assert.equal(blanket.reasons.find(reason => reason.dimension === 'brew')?.kind, 'missing');
});

test('at most two coffees per roaster, filled from the same order when the catalog is small', () => {
  const want = answers({ taste: ['Fruity'] });
  const fruity = [inferred('flavor_families', ['Fruity'])];
  const big = Array.from({ length: 5 }, (_, index) => coffee(`big-${index}`, { roaster: 'big', features: fruity }));
  const others = ['a', 'b', 'c'].map(id => coffee(id, { roaster: id }));
  const top = rankCandidates(want, [...big, ...others], 5);
  assert.equal(top.filter(entry => entry.id.startsWith('big')).length, 2);
  assert.equal(top.length, 5);
  assert.equal(rankCandidates(want, big, 4).length, 4, 'one roaster alone still fills the list');
});

test('the result is never empty while the catalog has coffees, and says when nothing matches', () => {
  const candidates = [coffee('x', { raw: { roast: 'Koyu' } }), coffee('y'), coffee('z', { features: [inferred('flavor_families', ['Nutty'])] })];
  const top = rankCandidates(answers({ taste: ['Floral'], roast: ['light'] }), candidates, 8);
  assert.equal(top.length, 3);
  assert.equal(top.some(entry => entry.exact), false);
  assert.equal(top.at(-1)?.id, 'x', 'the stated clash ranks last, but still shows');
  assert.deepEqual(rankCandidates(answers({ taste: ['Floral'] }), [], 8), []);
});

test('ranking depends only on the answers and the coffee data', () => {
  const want = answers({ brew: ['filter'], taste: ['Fruity', 'Floral'], roast: ['light'], process: ['washed'] });
  const pool = Array.from({ length: 30 }, (_, index) => coffee(`c${index}`, { roaster: `r${index % 7}`, raw: index % 3 ? { process: index % 2 ? 'Washed' : 'Natural' } : {},
    features: [inferred('flavor_families', index % 2 ? ['Fruity', 'Floral'] : ['Chocolate']), inferred('roast_classification', ['light', 'medium', 'dark'][index % 3]), inferred('brew_compatibility', index % 4 ? ['filter'] : ['espresso'])] }));
  const expected = rankCandidates(want, pool, 8).map(entry => entry.id);
  // Input order, popularity, clicks and sponsorship flags must change nothing.
  const decorated = pool.map((candidate, index) => ({ ...candidate, sponsored: index === 29, clicks: 1000 - index, popularity: index }));
  assert.deepEqual(rankCandidates(want, [...decorated].reverse(), 8).map(entry => entry.id), expected);
  assert.deepEqual(rankCandidates(want, [...pool].sort((a, b) => a.id.length - b.id.length || b.id.localeCompare(a.id)), 8).map(entry => entry.id), expected);
  assert.deepEqual(rankCandidates(want, pool, 8), rankCandidates(want, pool, 8));
});

test('rankQuizMatches reads the public view, applies MANUAL corrections and hydrates only the winners', async () => {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'r', slug: 'roaster', name: 'Roaster', websiteUrl: 'https://shop.test', adapter: 'test' });
  const product = (id: string, rawMetadata: RawMetadata, features: FeatureValue[] = []): SourceCoffee => ({ sourceProductId: id, canonicalUrl: `https://shop.test/${id}`, name: `Coffee ${id}`, visibility: 'public', rawMetadata, features,
    offers: [{ sourceVariantId: `sku-${id}`, label: '250g', weightG: 250, price: 500, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: `https://shop.test/${id}` }] });
  const feature = (name: string, value: FeatureValue['value']): FeatureValue => ({ feature: name, value, sourceType: 'RULE_INFERRED', confidence: null, version: 'test' });
  await ingestCrawl(db, { id: 'run1', roasterId: 'r', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', status: 'success', parserVersion: 'test', diagnostics: [],
    products: [product('washed', { process: 'Washed' }), product('corrected', { process: 'Washed' }), product('guess', {}, [feature('process_family', 'washed')]), product('hidden', { process: 'Washed' })] });
  const id = (sourceId: string) => (db.sqlite.prepare('SELECT id FROM coffees WHERE source_product_id=?').get(sourceId) as { id: string }).id;
  db.sqlite.prepare("UPDATE coffees SET visibility='hidden' WHERE id=?").run(id('hidden'));
  db.sqlite.prepare('INSERT INTO coffee_feature_values VALUES(?,?,?,?,?,?,?,?,?)').run(id('corrected'), 'process_family', '"natural"', 'MANUAL', 1, 'manual-v1', 'review', '2026-01-02', '2026-01-02');
  const result = await rankQuizMatches(db, answers({ process: ['washed'] }), 8);
  assert.equal(result.total, 3);
  assert.deepEqual(result.coffees.map(entry => entry.sourceProductId), ['washed', 'guess', 'corrected']);
  assert.equal(result.coffees[2].quizReasons[0].kind, 'conflict', 'the reviewed correction beats the raw label');
  assert.equal(result.coffees[0].offers[0].priceMinor, 50000, 'winners are fully hydrated');
  db.sqlite.close();
});

test('answers parse from the URL safely and round-trip to a readable result link', () => {
  const parsed = parseQuizAnswers(new URLSearchParams('brew=filter,filter,espresso&taste=floral,Fruity,Unknown&roast=light&process=<script>&extra=1'));
  assert.deepEqual(parsed, { brew: ['espresso', 'filter'], taste: ['Fruity', 'Floral'], roast: ['light'], process: [] });
  assert.equal(quizResultUrl(parsed), '/quiz/sonuc?brew=espresso,filter&taste=Fruity,Floral&roast=light');
  assert.equal(quizResultUrl(answers()), '/quiz/sonuc');
  assert.deepEqual(parseQuizAnswers({ taste: ['Nutty', 'Herbal'], roast: 'x'.repeat(400) }), answers({ taste: ['Nutty', 'Herbal'] }));
});

test('the match endpoint validates and bounds its parameters', async () => {
  assert.equal(parseMatchLimit(null), 4);
  assert.equal(parseMatchLimit('12'), 12);
  assert.equal(parseMatchLimit('999'), 12);
  assert.equal(parseMatchLimit('0'), 1);
  for (const bad of ['-3', '2.5', 'abc', '1e3', '']) assert.equal(parseMatchLimit(bad), 4);
  const tooLong = await GET(new Request(`https://kahvedrop.test/api/quiz/match?taste=${'Fruity,'.repeat(200)}`));
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.headers.get('Cache-Control'), 'no-store');
  // No catalog binding under test: the endpoint fails closed with JSON, like /api/catalog.
  const unavailable = await GET(new Request('https://kahvedrop.test/api/quiz/match?taste=Fruity&limit=50'));
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: 'Katalog şu anda yüklenemiyor.' });
});

test('the taste profile is stored on the device only, and broken storage never throws', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) } as Storage;
  saveTasteProfile(answers({ brew: ['filter'], taste: ['Fruity'] }), storage);
  const saved = JSON.parse(store.get(TASTE_STORAGE_KEY)!);
  assert.deepEqual(Object.keys(saved), ['brew', 'taste', 'roast', 'process', 'savedAt']);
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
  assert.deepEqual(loadTasteProfile(storage), answers({ brew: ['filter'], taste: ['Fruity'] }));
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } } as unknown as Storage;
  assert.doesNotThrow(() => saveTasteProfile(answers(), broken));
  assert.equal(loadTasteProfile(broken), null);
  store.set(TASTE_STORAGE_KEY, '{not json');
  assert.equal(loadTasteProfile(storage), null);
});

test('a signup from the result page never carries the answers to the newsletter provider', () => {
  const referrer = sanitizeSubscribeReferrer('https://kahvedrop.test/quiz/sonuc?brew=filter&taste=Fruity,Floral', 'https://kahvedrop.test/api/subscribe', 'quiz');
  assert.equal(referrer, 'https://kahvedrop.test/quiz/sonuc?utm_content=quiz');
});

test('a MANUAL brew correction listing many methods still counts; only non-manual blanket guesses are ignored', () => {
  const all = ['espresso', 'filter', 'french_press', 'aeropress', 'turkish'];
  const manual = coffee('manual-brew', { features: [{ feature: 'brew_methods', value: all, sourceType: 'MANUAL' }] });
  const guessed = coffee('guessed-brew', { features: [inferred('brew_methods', all)] });
  const want = answers({ brew: ['filter'] });
  assert.deepEqual(scoreCandidate(want, manual).reasons.map(reason => [reason.kind, reason.provenance]), [['match', 'manual']]);
  assert.deepEqual(scoreCandidate(want, guessed).reasons.map(reason => reason.kind), ['missing']);
});

test('a MANUAL correction of the tasting notes silences inferred flavour families in the quiz, as it does in the filters', async () => {
  const db = new TestCatalogDatabase();
  await registerRoaster(db, { id: 'r', slug: 'roaster', name: 'Roaster', websiteUrl: 'https://shop.test', adapter: 'test' });
  await ingestCrawl(db, { id: 'run1', roasterId: 'r', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', status: 'success', parserVersion: 'test', diagnostics: [],
    products: [{ sourceProductId: 'a', canonicalUrl: 'https://shop.test/a', name: 'Coffee a', visibility: 'public', rawMetadata: {},
      features: [{ feature: 'flavor_families', value: ['Fruity'], sourceType: 'RULE_INFERRED', confidence: null, version: 'test' }],
      offers: [{ sourceVariantId: 'sku-a', label: '250g', weightG: 250, price: 500, compareAtPrice: null, currency: 'TRY', inStock: true, purchaseUrl: 'https://shop.test/a' }] }] });
  const id = (db.sqlite.prepare("SELECT id FROM coffees WHERE source_product_id='a'").get() as { id: string }).id;
  assert.equal((await rankQuizMatches(db, answers({ taste: ['Fruity'] }), 4)).coffees[0].quizReasons[0].kind, 'match');
  db.sqlite.prepare('INSERT INTO coffee_feature_values VALUES(?,?,?,?,?,?,?,?,?)').run(id, 'flavor_notes_normalized', 'null', 'MANUAL', 1, 'corrections', 'review', '2026-01-02', '2026-01-02');
  assert.deepEqual((await rankQuizMatches(db, answers({ taste: ['Fruity'] }), 4)).coffees[0].quizReasons.map(reason => reason.kind), ['missing']);
  db.sqlite.close();
});
