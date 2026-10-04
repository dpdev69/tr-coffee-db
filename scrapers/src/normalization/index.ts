import type { RawProduct, NormalizedCoffee } from '../types.js';
import { matchFlavorNotes } from './flavor-map.js';
import { PROCESS_LABEL, processesStatedIn } from './process-map.js';
import { detectCountries, detectOrigin } from './origin-map.js';
import { foldTr, labelContexts, stripRoasterName, tokenRegex } from './text-match.js';
import { detectRoastLevel, detectStandaloneRoastLevel } from './roast-level-map.js';
import { extractBrewRecipes } from './brew-recipes.js';

/** The v2 pipeline names the roaster here so its own name is never read as an attribute ("Old Java" is not Java). */
const ROASTER_NAME_KEY = 'v2RoasterName';

/**
 * Origins, processes and varieties the text states, every one of them. Declared text (the name, roaster-labelled
 * fields, text beside a label) wins over running prose, and an empty result means the text does not say.
 */
export function detectStatedAttributes(raw: RawProduct): {
  countries: string[];
  processes: { process: string; detail: string }[];
  varieties: string[];
} {
  const roaster = raw.rawData?.[ROASTER_NAME_KEY];
  const name = stripRoasterName(raw.name, roaster);
  const allText = stripRoasterName(collectAllText(raw), roaster);

  const declaredOrigin = [
    name,
    ...collectLabeledTextCandidates(raw.rawData, /\b(?:ulke|country|mensei|mense|origin|koken)\b/),
    ...collectNamedRawDataText(raw.rawData, new Set(['origin', 'koken_tr', 'country'])),
    ...labelContexts(allText, 'ulke|country|mensei|mense', 40),
  ].join(' | ');
  const countries = detectCountries(declaredOrigin);

  // islem_tr is Parsa's own process field ("Natürel"), declared like koken_tr and cultivar.
  const labelledProcess = [...collectLabeledTextCandidates(raw.rawData, new RegExp(`\\b(?:${PROCESS_LABEL})\\b`)), ...collectNamedRawDataText(raw.rawData, new Set(['islem_tr']))].join(' | ');
  const processes = processesStatedIn(name, labelledProcess, allText);

  const declaredVariety = [...labelContexts(allText, VARIETY_LABEL, 80), ...collectNamedRawDataText(raw.rawData, new Set(['cultivar']))].join(' | ');
  return {
    countries: countries.length ? countries : detectCountries(allText).slice(0, 1),
    processes,
    varieties: detectVarieties(name, declaredVariety, allText),
  };
}

export function normalize(raw: RawProduct): NormalizedCoffee {
  const stated = detectStatedAttributes(raw);
  // Combine all text sources for analysis
  const allText = stripRoasterName(collectAllText(raw), raw.rawData?.[ROASTER_NAME_KEY]);

  // Origin detection
  const origin = { ...detectOrigin(allText), country: stated.countries[0] ?? null };

  // Process detection: the primary (first) process for the single-valued legacy field
  const { process, detail: processDetail } = stated.processes[0] ?? { process: 'unknown', detail: null };

  const roastLevel = detectRoastLevelFromRawProduct(raw, allText);

  // Flavor extraction
  const { notes, categories } = matchFlavorNotes(allText);

  // Variety detection
  const variety = stated.varieties[0] ?? null;

  const harvestYear = detectHarvestYear(allText);
  const roastDate = detectRoastDate(allText);

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
    harvest_year: harvestYear,
    roast_date: roastDate,
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
    brew_recipes: raw.brewRecipes ?? extractBrewRecipes(raw.description),
  };
}

function collectAllText(raw: RawProduct): string {
  // Addresses name shops and files, never coffees ("oldjavacoffee.com", "…/panama-2024.jpg").
  return [raw.name, raw.description, ...(raw.tags || []), ...collectRawDataText(raw.rawData)].join(' ').replace(/https?:\/\/\S+/gi, ' ');
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

function detectRoastLevelFromRawProduct(raw: RawProduct, allText: string): string {
  for (const candidate of collectLabeledTextCandidates(
    raw.rawData,
    /\b(?:kavrum|kavurma|kavrulma|roast|profil|profile)\b/
  )) {
    const detected = detectStandaloneRoastLevel(candidate);
    if (detected !== 'unknown') return detected;
  }

  // Only an explicit roast statement counts. "Espresso" or "Filtre" in a name, tag or category says how to brew
  // the coffee, not how dark it is roasted.
  return detectRoastLevel(allText);
}

function collectNamedRawDataText(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  output: string[] = []
): string[] {
  if (value == null || output.length >= 50) return output;

  if (Array.isArray(value)) {
    for (const item of value) collectNamedRawDataText(item, allowedKeys, output);
    return output;
  }

  if (typeof value !== 'object') return output;

  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if (allowedKeys.has(key)) {
      collectTextLeaves(nested, output);
      continue;
    }

    collectNamedRawDataText(nested, allowedKeys, output);
  }

  return output;
}

const VARIETY_LABEL = 'varyete|varyetesi|varyeteler|varyeteleri|variety|varieties|cultivar|cultivars|tur|turu|cesit|cesidi|cesitler|cesitleri';

function collectLabeledTextCandidates(
  value: unknown,
  labelPattern: RegExp,
  output: string[] = []
): string[] {
  if (value == null || output.length >= 30) return output;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLabeledTextCandidates(item, labelPattern, output);
    }
    return output;
  }

  if (typeof value !== 'object') return output;

  const record = value as Record<string, unknown>;
  const fieldName = [record.name, record.label, record.key]
    .filter((item): item is string => typeof item === 'string')
    .join(' ');

  if (labelPattern.test(foldTr(fieldName))) {
    collectTextLeaves(record.value, output);
    collectTextLeaves(record.values, output);
    collectTextLeaves(record.term, output);
    collectTextLeaves(record.terms, output);
  }

  for (const nested of Object.values(record)) {
    collectLabeledTextCandidates(nested, labelPattern, output);
  }

  return output;
}

function collectTextLeaves(value: unknown, output: string[]): void {
  if (value == null || output.length >= 30) return;

  if (typeof value === 'string') {
    const text = value.trim();
    if (text) output.push(text);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectTextLeaves(item, output);
    return;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectTextLeaves(nested, output);
    }
  }
}

// [pattern on foldTr text, variety, where it may be read]. "tabi" (of course) and "java" (an island) are ordinary
// words, so Tabi counts only in the name or beside a variety label and Java only beside a variety label.
const VARIETIES: [RegExp, string, 'any' | 'name' | 'declared'][] = [
  [tokenRegex('geisha|gesha'), 'Gesha', 'any'],
  [tokenRegex('(?<!pink\\s*)(?:bourbon|burbon)'), 'Bourbon', 'any'],
  [tokenRegex('typica|tipica'), 'Typica', 'any'],
  [tokenRegex('caturra'), 'Caturra', 'any'],
  [tokenRegex('catuai'), 'Catuai', 'any'],
  [tokenRegex('sl[\\s-]*28'), 'SL28', 'any'],
  [tokenRegex('sl[\\s-]*34'), 'SL34', 'any'],
  [tokenRegex('heirloom'), 'Heirloom', 'any'],
  [tokenRegex('pacamara'), 'Pacamara', 'any'],
  [tokenRegex('maragogype|maragogipe'), 'Maragogype', 'any'],
  [tokenRegex('castillo'), 'Castillo', 'any'],
  [tokenRegex('catimor'), 'Catimor', 'any'],
  [tokenRegex('java'), 'Java', 'declared'],
  [tokenRegex('pink\\s*bourbon'), 'Pink Bourbon', 'any'],
  [tokenRegex('sidra'), 'Sidra', 'any'],
  [tokenRegex('tabi'), 'Tabi', 'name'],
  [tokenRegex('mundo\\s*novo|mundo\\s*nuovo'), 'Mundo Novo', 'any'],
  [tokenRegex('74110|74112|74158'), 'Ethiopian Landrace', 'any'],
];

/** Every variety the name or a variety-labelled field states; running prose is a last resort. */
function detectVarieties(name: string, declared: string, prose: string): string[] {
  const named = foldTr(name);
  const labelled = foldTr(declared);
  const stated = VARIETIES.filter(([regex, , scope]) => regex.test(labelled) || (scope !== 'declared' && regex.test(named)));
  if (stated.length) return stated.map(([, variety]) => variety);

  // ponytail: prose often lists the farm's or the country's varieties, not this lot's. More than two = a list, so say nothing.
  const text = foldTr(prose);
  const mentioned = VARIETIES.filter(([regex, , scope]) => scope === 'any' && regex.test(text));
  return mentioned.length <= 2 ? mentioned.map(([, variety]) => variety) : [];
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

function detectHarvestYear(text: string): string | null {
  const patterns = [
    /(?:hasat|harvest|crop|mahsul)\s*(?:yılı|yili|year)?\s*[:\-]?\s*((?:20\d{2})(?:\s*[\/\-]\s*(?:20)?\d{2})?)/i,
    /\b((?:20\d{2})(?:\s*[\/\-]\s*(?:20)?\d{2})?)\s*(?:hasat|harvest|crop|mahsul)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, '');
  }

  return null;
}

function detectRoastDate(text: string): string | null {
  const match = text.match(
    /(?:kavrum|kavrulma|roast)\s*(?:tarihi|date)?\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-](?:20)?\d{2})/i
  );

  return match?.[1] ?? null;
}

function detectBrewMethods(text: string): string[] {
  const methods: [RegExp, string][] = [
    [/\b(espresso)\b/i, 'espresso'],
    [/\b(filtre|filter|pour[\s-]*over|v60|chemex|dripper)\b/i, 'filter'],
    [/\b(french[\s-]*press|cafetiere)\b/i, 'french_press'],
    [/\b(aeropress)\b/i, 'aeropress'],
    [/\b(türk\s*kahvesi|turkish|cezve|ibrik)\b/i, 'turkish'],
    [/\b(cold[\s-]*brew|soğuk[\s-]*demleme)\b/i, 'cold_brew'],
    // "Moka" alone is also a supplier ("Moka Trade") or a variety (Mokka); only the pot is a brew method.
    [/\b(moka[\s-]*pot)\b/i, 'moka_pot'],
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

/** A tag is a tasting note only when it names a flavor. Shop tags ("Kahve", "reklam", "Fresh Roasted") never do. */
function isTastingNote(tag: string): boolean {
  return matchFlavorNotes(tag, true, true).notes.length > 0;
}
