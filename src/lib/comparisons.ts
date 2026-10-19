import { canonicalCountry, countryLabel, isKnownCountry } from '../../shared/v2/country-labels';
import { hydrate, listedRows, listRoasters, similarityCandidates, type CatalogCoffee } from '../../shared/v2/catalog';
import type { CatalogDatabase } from '../../shared/v2/database';
import { evidence, processIds, type QuizDimension } from '../../shared/v2/quiz-rank';
import { featureText } from '@/components/v2/discovery-card';
import { BREW_METHOD_LABELS, FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS } from './constants/filter-options';
import { originLanding, processLanding } from './catalog-landing';

/**
 * Written "X mı Y mi" pages (/karsilastir/<slug>): a fixed list, never built from a query, so they cannot become a crawlable
 * space of combinations the way /compare would (that tool stays noindex and out of robots.txt). Every number on them comes
 * from one derived result (comparisonFacts), computed once per refresh from the similarity candidates (already derived) and
 * the listed coffees it picks; a page view reads that result (2 rows) or the edge copy (none).
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
    intro: 'Brezilya dünyanın en büyük kahve üreticisi; çekirdekleri çoğunlukla kuruyemiş ve çikolata notalarıyla espresso harmanlarında kullanılır. Kolombiya çekirdekleri hem filtrede hem espressoda karşımıza çıkar. Tablo, iki kökenin bugün satıştaki çekirdeklerini yan yana koyar.' },
  { slug: 'kenya-vs-kolombiya', group: 'koken', a: { kind: 'origin', value: 'Kenya' }, b: { kind: 'origin', value: 'Colombia' },
    intro: 'Kenya çekirdekleri çoğunlukla canlı asidite ve kırmızı meyve notalarıyla tanınır; Kolombiya daha geniş bir yelpazede, dengeli profillerle gelir. Aşağıdaki rakamlar iki kökenden bugün satışta olan çekirdeklerden derlendi.' },
  { slug: 'kenya-vs-etiyopya', group: 'koken', a: { kind: 'origin', value: 'Kenya' }, b: { kind: 'origin', value: 'Ethiopia' },
    intro: 'Kenya ve Etiyopya, Doğu Afrika’nın iki tanınmış kahve kökeni. İkisi de meyvemsi fincanlarıyla bilinir; fark çoğunlukla işlem yönteminde ve meyvenin türündedir. Tablo, bugün satıştaki çekirdeklerde bu farkın nasıl göründüğünü gösterir.' },
  { slug: 'guatemala-vs-kolombiya', group: 'koken', a: { kind: 'origin', value: 'Guatemala' }, b: { kind: 'origin', value: 'Colombia' },
    intro: 'Guatemala ve Kolombiya, Latin Amerika’nın yüksek rakımlı iki kökeni. Guatemala çekirdekleri çoğunlukla çikolata ve baharat notalarıyla, Kolombiya çekirdekleri meyve ve karamel tatlılığıyla anılır. Rakamlar bugün satıştaki çekirdeklerden.' },
  { slug: 'naturel-vs-yikanmis', group: 'islem', a: { kind: 'process', value: 'natural' }, b: { kind: 'process', value: 'washed' },
    intro: 'Natürel işlemde kahve meyvesi çekirdeğin üzerinde kurutulur; fincanda genellikle daha belirgin meyve ve fermente tatlar çıkar. Yıkanmış işlemde meyve kurutmadan önce ayrılır; fincan çoğunlukla daha temiz ve berrak olur. Tablo iki işlemi bugün satıştaki çekirdeklerle karşılaştırır.' },
  { slug: 'espresso-vs-filtre', group: 'demleme', a: { kind: 'brew', value: 'espresso' }, b: { kind: 'brew', value: 'filter' },
    intro: 'Espresso için kavurucular çoğunlukla daha gövdeli, çikolata ve kuruyemiş ağırlıklı çekirdekler önerir; filtre için daha açık kavrulmuş, meyvemsi çekirdekler. Bu sayfa, kavurucuların espresso ya da filtre için önerdiği çekirdekleri yan yana koyar. Bir çekirdek iki yönteme de önerildiyse iki tarafta da sayılır.' },
  { slug: 'kronotrop-vs-petra', group: 'kavurucu', a: { kind: 'roaster', slug: 'kronotrop', name: 'Kronotrop' }, b: { kind: 'roaster', slug: 'petra', name: 'Petra Coffee' },
    intro: 'Kronotrop ve Petra, İstanbul’un tanınmış iki kahve kavurucusu. Bu sayfa iki kavurucunun kendi sitelerinde bugün satışta olan çekirdekleri yan yana koyar: kaç kahve var, 250 g paketler kaça, hangi kökenler ve işlemler öne çıkıyor.' },
  { slug: 'kronotrop-vs-montag', group: 'kavurucu', a: { kind: 'roaster', slug: 'kronotrop', name: 'Kronotrop' }, b: { kind: 'roaster', slug: 'montag', name: 'Montag Coffee Roasters' },
    intro: 'Kronotrop ve Montag, İstanbul’da çekirdek kahve satan iki tanınmış kavurucu. Aşağıdaki tablo ikisinin bugün satıştaki çekirdeklerini paket fiyatı, köken, işlem ve tat notlarıyla karşılaştırır.' },
  { slug: 'petra-vs-montag', group: 'kavurucu', a: { kind: 'roaster', slug: 'petra', name: 'Petra Coffee' }, b: { kind: 'roaster', slug: 'montag', name: 'Montag Coffee Roasters' },
    intro: 'Petra ve Montag, İstanbul’un iki tanınmış kahve kavurucusu. Tablo, iki kavurucunun kendi sitelerinde bugün satışta olan çekirdekleri paket fiyatı, köken, işlem ve tat notlarıyla karşılaştırır.' },
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
/** The comparisons a roaster, origin or process page links to. */
export function comparisonsFor(side: Partial<{ roaster: string; origin: string; process: string }>): Comparison[] {
  const matches = (ref: SideRef) => (ref.kind === 'roaster' && ref.slug === side.roaster) || (ref.kind === 'origin' && side.origin !== undefined && ref.value === canonicalCountry(side.origin)) || (ref.kind === 'process' && ref.value === side.process);
  return COMPARISONS.filter(item => matches(item.a) || matches(item.b));
}

export interface Share { key: string; label: string; count: number }
/** A coffee as a card shows it, without the long fields (description, source data) the card never reads. */
export type CardCoffee = CatalogCoffee;
export interface SideFacts {
  coffees: number; roasters: number; city: string | null;
  /** The cheapest in-stock 250 g package of each coffee that has one, in TL. Other bag sizes are left out, so no number mixes sizes. */
  price250: { coffees: number; min: number; median: number; max: number } | null;
  cheapest250: { name: string; slug: string; roaster: string; price: number } | null;
  /** How many coffees state each fact at all, and the most common values. A coffee can carry more than one value. */
  stated: Record<'origin' | 'process' | 'roast' | 'taste' | 'brew', number>;
  origins: Share[]; processes: Share[]; roasts: Share[]; tastes: Share[]; brews: Share[]; topRoasters: Share[];
  shown: CardCoffee[];
}
export interface ComparisonData { at: string; sides: Record<string, SideFacts> }

/** Indexable only when both sides have enough coffees for the numbers to mean something. */
export const MIN_COFFEES = 3;
export const SHOWN = 6;

const top = (counts: Map<string, number>, label: (key: string) => string, limit = 4): Share[] =>
  [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([key, count]) => ({ key, label: label(key), count }));
const tally = (counts: Map<string, number>, keys: string[]) => { for (const key of new Set(keys)) counts.set(key, (counts.get(key) ?? 0) + 1); };

/** Origins the way the card names them (coffeeOrigin): the roaster's field, else the normalized origin, else the raw feature. */
export function coffeeOrigins(coffee: CatalogCoffee): string[] {
  const inferred = featureText(coffee, 'normalized_origin');
  const origins = coffee.rawMetadata.country != null ? [coffee.rawMetadata.country] : inferred.length ? inferred : featureText(coffee, 'origin_country');
  return [...new Set(origins.filter(origin => origin && isKnownCountry(origin)).map(canonicalCountry))];
}
/** Roast, brew, taste and process as the quiz reads them: the best-trusted statement, a blanket "every method" claim ignored. */
function facts(coffee: CatalogCoffee, dimension: QuizDimension): string[] {
  return evidence({ id: coffee.id, roasterId: coffee.roaster.id, firstSeenAt: coffee.firstSeenAt, raw: coffee.rawMetadata, features: coffee.features }, dimension)?.values ?? [];
}
function matches(side: SideRef, coffee: CatalogCoffee): boolean {
  if (side.kind === 'roaster') return coffee.roaster.slug === side.slug;
  if (side.kind === 'origin') return coffeeOrigins(coffee).includes(side.value);
  if (side.kind === 'process') return facts(coffee, 'process').includes(side.value);
  return facts(coffee, 'brew').includes(side.value);
}
const price250 = (coffee: CatalogCoffee) => {
  const prices = coffee.offers.filter(offer => offer.inStock === true && offer.weightG === 250 && offer.currency === 'TRY' && offer.priceMinor != null && offer.priceMinor > 0).map(offer => offer.priceMinor! / 100);
  return prices.length ? Math.min(...prices) : null;
};
const CARD_FEATURES = new Set(['normalized_origin', 'origin_country', 'process_family', 'process', 'flavor_families', 'flavor_categories']);
function card(coffee: CatalogCoffee): CardCoffee {
  const { imageUrl, tastingNotes, country, process } = coffee.rawMetadata;
  return { ...coffee, rawMetadata: { imageUrl, tastingNotes, country, process }, features: coffee.features.filter(feature => CARD_FEATURES.has(feature.feature)), latestEvents: [] };
}

export function summarize(coffees: CatalogCoffee[], city: string | null = null): SideFacts {
  const counts = { origin: new Map<string, number>(), process: new Map<string, number>(), roast: new Map<string, number>(), taste: new Map<string, number>(), brew: new Map<string, number>(), roaster: new Map<string, number>() };
  const stated = { origin: 0, process: 0, roast: 0, taste: 0, brew: 0 };
  const priced: Array<{ coffee: CatalogCoffee; price: number }> = [];
  const roasterNames = new Map<string, string>();
  for (const coffee of coffees) {
    const values = { origin: coffeeOrigins(coffee), process: facts(coffee, 'process'), roast: facts(coffee, 'roast'), taste: facts(coffee, 'taste'), brew: facts(coffee, 'brew') };
    for (const key of Object.keys(values) as Array<keyof typeof values>) { if (values[key].length) stated[key]++; tally(counts[key], values[key]); }
    tally(counts.roaster, [coffee.roaster.slug]); roasterNames.set(coffee.roaster.slug, coffee.roaster.name);
    const price = price250(coffee);
    if (price !== null) priced.push({ coffee, price });
  }
  const sorted = priced.map(item => item.price).sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const cheapest = [...priced].sort((a, b) => a.price - b.price || a.coffee.name.localeCompare(b.coffee.name, 'tr'))[0];
  // Coffees with a 250 g package in stock first (the price the table quotes), newest first within each.
  const shown = [...coffees].sort((a, b) => Number(price250(b) !== null) - Number(price250(a) !== null) || b.firstSeenAt.localeCompare(a.firstSeenAt) || a.id.localeCompare(b.id)).slice(0, SHOWN).map(card);
  return {
    coffees: coffees.length, roasters: counts.roaster.size, city,
    price250: sorted.length ? { coffees: sorted.length, min: sorted[0], median: Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2), max: sorted.at(-1)! } : null,
    cheapest250: cheapest ? { name: cheapest.coffee.name, slug: cheapest.coffee.slug, roaster: cheapest.coffee.roaster.name, price: cheapest.price } : null,
    stated,
    origins: top(counts.origin, countryLabel), processes: top(counts.process, key => PROCESS_LABELS[key] ?? key),
    roasts: top(counts.roast, key => ROAST_LABELS[key] ?? key, 5), tastes: top(counts.taste, key => FLAVOR_CATEGORY_LABELS[key as keyof typeof FLAVOR_CATEGORY_LABELS] ?? key),
    brews: top(counts.brew, key => BREW_METHOD_LABELS[key] ?? key), topRoasters: top(counts.roaster, key => roasterNames.get(key) ?? key, 3),
    shown,
  };
}

/** D1 binds at most 100 parameters per statement. */
const CHUNK = 100;
async function computeComparisons(db: CatalogDatabase, now = Date.now()): Promise<ComparisonData> {
  const sides = [...new Map(COMPARISONS.flatMap(item => [item.a, item.b]).map(side => [sideKey(side), side])).values()];
  const [candidates, roasters] = await Promise.all([similarityCandidates(db), listRoasters(db)]);
  const roasterIds = new Set(roasters.filter(roaster => sides.some(side => side.kind === 'roaster' && side.slug === roaster.slug)).map(roaster => roaster.id));
  const origins = new Set(sides.flatMap(side => side.kind === 'origin' ? [side.value] : []));
  const processes = new Set(sides.flatMap(side => side.kind === 'process' ? [side.value] : []));
  const brew = sides.some(side => side.kind === 'brew');
  // A wide first cut from facts already derived (a coffee that might belong to a side); matches() then decides on the full coffee.
  const ids = candidates.filter(candidate => brew || roasterIds.has(candidate.roasterId)
    || candidate.origin.some(origin => origins.has(canonicalCountry(origin))) || candidate.process.some(value => processIds(value).some(id => processes.has(id)))).map(candidate => candidate.id);
  const coffees: CatalogCoffee[] = [];
  for (let start = 0; start < ids.length; start += CHUNK) coffees.push(...await hydrate(db, await listedRows(db, ids.slice(start, start + CHUNK)), now));
  const city = new Map(roasters.map(roaster => [roaster.slug, roaster.city]));
  return { at: new Date(now).toISOString(), sides: Object.fromEntries(sides.map(side => [sideKey(side), summarize(coffees.filter(coffee => matches(side, coffee)), side.kind === 'roaster' ? city.get(side.slug) ?? null : null)])) };
}
/** Every side of every comparison, once per refresh (derived cache, with a last-good copy in KV); tests and scripts read live. */
export function comparisonFacts(db: CatalogDatabase): Promise<ComparisonData> {
  return db.derive ? db.derive('comparisons', () => computeComparisons(db)) : computeComparisons(db);
}
export function indexable(data: ComparisonData, item: Comparison): boolean {
  return [item.a, item.b].every(side => (data.sides[sideKey(side)]?.coffees ?? 0) >= MIN_COFFEES);
}
