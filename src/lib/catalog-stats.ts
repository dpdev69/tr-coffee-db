import { countCatalog, getCatalogCounts, listRoasters } from '../../shared/v2/catalog';
import { coffeeOnlySql } from '../../shared/v2/coffee-eligibility';
import type { CatalogDatabase } from '../../shared/v2/database';
import { ARRIVAL_DAYS } from '../../shared/v2/events';
import { listLandings } from './catalog-landing';
import { absoluteUrl } from './site';

/**
 * The catalog in numbers (/veri and its open copy /veri/v1/ozet.json): counts, the origin and process split, genuine
 * arrivals, price drops and bag prices per bag size. One derived result, built the way /karsilastir builds its facts:
 * once per refresh (the nightly warm-up requests both addresses), from results that are already derived (counts, roasters,
 * landing facts) plus two event counts and one price query; a view that misses the edge reads that result (2 rows).
 *
 * Prices are package prices per bag size, never per 100 g (owner decision): each listed coffee's cheapest in-stock TRY
 * package of that size, over its own and its size twins' offers, as the cards read them.
 */
export const STATS_PATH = '/veri';
export const STATS_JSON_PATH = '/veri/v1/ozet.json';
export const STATS_SCHEMA = 1;
export const LICENSE = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.tr' } as const;
/** Same window as /firsatlar. */
export const DROP_DAYS = 7;
/** A bag size is summarised only when at least this many coffees sell it in stock, so no median rests on one or two prices. */
export const MIN_SIZE_COFFEES = 5;

export interface StatsShare { value: string; label: string; path: string; coffees: number; roasters: number }
export interface BagPrice { weightG: number; coffees: number; min: number; median: number; max: number }
export interface CatalogStats {
  /** When the numbers were computed (just after the nightly refresh), and the newest successful crawl among listed roasters. */
  at: string; refreshedAt: string | null;
  coffees: number; roasters: number; packages: number;
  origins: StatsShare[]; processes: StatsShare[];
  newArrivals: { days: number; coffees: number };
  priceDrops: { days: number; coffees: number };
  bagPrices: BagPrice[];
}

const median = (sorted: number[]) => { const middle = sorted.length >> 1; return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2); };

/** Per bag size: how many coffees sell it in stock, and the lowest, median and highest of their prices (TL). */
export function summariseBags(perCoffee: Array<Array<[weightG: number, priceTl: number]>>, minimum = MIN_SIZE_COFFEES): BagPrice[] {
  const bySize = new Map<number, number[]>();
  for (const sizes of perCoffee) for (const [weight, price] of sizes) bySize.set(weight, [...(bySize.get(weight) ?? []), price]);
  return [...bySize].filter(([, prices]) => prices.length >= minimum).sort((a, b) => a[0] - b[0]).map(([weightG, prices]) => {
    const sorted = [...prices].sort((a, b) => a - b);
    return { weightG, coffees: sorted.length, min: sorted[0], median: median(sorted), max: sorted.at(-1)! };
  });
}

/** Each listed coffee's cheapest in-stock TRY package per bag size, written as a subquery per coffee like the comparison
 * prices (the same join written flat lets SQLite drive from offers and re-check the public view per offer). */
async function bagPrices(db: CatalogDatabase): Promise<BagPrice[]> {
  const rows = await db.prepare(`SELECT (SELECT json_group_array(json_array(w,p)) FROM (SELECT o.weight_g AS w,min(o.current_price_minor) AS p FROM coffee_group_members g JOIN current_offers o ON o.coffee_id=g.coffee_id
    WHERE g.group_id=c.id AND o.in_stock=1 AND o.currency='TRY' AND o.weight_g>0 AND o.current_price_minor>0 GROUP BY o.weight_g)) AS sizes FROM public_catalog_coffees c WHERE ${coffeeOnlySql()}`).all<{ sizes: string | null }>();
  return summariseBags(rows.results.map(row => (JSON.parse(row.sizes ?? '[]') as Array<[number, number]>).map(([weight, price]) => [weight, price / 100] as [number, number])));
}

/** The newest successful crawl among the roasters with listed coffees: when the catalog's data last changed at the source. */
export async function catalogRefreshedAt(db: CatalogDatabase): Promise<string | null> {
  return (await listRoasters(db)).map(roaster => roaster.lastSuccessAt).filter((at): at is string => Boolean(at)).sort().at(-1) ?? null;
}

export async function computeCatalogStats(db: CatalogDatabase, now = Date.now()): Promise<CatalogStats> {
  // The same windows /yeni and /firsatlar use (DiscoveryCatalog), so the numbers match those pages on the same night.
  const since = (days: number) => new Date(Math.floor(now / 300000) * 300000 - days * 86400000).toISOString();
  const [counts, landings, refreshedAt, arrivals, drops, bags] = await Promise.all([
    getCatalogCounts(db), listLandings(db), catalogRefreshedAt(db),
    countCatalog(db, { event: 'NEW', since: since(ARRIVAL_DAYS) }), countCatalog(db, { event: 'PRICE_DROP', since: since(DROP_DAYS) }), bagPrices(db),
  ]);
  const shares = (facet: 'koken' | 'islem') => landings.filter(item => item.facet === facet)
    .sort((a, b) => b.coffees - a.coffees || a.label.localeCompare(b.label, 'tr'))
    .map(item => ({ value: item.value, label: item.label, path: item.path, coffees: item.coffees, roasters: item.roasters }));
  return { at: new Date(now).toISOString(), refreshedAt, coffees: counts.coffees, roasters: counts.roasters, packages: counts.offers,
    origins: shares('koken'), processes: shares('islem'),
    newArrivals: { days: ARRIVAL_DAYS, coffees: arrivals }, priceDrops: { days: DROP_DAYS, coffees: drops }, bagPrices: bags };
}

/** Once per refresh (derived cache, with a last-good copy in KV); tests and scripts read live. */
export function catalogStats(db: CatalogDatabase): Promise<CatalogStats> {
  return db.derive ? db.derive('catalog-stats', () => computeCatalogStats(db)) : computeCatalogStats(db);
}

const ISTANBUL = 'Europe/Istanbul';
/** "19 Ekim 2026" */
export const trDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ISTANBUL });
/** "Ekim 2026" */
export const trMonth = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: ISTANBUL });
/** "2026-10-19", the Istanbul calendar day. */
export const isoDay = (iso: string) => new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 10);
/** The date every figure is quoted at: the catalog's last refresh, or when the numbers were computed. */
export const statsDate = (stats: Pick<CatalogStats, 'at' | 'refreshedAt'>) => stats.refreshedAt ?? stats.at;

const number = (value: number) => value.toLocaleString('tr-TR');
/** "250 g", "1 kg", "1,5 kg": a bag size, never a unit price. */
export const bagSize = (weightG: number) => weightG >= 1000 ? `${(weightG / 1000).toLocaleString('tr-TR')} kg` : `${weightG} g`;
export const lira = (value: number) => `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
const percent = (part: number, whole: number) => whole ? `%${Math.round((part / whole) * 100)}` : '%0';

export interface Figure { id: string; label: string; value: string; sentence: string }
/** Each figure as one dated sentence that can be quoted as it stands. Only numbers the data holds; an empty list is left out. */
export function statsFigures(stats: CatalogStats): Figure[] {
  const date = trDate(statsDate(stats));
  const figures: Figure[] = [
    { id: 'katalog', label: 'Satıştaki kahve', value: number(stats.coffees),
      sentence: `${date} itibarıyla KahveDrop kataloğunda ${number(stats.roasters)} bağımsız kavurucudan ${number(stats.coffees)} nitelikli kahve ve ${number(stats.packages)} paket satışta.` },
  ];
  const topOrigins = stats.origins.slice(0, 3);
  if (topOrigins.length) figures.push({ id: 'koken', label: 'En sık köken', value: topOrigins[0].label,
    sentence: `${date} itibarıyla KahveDrop kataloğunda en sık görülen kökenler ${new Intl.ListFormat('tr', { type: 'conjunction' }).format(topOrigins.map(item => `${item.label} (${number(item.coffees)} kahve, ${percent(item.coffees, stats.coffees)})`))}.` });
  const topProcesses = stats.processes.slice(0, 3);
  if (topProcesses.length) figures.push({ id: 'islem', label: 'En sık işlem', value: topProcesses[0].label,
    sentence: `${date} itibarıyla KahveDrop kataloğundaki kahvelerin işlem dağılımı: ${topProcesses.map(item => `${item.label.toLocaleLowerCase('tr-TR')} ${number(item.coffees)} (${percent(item.coffees, stats.coffees)})`).join(', ')}.` });
  figures.push({ id: 'yeni', label: `Son ${stats.newArrivals.days} günde yeni`, value: number(stats.newArrivals.coffees),
    sentence: `${date} itibarıyla son ${stats.newArrivals.days} günde Türkiye’deki bağımsız kavurucular ${number(stats.newArrivals.coffees)} yeni kahveyi satışa çıkardı (KahveDrop kataloğu).` });
  figures.push({ id: 'dusus', label: `Son ${stats.priceDrops.days} günde fiyatı düşen`, value: number(stats.priceDrops.coffees),
    sentence: `${date} itibarıyla KahveDrop kataloğunda son ${stats.priceDrops.days} günde fiyatı düşen ve yeni fiyatı hâlâ geçerli ${number(stats.priceDrops.coffees)} kahve var.` });
  for (const bag of stats.bagPrices) figures.push({ id: `paket-${bag.weightG}`, label: `${bagSize(bag.weightG)} paket, ortanca`, value: lira(bag.median),
    sentence: `${date} itibarıyla KahveDrop kataloğunda stokta ${bagSize(bag.weightG)} paketi olan ${number(bag.coffees)} kahvenin paket fiyatı ${lira(bag.min)} ile ${lira(bag.max)} arasında, ortancası ${lira(bag.median)}.` });
  return figures;
}

export const statsTitle = (stats: CatalogStats | null) => stats ? `Kahve kataloğu rakamları · ${trMonth(statsDate(stats))}` : 'Kahve kataloğu rakamları';
export function statsDescription(stats: CatalogStats | null): string {
  return stats
    ? `${trMonth(statsDate(stats))}: ${number(stats.roasters)} kavurucudan ${number(stats.coffees)} kahve, köken ve işlem dağılımı, yeni gelenler, paket fiyatları. Açık veri, CC BY 4.0.`
    : 'Türkiye’deki bağımsız kavurucuların kahve kataloğu rakamlarla: köken ve işlem dağılımı, yeni gelenler, paket fiyatları. Açık veri, CC BY 4.0.';
}

/** The open copy at /veri/v1/ozet.json: the same numbers as the page, stable field names, credit and licence inside. */
export function statsJson(stats: CatalogStats) {
  return {
    schemaVersion: STATS_SCHEMA,
    title: 'KahveDrop katalog özeti',
    description: 'Türkiye’deki bağımsız nitelikli kahve kavurucularının KahveDrop kataloğundaki toplu rakamları. Fiyatlar paket fiyatıdır (TL, kargo hariç).',
    source: 'KahveDrop',
    sourceUrl: absoluteUrl(STATS_PATH),
    attribution: `Kaynak: KahveDrop (${absoluteUrl(STATS_PATH)})`,
    license: LICENSE.name,
    licenseUrl: LICENSE.url,
    asOf: isoDay(statsDate(stats)),
    refreshedAt: stats.refreshedAt,
    generatedAt: stats.at,
    catalog: { coffees: stats.coffees, roasters: stats.roasters, packages: stats.packages },
    origins: stats.origins.map(item => ({ name: item.label, country: item.value, coffees: item.coffees, roasters: item.roasters, url: absoluteUrl(item.path) })),
    processes: stats.processes.map(item => ({ name: item.label, process: item.value, coffees: item.coffees, roasters: item.roasters, url: absoluteUrl(item.path) })),
    newArrivals: { days: stats.newArrivals.days, coffees: stats.newArrivals.coffees, url: absoluteUrl('/yeni') },
    priceDrops: { days: stats.priceDrops.days, coffees: stats.priceDrops.coffees, url: absoluteUrl('/firsatlar') },
    bagPrices: stats.bagPrices.map(bag => ({ weightG: bag.weightG, coffees: bag.coffees, minTRY: bag.min, medianTRY: bag.median, maxTRY: bag.max })),
    notes: [
      'Bir kahve birden fazla kökene ya da işleme sayılabilir (harmanlar); paylar toplam kahve sayısına göredir.',
      `Paket fiyatları: her kahvenin o gramajdaki stoktaki en ucuz paketi; en az ${MIN_SIZE_COFFEES} kahvede bulunan gramajlar. Kargo dahil değildir.`,
      `Yeni gelenler: son ${ARRIVAL_DAYS} günde kavurucunun satışa çıkardığı kahveler (/yeni ile aynı kural). Fiyatı düşenler: son ${DROP_DAYS} günde fiyatı düşen ve yeni fiyatı hâlâ geçerli kahveler (/firsatlar ile aynı kural).`,
    ],
  };
}
