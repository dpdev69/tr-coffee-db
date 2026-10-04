/** Compatibility for retained utilities. Current observations never fall back to archived prices. */
import { getV2Environment } from './v2-runtime';
import { getCoffeeDetail, listCatalog, listRoasters, getRoasterDetail, type CatalogCoffee, type CatalogRoaster } from '../../shared/v2/catalog';
import type { CatalogDatabase } from '../../shared/v2/database';
import type { CoffeeWithRoaster, Roaster, CoffeeLot, CoffeeBrewRecipe } from './types/database';
import type { CoffeeFilters } from './queries/coffees';
import type { CoffeeJourney } from './coffee-journey';
import { coffeeMatchesSearch } from './coffee-search';
import { normalizeCityFilterValue } from './filter-contract';
import { SINGLE_ORIGIN_NAME_EXCLUSION_PATTERNS } from './catalog-rules';

export async function legacyCatalogDatabase(loadEnvironment = getV2Environment): Promise<CatalogDatabase | null> {
  let env: CloudflareEnv;
  try { env = await loadEnvironment(); }
  catch (error) {
    const failure = error as { code?: string; message?: string };
    // Only an unavailable Workers module permits the original Node deployment path.
    if (['ERR_UNSUPPORTED_ESM_URL_SCHEME', 'ERR_UNKNOWN_BUILTIN_MODULE', 'ERR_MODULE_NOT_FOUND'].includes(failure.code ?? '') && /cloudflare|protocol.*'cloudflare:'/.test(failure.message ?? '')) return null;
    throw error;
  }
  if (!env.DB) throw new Error('Catalog binding unavailable');
  return env.DB;
}

type Archive = Record<string, unknown>;
export type LegacyCatalogCoffee = CoffeeWithRoaster & {
  roasters: { id: string; name: string; slug: string; city: string | null; website_url: string; shop_url: string; logo_url: string | null };
  offer_id: string | null;
  stock_status: boolean | null;
  decaf_status: boolean | null;
  v2_source: CatalogCoffee;
  legacy_archive: Archive | null;
  coffee_lots?: Pick<CoffeeLot, 'traceability_score' | 'validation_status'> | null;
};
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : typeof value === 'string' ? [value] : [];
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
function feature(coffee: CatalogCoffee, ...names: string[]) { return coffee.features.filter(f => names.includes(f.feature)).flatMap(f => strings(f.value)); }

export function toLegacyCoffee(coffee: CatalogCoffee, archive: Archive | null = null, declaredOnly = false): LegacyCatalogCoffee {
  const raw = coffee.rawMetadata;
  // One actual offer supplies the whole tuple. Unknown availability is not sold-out evidence.
  const offer = [...coffee.offers].sort((a, b) => Number(b.inStock === true) - Number(a.inStock === true) || Number(b.weightG === 250) - Number(a.weightG === 250) || a.id.localeCompare(b.id))[0];
  const inferred = (...names: string[]) => declaredOnly ? [] : feature(coffee, ...names);
  const decaf = typeof raw.decaf === 'boolean' ? raw.decaf : coffee.features.find(f => ['is_decaf', 'decaf_classification'].includes(f.feature) && typeof f.value === 'boolean')?.value;
  return {
    id: coffee.id, roaster_id: coffee.roaster.id, green_lot_id: str(archive?.green_lot_id), slug: coffee.slug,
    external_id: coffee.sourceProductId ?? coffee.id, name: coffee.name, name_normalized: null,
    origin_country: raw.country ?? inferred('normalized_origin', 'origin_country')[0] ?? null,
    origin_region: raw.region ?? null, origin_farm: raw.farm ?? null, origin_altitude: raw.altitude ?? null,
    origin_producer: raw.producer ?? null, process: inferred('process_family', 'process')[0] ?? raw.process ?? 'unknown',
    process_detail: raw.process ?? null, roast_level: raw.roast ?? inferred('roast_classification', 'roast_level')[0] ?? 'unknown',
    variety: raw.varieties?.join(', ') || inferred('normalized_variety', 'variety').join(', ') || null,
    harvest_year: raw.harvestYear ?? null, roast_date: raw.roastDate ?? null,
    flavor_notes: raw.tastingNotes ?? [], flavor_notes_normalized: inferred('flavor_notes_normalized'),
    flavor_categories: inferred('flavor_families', 'flavor_categories'),
    sca_score: declaredOnly ? null : number(archive?.sca_score), specialty_status: 'specialty', specialty_score: null,
    specialty_signals: {}, specialty_rejection_reason: null,
    price_amount: offer?.priceMinor == null ? null : offer.priceMinor / 100, price_currency: offer?.currency ?? '',
    weight_grams: offer?.weightG ?? null, price_per_100g: offer?.unitPriceTry ?? null,
    product_url: offer?.purchaseUrl ?? '', image_url: raw.imageUrl ?? null,
    is_available: offer?.inStock === true && !coffee.discontinuedAt, is_decaf: decaf === true, is_public: true,
    brew_methods: inferred('brew_compatibility', 'brew_methods'), brew_recipes: (raw.brewRecipes ?? []) as unknown as CoffeeBrewRecipe[],
    // Historical clicks remain in the archive; they are not new-platform engagement.
    click_count: 0, last_scraped_at: coffee.lastSeenAt, last_seen_at: coffee.lastSeenAt,
    created_at: coffee.firstSeenAt, updated_at: coffee.lastSeenAt,
    roasters: { id: coffee.roaster.id, name: coffee.roaster.name, slug: coffee.roaster.slug, city: coffee.roaster.city,
      website_url: coffee.roaster.websiteUrl, shop_url: coffee.roaster.websiteUrl, logo_url: null },
    offer_id: offer?.id ?? null, stock_status: offer?.inStock ?? null, decaf_status: typeof decaf === 'boolean' ? decaf : null,
    v2_source: coffee, legacy_archive: archive,
  };
}

export async function archiveForCoffee(db: CatalogDatabase, id: string): Promise<Archive | null> {
  const row = await db.prepare("SELECT a.payload_json FROM legacy_id_map m JOIN legacy_traceability a ON a.source_table='coffees' AND a.legacy_id=m.legacy_id WHERE m.source_system='supabase' AND m.entity_type='coffee' AND m.canonical_id=? ORDER BY m.legacy_id LIMIT 1").bind(id).first<{ payload_json: string }>();
  return row ? JSON.parse(row.payload_json) as Archive : null;
}
export async function legacyCoffeeDetail(db: CatalogDatabase, slug: string) {
  const coffee = await getCoffeeDetail(db, slug);
  return coffee ? toLegacyCoffee(coffee, await archiveForCoffee(db, coffee.id)) : null;
}
export async function legacyCatalogRows(db: CatalogDatabase): Promise<LegacyCatalogCoffee[]> {
  const rows: LegacyCatalogCoffee[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await listCatalog(db, { page, perPage: 100 });
    // Archive lookup in batches avoids one D1 round trip per coffee.
    const ids = result.coffees.map(c => c.id);
    const archives = ids.length ? await db.prepare(`SELECT m.canonical_id,a.payload_json FROM legacy_id_map m JOIN legacy_traceability a ON a.source_table='coffees' AND a.legacy_id=m.legacy_id WHERE m.source_system='supabase' AND m.entity_type='coffee' AND m.canonical_id IN (${ids.map(() => '?').join(',')}) ORDER BY m.legacy_id`).bind(...ids).all<{ canonical_id: string; payload_json: string }>() : { results: [] };
    const byId = new Map<string, Archive>();
    for (const row of archives.results) if (!byId.has(row.canonical_id)) byId.set(row.canonical_id, JSON.parse(row.payload_json) as Archive);
    rows.push(...result.coffees.map(c => toLegacyCoffee(c, byId.get(c.id) ?? null)));
    if (page >= result.totalPages) return rows;
  }
  throw new Error('Retained utility catalog exceeds the 10,000-coffee scan limit');
}
export async function legacyCoffees(db: CatalogDatabase, filters: CoffeeFilters = {}) {
  let rows = await legacyCatalogRows(db);
  const matches = (accepted: string[] | undefined, actual: (string | null)[]) => !accepted?.length || accepted.some(v => actual.includes(v));
  rows = rows.filter(c => matches(filters.origin, [c.origin_country]) && matches(filters.process, [c.process]) && matches(filters.roastLevel, [c.roast_level]) && matches(filters.roaster, [c.roasters.slug]) && matches(filters.flavorCategory, c.flavor_categories) && matches(filters.brewMethod, c.brew_methods)
    && (!filters.city?.length || filters.city.some(city => normalizeCityFilterValue(city) === normalizeCityFilterValue(c.roasters.city ?? '')))
    && (filters.isDecaf == null || c.decaf_status === filters.isDecaf)
    && (!filters.singleOrigin || (c.origin_country && !SINGLE_ORIGIN_NAME_EXCLUSION_PATTERNS.some(p => c.name.toLocaleLowerCase('tr-TR').includes(p.slice(1, -1).toLocaleLowerCase('tr-TR')))))
    && (!filters.search || coffeeMatchesSearch(c, filters.search)));
  const sort = filters.sort ?? 'newest';
  if (sort.startsWith('unit_price')) rows = rows.filter(c => c.price_currency === 'TRY');
  rows.sort((a, b) => {
    if (sort === 'newest' || sort === 'popular') return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
    const field = sort.startsWith('unit_price') ? 'price_per_100g' : 'price_amount';
    const av = a[field], bv = b[field];
    return (av == null ? (bv == null ? 0 : 1) : bv == null ? -1 : (av - bv) * (sort.endsWith('desc') ? -1 : 1)) || a.id.localeCompare(b.id);
  });
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const perPage = Number.isFinite(filters.perPage) ? Math.max(1, Math.min(100, Math.floor(filters.perPage!))) : 24;
  return { coffees: rows.slice((page - 1) * perPage, page * perPage), total: rows.length, page, perPage, totalPages: Math.ceil(rows.length / perPage) };
}
function toLegacyRoaster(r: CatalogRoaster): Roaster & { coffees: { count: number }[] } {
  return { id: r.id, slug: r.slug, name: r.name, website_url: r.websiteUrl, shop_url: r.websiteUrl, logo_url: null, city: r.city,
    description: null, platform: r.adapter, is_active: true, support_tier: 'unverified', organization_id: null,
    created_at: r.lastSuccessAt ?? '', updated_at: r.lastAttemptAt ?? '', coffees: [{ count: r.coffeeCount }] };
}
export async function legacyRoasters(db: CatalogDatabase) { return (await listRoasters(db)).map(toLegacyRoaster); }
export async function legacyRoasterDetail(db: CatalogDatabase, slug: string) { const data = await getRoasterDetail(db, slug); return data ? toLegacyRoaster(data.roaster) : null; }

export async function archivedJourney(db: CatalogDatabase, lotId: string): Promise<CoffeeJourney | null> {
  const rows = await db.prepare("SELECT source_table,payload_json FROM legacy_traceability WHERE (source_table='coffee_lots' AND legacy_id=?) OR (source_table IN ('trace_events','trace_sources','coffee_assessments','coffee_certifications') AND json_extract(payload_json,'$.lot_id')=?) OR (source_table='coffee_claims' AND json_extract(payload_json,'$.subject_type')='coffee_lot' AND json_extract(payload_json,'$.subject_id')=?)").bind(lotId, lotId, lotId).all<{ source_table: string; payload_json: string }>();
  const table = <T>(name: string): T[] => rows.results.filter(r => r.source_table === name).map(r => JSON.parse(r.payload_json) as T & { is_public?: boolean }).filter(r => r.is_public === true);
  const lot = table<CoffeeLot>('coffee_lots')[0];
  if (!lot) return null;
  return { lot, events: table<CoffeeJourney['events'][number]>('trace_events').sort((a, b) => a.sequence_number - b.sequence_number || (a.event_at ?? '').localeCompare(b.event_at ?? '')),
    sources: table<CoffeeJourney['sources'][number]>('trace_sources').sort((a, b) => (b.observed_at ?? '').localeCompare(a.observed_at ?? '')),
    claims: table<CoffeeJourney['claims'][number]>('coffee_claims').sort((a, b) => b.confidence - a.confidence),
    assessments: table<CoffeeJourney['assessments'][number]>('coffee_assessments').sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)),
    certifications: table<CoffeeJourney['certifications'][number]>('coffee_certifications'), usesFallback: false };
}
export async function legacyRankingRows(db: CatalogDatabase) {
  const rows = await legacyCatalogRows(db);
  const lots = await db.prepare("SELECT legacy_id,payload_json FROM legacy_traceability WHERE source_table='coffee_lots' AND json_extract(payload_json,'$.is_public')=1").all<{ legacy_id: string; payload_json: string }>();
  const byId = new Map(lots.results.map(row => [row.legacy_id, JSON.parse(row.payload_json) as CoffeeLot]));
  return rows.map(row => ({ ...toLegacyCoffee(row.v2_source, row.legacy_archive, true), sca_score: row.sca_score, coffee_lots: row.green_lot_id ? byId.get(row.green_lot_id) ?? null : null }));
}
