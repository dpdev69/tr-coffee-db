import { canonicalCountry, countryLabel, isKnownCountry } from '../../shared/v2/country-labels';
import { hydrate, listedRows, listRoasters, similarityCandidates, type CatalogCoffee } from '../../shared/v2/catalog';
import { coffeeOnlySql } from '../../shared/v2/coffee-eligibility';
import type { CatalogDatabase } from '../../shared/v2/database';
import { scoredCandidates } from '../../shared/v2/quiz-rank';
import { BREW_METHOD_LABELS, FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS } from './constants/filter-options';
import { originLanding, processLanding } from './catalog-landing';

/**
 * Written "X mı Y mi" pages (/karsilastir/<slug>): a fixed list, never built from a query, so they cannot become a crawlable
 * space of combinations the way /compare would (that tool stays noindex and out of robots.txt). Every number on them comes
 * from one derived result (comparisonFacts), computed once per refresh from the derived candidate lists and one price query;
 * a page view reads that result (2 rows) or the edge copy (none).
 *
 * Pairs follow real searches (Google autocomplete, 19 Oct 2026): origin pairs and espresso/filter have "mı ... mı" queries;
 * the roaster pairs have brand searches only. docs/comparisons.md has the evidence and how to add a pair.
 */
export type SideRef =
  | { kind: 'origin'; value: string }
  | { kind: 'process'; value: string }
  | { kind: 'brew'; value: 'espresso' | 'filter' }
  | { kind: 'roaster'; slug: string; name: string };
export interface Comparison { slug: string; a: SideRef; b: SideRef; group: 'koken' | 'islem' | 'demleme' | 'kavurucu'; intro: string }

export const COMPARISONS: readonly Comparison[] = [
  { slug: 'etiyopya-vs-kolombiya', group: 'koken', a: { kind: 'origin', value: 'Ethiopia' }, b: { kind: 'origin', value: 'Colombia' },
    intro: 'Etiyopya ve Kolombiya, çekirdek seçerken sık karşılaştırılan iki köken. Etiyopya çekirdekleri çoğunlukla çiçeksi ve meyvemsi notalarıyla, Kolombiya çekirdekleri daha dengeli ve tatlı profilleriyle bilinir. Aşağıdaki tablo bu genellemeyi bugün satışta olan çekirdeklerle sınar.' },
  { slug: 'kolombiya-vs-brezilya', group: 'koken', a: { kind: 'origin', value: 'Colombia' }, b: { kind: 'origin', value: 'Brazil' },
    intro: 'Brezilya çekirdekleri çoğunlukla kuruyemiş ve çikolata notalarıyla anılır ve espresso harmanlarında sık kullanılır. Kolombiya çekirdekleri hem filtrede hem espressoda karşımıza çıkar. Tablo, iki kökenin bugün satıştaki çekirdeklerini yan yana koyar.' },
  { slug: 'kenya-vs-kolombiya', group: 'koken', a: { kind: 'origin', value: 'Kenya' }, b: { kind: 'origin', value: 'Colombia' },
    intro: 'Kenya çekirdekleri çoğunlukla canlı asidite ve kırmızı meyve notalarıyla tanınır; Kolombiya daha geniş bir yelpazede, dengeli profillerle gelir. Aşağıdaki rakamlar iki kökenden bugün satışta olan çekirdeklerden derlendi.' },
  { slug: 'kenya-vs-etiyopya', group: 'koken', a: { kind: 'origin', value: 'Kenya' }, b: { kind: 'origin', value: 'Ethiopia' },
    intro: 'Kenya ve Etiyopya, Doğu Afrika’nın iki kahve kökeni. İkisi de meyvemsi fincanlarıyla bilinir; fark çoğunlukla işlem yönteminde ve meyvenin türündedir. Tablo, bugün satıştaki çekirdeklerde bu farkın nasıl göründüğünü gösterir.' },
  { slug: 'guatemala-vs-kolombiya', group: 'koken', a: { kind: 'origin', value: 'Guatemala' }, b: { kind: 'origin', value: 'Colombia' },
    intro: 'Guatemala ve Kolombiya, Latin Amerika’nın yüksek rakımlı iki kökeni. Guatemala çekirdekleri çoğunlukla çikolata ve baharat notalarıyla, Kolombiya çekirdekleri meyve ve karamel tatlılığıyla anılır. Rakamlar bugün satıştaki çekirdeklerden.' },
  { slug: 'naturel-vs-yikanmis', group: 'islem', a: { kind: 'process', value: 'natural' }, b: { kind: 'process', value: 'washed' },
    intro: 'Natürel işlemde kahve meyvesi çekirdeğin üzerinde kurutulur; fincanda genellikle daha belirgin meyve ve fermente tatlar çıkar. Yıkanmış işlemde meyve kurutmadan önce ayrılır; fincan çoğunlukla daha temiz ve berrak olur. Tablo iki işlemi bugün satıştaki çekirdeklerle karşılaştırır.' },
  { slug: 'espresso-vs-filtre', group: 'demleme', a: { kind: 'brew', value: 'espresso' }, b: { kind: 'brew', value: 'filter' },
    intro: 'Espresso için kavurucular çoğunlukla daha gövdeli, çikolata ve kuruyemiş ağırlıklı çekirdekler önerir; filtre için daha açık kavrulmuş, meyvemsi çekirdekler. Bu sayfa, kavurucuların espresso ya da filtre için önerdiği çekirdekleri yan yana koyar. Bir çekirdek iki yönteme de önerildiyse iki tarafta da sayılır.' },
  { slug: 'kronotrop-vs-petra', group: 'kavurucu', a: { kind: 'roaster', slug: 'kronotrop', name: 'Kronotrop' }, b: { kind: 'roaster', slug: 'petra', name: 'Petra Coffee' },
    intro: 'Kronotrop ve Petra, İstanbul’da çekirdek kahve satan iki kavurucu. Bu sayfa iki kavurucunun kendi sitelerinde bugün satışta olan çekirdekleri yan yana koyar: kaç kahve var, 250 g paketler kaça, hangi kökenler ve işlemler öne çıkıyor.' },
  { slug: 'kronotrop-vs-montag', group: 'kavurucu', a: { kind: 'roaster', slug: 'kronotrop', name: 'Kronotrop' }, b: { kind: 'roaster', slug: 'montag', name: 'Montag Coffee Roasters' },
    intro: 'Kronotrop ve Montag, İstanbul’da çekirdek kahve satan iki kavurucu. Aşağıdaki tablo ikisinin bugün satıştaki çekirdeklerini paket fiyatı, köken, işlem ve tat notlarıyla karşılaştırır.' },
  { slug: 'petra-vs-montag', group: 'kavurucu', a: { kind: 'roaster', slug: 'petra', name: 'Petra Coffee' }, b: { kind: 'roaster', slug: 'montag', name: 'Montag Coffee Roasters' },
    intro: 'Petra ve Montag, İstanbul’da çekirdek kahve satan iki kavurucu. Tablo, iki kavurucunun kendi sitelerinde bugün satışta olan çekirdekleri paket fiyatı, köken, işlem ve tat notlarıyla karşılaştırır.' },
];

export const GROUP_LABELS: Record<Comparison['group'], string> = { koken: 'Köken', islem: 'İşlem', demleme: 'Demleme', kavurucu: 'Kavurucu' };
const BREW_SIDE_LABELS = { espresso: 'Espresso', filter: 'Filtre' } as const;

export function sideKey(side: SideRef): string { return side.kind === 'roaster' ? `roaster:${side.slug}` : `${side.kind}:${side.value}`; }
export function sideLabel(side: SideRef): string {
  if (side.kind === 'origin') return countryLabel(side.value);
  if (side.kind === 'process') return PROCESS_LABELS[side.value] ?? side.value;
  if (side.kind === 'brew') return BREW_SIDE_LABELS[side.value];
  return side.name;
}
/** The short name used in the question ("Petra mı?"): roasters drop "Coffee", "Roasters". */
function shortLabel(side: SideRef): string { return side.kind === 'roaster' ? side.name.replace(/\s+(?:Coffee|Roasters)\b.*$/i, '') : sideLabel(side); }
/** Where a side lives on the site: the roaster page, or the origin or process landing page. */
export function sideHref(side: SideRef): string {
  if (side.kind === 'roaster') return `/kavurucu/${side.slug}`;
  if (side.kind === 'origin') return originLanding(side.value)?.path ?? '/kahveler';
  if (side.kind === 'process') return processLanding(side.value)?.path ?? '/kahveler';
  return `/kahveler?brewMethod=${side.value}`;
}
/** The Turkish question particle follows the last vowel of the word: Kolombiya mı, Natürel mi, Kronotrop mu, Espresso mu. */
export function questionParticle(word: string): string {
  const vowel = [...word.toLocaleLowerCase('tr-TR')].reverse().find(letter => 'aıeioöuü'.includes(letter));
  return vowel === 'e' || vowel === 'i' ? 'mi' : vowel === 'o' || vowel === 'u' ? 'mu' : vowel === 'ö' || vowel === 'ü' ? 'mü' : 'mı';
}
/** "Etiyopya mı, Kolombiya mı?" */
export function comparisonQuestion(item: Comparison): string {
  const [a, b] = [shortLabel(item.a), shortLabel(item.b)];
  return `${a} ${questionParticle(a)}, ${b} ${questionParticle(b)}?`;
}
const TITLE_SUFFIX: Record<Comparison['group'], string> = { koken: 'Köken karşılaştırması', islem: 'İşlem karşılaştırması', demleme: 'Çekirdek karşılaştırması', kavurucu: 'Kavurucu karşılaştırması' };
/** "Etiyopya mı Kolombiya mı? Köken karşılaştırması" */
export function comparisonTitle(item: Comparison): string {
  const [a, b] = [shortLabel(item.a), shortLabel(item.b)];
  const second = item.group === 'demleme' ? b.toLocaleLowerCase('tr-TR') : b;
  return `${a} ${questionParticle(a)} ${second} ${questionParticle(b)}? ${TITLE_SUFFIX[item.group]}`;
}
export function findComparison(slug: string): Comparison | null { return COMPARISONS.find(item => item.slug === slug) ?? null; }
/** The comparisons a roaster, origin or process page links to; a coffee page passes its roaster and every origin and
 * process it states (any spelling the landing pages accept: `Etiyopya`, `Ethiopia`, `natural`, `Natürel`). */
export function comparisonsFor(side: Partial<{ roaster: string; origin: string | string[]; process: string | string[] }>): Comparison[] {
  const list = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
  const origins = new Set(list(side.origin).filter(isKnownCountry).map(canonicalCountry));
  const processes = new Set(list(side.process).flatMap(value => processLanding(value)?.value ?? []));
  const matches = (ref: SideRef) => (ref.kind === 'roaster' && ref.slug === side.roaster) || (ref.kind === 'origin' && origins.has(ref.value)) || (ref.kind === 'process' && processes.has(ref.value));
  return COMPARISONS.filter(item => matches(item.a) || matches(item.b));
}
/** The search-result description: both sides and their counts when the facts are in, held to 155 characters. */
export function comparisonDescription(item: Comparison, counts: [number, number] | null): string {
  const [a, b] = [sideLabel(item.a), sideLabel(item.b)];
  return counts
    ? `${a} ve ${b} yan yana: satıştaki ${counts[0]} ve ${counts[1]} çekirdeğin 250 g fiyatı, kökeni, işlemi ve tat notları. Her gece güncellenir.`
    : `${a} ve ${b} yan yana: satıştaki çekirdeklerin 250 g fiyatı, kökeni, işlemi ve tat notları. Her gece güncellenir.`;
}

export interface Share { key: string; label: string; count: number }
export interface SideFacts {
  coffees: number; roasters: number; city: string | null;
  /** The cheapest in-stock 250 g package of each coffee that has one, in TL. Other bag sizes are left out, so no number mixes sizes. */
  price250: { coffees: number; min: number; median: number; max: number } | null;
  /** The coffee behind `min`, by id: its card comes from comparisonCards. */
  cheapest250: { id: string; price: number } | null;
  /** How many coffees state each fact at all, and how many carry each value (a coffee can carry more than one), most first.
   * Tastes and processes keep every value, because the guidance compares shares; the table shows the first three. */
  stated: Record<'origin' | 'process' | 'roast' | 'taste' | 'brew', number>;
  origins: Share[]; processes: Share[]; roasts: Share[]; tastes: Share[]; brews: Share[]; topRoasters: Share[];
  /** Up to SHOWN coffees to show as cards, by id (comparisonCards hydrates them per pair). */
  shown: string[];
}
export interface ComparisonData { at: string; sides: Record<string, SideFacts> }
/** One listed coffee as the comparison reads it: facts from the two derived candidate lists, and its 250 g price. */
export interface CoffeeFacts { id: string; roasterId: string; firstSeenAt: string; origin: string[]; process: string[]; roast: string[]; taste: string[]; brew: string[]; price250: number | null }
type RoasterInfo = { id: string; slug: string; name: string; city: string | null };

/** Indexable only when both sides have enough coffees for the numbers to mean something. */
export const MIN_COFFEES = 3;
export const SHOWN = 4;

const top = (counts: Map<string, number>, label: (key: string) => string, limit = Infinity): Share[] =>
  [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([key, count]) => ({ key, label: label(key), count }));
const tally = (counts: Map<string, number>, keys: string[]) => { for (const key of new Set(keys)) counts.set(key, (counts.get(key) ?? 0) + 1); };

export function matches(side: SideRef, coffee: CoffeeFacts, roasters: Map<string, RoasterInfo>): boolean {
  if (side.kind === 'roaster') return roasters.get(coffee.roasterId)?.slug === side.slug;
  if (side.kind === 'origin') return coffee.origin.includes(side.value);
  if (side.kind === 'process') return coffee.process.includes(side.value);
  return coffee.brew.includes(side.value);
}
/** Coffees with a 250 g package in stock first (the price the table quotes), newest first within each. */
function showOrder(coffees: CoffeeFacts[]): CoffeeFacts[] {
  return [...coffees].sort((a, b) => Number(b.price250 !== null) - Number(a.price250 !== null) || b.firstSeenAt.localeCompare(a.firstSeenAt) || a.id.localeCompare(b.id));
}
function cheapest(coffees: CoffeeFacts[]): CoffeeFacts | undefined {
  return coffees.filter(coffee => coffee.price250 !== null).sort((a, b) => a.price250! - b.price250! || a.id.localeCompare(b.id))[0];
}
const CARD_FEATURES = new Set(['normalized_origin', 'origin_country', 'process_family', 'process', 'flavor_families', 'flavor_categories']);
function card(coffee: CatalogCoffee): CatalogCoffee {
  const { imageUrl, tastingNotes, country, process } = coffee.rawMetadata;
  return { ...coffee, rawMetadata: { imageUrl, tastingNotes, country, process }, features: coffee.features.filter(feature => CARD_FEATURES.has(feature.feature)), latestEvents: [] };
}

export function summarize(coffees: CoffeeFacts[], roasters: Map<string, RoasterInfo>, city: string | null = null): SideFacts {
  const counts = { origin: new Map<string, number>(), process: new Map<string, number>(), roast: new Map<string, number>(), taste: new Map<string, number>(), brew: new Map<string, number>(), roaster: new Map<string, number>() };
  const stated = { origin: 0, process: 0, roast: 0, taste: 0, brew: 0 };
  for (const coffee of coffees) {
    for (const key of Object.keys(stated) as Array<keyof typeof stated>) { if (coffee[key].length) stated[key]++; tally(counts[key], coffee[key]); }
    tally(counts.roaster, [coffee.roasterId]);
  }
  const sorted = coffees.flatMap(coffee => coffee.price250 ?? []).sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const low = cheapest(coffees);
  return {
    coffees: coffees.length, roasters: counts.roaster.size, city,
    price250: sorted.length ? { coffees: sorted.length, min: sorted[0], median: Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2), max: sorted.at(-1)! } : null,
    cheapest250: low ? { id: low.id, price: low.price250! } : null,
    stated,
    origins: top(counts.origin, countryLabel, 3), processes: top(counts.process, key => PROCESS_LABELS[key] ?? key),
    roasts: top(counts.roast, key => ROAST_LABELS[key] ?? key, 5), tastes: top(counts.taste, key => FLAVOR_CATEGORY_LABELS[key as keyof typeof FLAVOR_CATEGORY_LABELS] ?? key),
    brews: top(counts.brew, key => BREW_METHOD_LABELS[key] ?? key, 3), topRoasters: top(counts.roaster, key => roasters.get(key)?.name ?? key, 3),
    shown: showOrder(coffees).slice(0, SHOWN).map(coffee => coffee.id),
  };
}

/** Each listed coffee's cheapest in-stock 250 g TRY package, over its own and its size twins' offers (as the card reads them), in TL. */
async function prices250(db: CatalogDatabase): Promise<Map<string, number>> {
  // A subquery per listed coffee (about 15,000 rows). The same join written flat lets SQLite drive from offers and re-check the
  // public view for each one: 3.8 million rows on the 17 Oct dump (scripts/v2-read-budget.mts sql).
  const rows = await db.prepare(`SELECT c.id,(SELECT min(o.current_price_minor) FROM coffee_group_members g JOIN current_offers o ON o.coffee_id=g.coffee_id
    WHERE g.group_id=c.id AND o.in_stock=1 AND o.currency='TRY' AND o.weight_g=250 AND o.current_price_minor>0) AS price FROM public_catalog_coffees c WHERE ${coffeeOnlySql()}`).all<{ id: string; price: number | null }>();
  return new Map(rows.results.flatMap(row => row.price === null ? [] : [[row.id, row.price / 100] as [string, number]]));
}
/**
 * Workers Free allows 10 ms of CPU a request, so the facts never hydrate a coffee: membership and facts come from the two
 * candidate lists that are already derived (similarity: origin; quiz: process, roast, taste and brew evidence) and prices
 * from one aggregate query. Hydrating is about 0.13 ms of CPU a coffee, so the cards are built per pair (comparisonCards).
 */
async function computeComparisons(db: CatalogDatabase, now = Date.now()): Promise<ComparisonData> {
  const sides = [...new Map(COMPARISONS.flatMap(item => [item.a, item.b]).map(side => [sideKey(side), side])).values()];
  const [similar, scored, roasterList, prices] = await Promise.all([similarityCandidates(db), scoredCandidates(db), listRoasters(db), prices250(db)]);
  const evidence = new Map(scored.map(candidate => [candidate.id, candidate.evidence]));
  const coffees: CoffeeFacts[] = similar.map(candidate => {
    const found = evidence.get(candidate.id) ?? {};
    return { id: candidate.id, roasterId: candidate.roasterId, firstSeenAt: candidate.firstSeenAt,
      origin: [...new Set(candidate.origin.filter(isKnownCountry).map(canonicalCountry))],
      process: found.process?.values ?? [], roast: found.roast?.values ?? [], taste: found.taste?.values ?? [], brew: found.brew?.values ?? [],
      price250: prices.get(candidate.id) ?? null };
  });
  const roasters = new Map<string, RoasterInfo>(roasterList.map(roaster => [roaster.id, roaster]));
  return { at: new Date(now).toISOString(), sides: Object.fromEntries(sides.map(side => [sideKey(side),
    summarize(coffees.filter(coffee => matches(side, coffee, roasters)), roasters, side.kind === 'roaster' ? roasterList.find(roaster => roaster.slug === side.slug)?.city ?? null : null)])) };
}
/** Every side of every comparison, once per refresh (derived cache, with a last-good copy in KV); tests and scripts read live. */
export function comparisonFacts(db: CatalogDatabase): Promise<ComparisonData> {
  return db.derive ? db.derive('comparisons', () => computeComparisons(db)) : computeComparisons(db);
}
/** One pair's cards (its shown coffees and each side's cheapest), hydrated as the catalog cards are and kept per pair, so
 * about ten coffees are hydrated in any one request. A coffee that left the catalog since the facts were built is skipped. */
export function comparisonCards(db: CatalogDatabase, item: Comparison, data: ComparisonData): Promise<Record<string, CatalogCoffee>> {
  const sides = [data.sides[sideKey(item.a)], data.sides[sideKey(item.b)]].filter(Boolean);
  const ids = [...new Set(sides.flatMap(side => [...side.shown, ...(side.cheapest250 ? [side.cheapest250.id] : [])]))];
  const compute = async () => Object.fromEntries((await hydrate(db, await listedRows(db, ids), Date.now())).map(coffee => [coffee.id, card(coffee)]));
  // Facts and cards share the nightly invalidation; a card missing after a mid-day recompute is simply not shown.
  return db.derive ? db.derive(`comparison-cards:${item.slug}`, compute) : compute();
}
export function indexable(data: ComparisonData, item: Comparison): boolean {
  return [item.a, item.b].every(side => (data.sides[sideKey(side)]?.coffees ?? 0) >= MIN_COFFEES);
}
/**
 * The sitemap decides from counts it already reads (landing facts, roasters) instead of building the comparison facts inside
 * its own request. A brew side has no landing count; both brew sides hold a large share of the catalog, so it is listed.
 * The page itself decides noindex from its own facts; at the 3-coffee threshold the two agree.
 */
export function listedInSitemap(item: Comparison, landings: Array<{ path: string; coffees: number }>, roasters: Array<{ slug: string; coffeeCount: number }>): boolean {
  const count = (side: SideRef) => side.kind === 'brew' ? Infinity
    : side.kind === 'roaster' ? roasters.find(roaster => roaster.slug === side.slug)?.coffeeCount ?? 0
    : landings.find(landing => landing.path === sideHref(side))?.coffees ?? 0;
  return [item.a, item.b].every(side => count(side) >= MIN_COFFEES);
}
