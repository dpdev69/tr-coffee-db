import type { RawProduct, NormalizedCoffee } from '../types.js';
import { matchFlavorNotes } from './flavor-map.js';
import { detectProcess } from './process-map.js';
import { detectOrigin } from './origin-map.js';
import { detectRoastLevel } from './roast-level-map.js';

export function normalize(raw: RawProduct): NormalizedCoffee {
  // Combine all text sources for analysis
  const allText = [
    raw.name,
    raw.description,
    ...(raw.tags || []),
    ...collectRawDataText(raw.rawData),
  ].join(' ');

  // Origin detection
  const origin = detectOrigin(allText);

  // Process detection
  const { process, processDetail } = detectProcess(allText);

  // Roast level detection
  const roastLevel = detectRoastLevel(allText);

  // Flavor extraction
  const { notes, categories } = matchFlavorNotes(allText);

  // Variety detection
  const variety = detectVariety(allText);

  // SCA score detection
  const scaScore = detectScaScore(allText);

  // Decaf detection
  const isDecaf = /\b(decaf|kafeinsiz|caffeine[\s-]*free)\b/i.test(allText);

  // Brew method detection
  const brewMethods = detectBrewMethods(allText);

  // Normalize price to TL
  // Shopify prices come as TL already (e.g., 595.00)
  // WooCommerce prices are already normalized in the adapter
  const priceAmount = raw.price;
  const weightGrams = trustedPositiveWeight(raw.weightGrams);

  // Calculate price per 100g
  const pricePer100g =
    priceAmount !== null && weightGrams !== null
      ? Math.round((priceAmount / weightGrams) * 100 * 100) / 100
      : null;

  // Build normalized name (strip weight/brand info)
  const nameNormalized = normalizeProductName(raw.name);

  return {
    external_id: raw.externalId,
    name: raw.name,
    name_normalized: nameNormalized,
    origin_country: origin.country,
    origin_region: origin.region,
    origin_farm: origin.farm,
    origin_altitude: origin.altitude,
    origin_producer: null,
    process,
    process_detail: processDetail,
    roast_level: roastLevel,
    variety,
    flavor_notes: raw.tags?.filter(isTastingNote) || [],
    flavor_notes_normalized: notes,
    flavor_categories: categories,
    sca_score: scaScore,
    price_amount: priceAmount,
    price_currency: 'TRY',
    weight_grams: weightGrams,
    price_per_100g: pricePer100g,
    product_url: raw.productUrl,
    image_url: raw.imageUrl,
    is_available: raw.isAvailable,
    is_decaf: isDecaf,
    brew_methods: brewMethods,
  };
}

function trustedPositiveWeight(weightGrams: number | null): number | null {
  if (weightGrams === null) return null;
  if (!Number.isFinite(weightGrams)) return null;
  return weightGrams > 0 ? weightGrams : null;
}

function collectRawDataText(
  value: unknown,
  output: string[] = [],
  depth = 0
): string[] {
  if (value == null || output.length >= 100) return output;

  if (typeof value === 'string') {
    const text = value.trim();
    if (text) output.push(text);
    return output;
  }

  if (depth > 6) return output;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRawDataText(item, output, depth + 1);
    }
    return output;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectRawDataText(nested, output, depth + 1);
    }
  }

  return output;
}

function detectVariety(text: string): string | null {
  const varieties: [RegExp, string][] = [
    [/\b(geisha|gesha)\b/i, 'Gesha'],
    [/\b(bourbon|burbon)\b/i, 'Bourbon'],
    [/\b(typica|tipica)\b/i, 'Typica'],
    [/\b(caturra)\b/i, 'Caturra'],
    [/\b(catuai|catuaí)\b/i, 'Catuai'],
    [/\b(sl[\s-]*28)\b/i, 'SL28'],
    [/\b(sl[\s-]*34)\b/i, 'SL34'],
    [/\b(heirloom|yerel)\b/i, 'Heirloom'],
    [/\b(pacamara)\b/i, 'Pacamara'],
    [/\b(maragogype|maragogipe)\b/i, 'Maragogype'],
    [/\b(castillo)\b/i, 'Castillo'],
    [/\b(catimor)\b/i, 'Catimor'],
    [/\b(java)\b/i, 'Java'],
    [/\b(pink\s*bourbon)\b/i, 'Pink Bourbon'],
    [/\b(sidra)\b/i, 'Sidra'],
    [/\b(tabi)\b/i, 'Tabi'],
    [/\b(mundo\s*novo|mundo\s*nuovo)\b/i, 'Mundo Novo'],
    [/\b(74110|74112|74158)\b/i, 'Ethiopian Landrace'],
  ];

  for (const [regex, name] of varieties) {
    if (regex.test(text)) return name;
  }
  return null;
}

function detectScaScore(text: string): number | null {
  const match = text.match(/\b(sca|cupping|puan)\s*(?:score)?[\s:]*(\d{2}(?:\.\d)?)\b/i);
  if (match) {
    const score = parseFloat(match[2]);
    if (score >= 60 && score <= 100) return score;
  }
  // Also match standalone scores like "86.5" near score-related words
  const match2 = text.match(/(\d{2}\.\d)\s*(?:puan|point|score)/i);
  if (match2) {
    const score = parseFloat(match2[1]);
    if (score >= 60 && score <= 100) return score;
  }
  return null;
}

function detectBrewMethods(text: string): string[] {
  const methods: [RegExp, string][] = [
    [/\b(espresso)\b/i, 'espresso'],
    [/\b(filtre|filter|pour[\s-]*over|v60|chemex|dripper)\b/i, 'filter'],
    [/\b(french[\s-]*press|cafetiere)\b/i, 'french_press'],
    [/\b(aeropress)\b/i, 'aeropress'],
    [/\b(türk\s*kahvesi|turkish|cezve|ibrik)\b/i, 'turkish'],
    [/\b(cold[\s-]*brew|soğuk[\s-]*demleme)\b/i, 'cold_brew'],
    [/\b(moka[\s-]*pot|moka)\b/i, 'moka_pot'],
  ];

  const found = new Set<string>();
  for (const [regex, method] of methods) {
    if (regex.test(text)) found.add(method);
  }
  return [...found];
}

function normalizeProductName(name: string): string {
  return name
    // Remove weight info
    .replace(/\s*[-–]\s*\d+\s*(?:gr?|gram|kg)\b/gi, '')
    .replace(/\s+\d+\s*(?:gr?|gram|kg)\b/gi, '')
    // Remove common suffixes
    .replace(/\s*[-–]\s*(?:filtre|espresso|filter)\s*$/i, '')
    .trim();
}

function isTastingNote(tag: string): boolean {
  // Filter out non-tasting-note tags
  const excluded = [
    'indirim', 'kampanya', 'yeni', 'new', 'sale', 'black friday',
    'online', 'paket', '1 kg', '250', '500', 'avantajli',
  ];
  const lower = tag.toLowerCase().trim();
  return lower.length > 1 && !excluded.some((e) => lower.includes(e));
}
