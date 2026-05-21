import type { BrewRecipe } from '../types.js';

const RECIPE_HEADING =
  /(demleme\s*(reçetesi|recetesi|önerisi|onerisi)|referans\s*reçete|referans\s*recete|reçete|recete|brew\s*recipe|brew\s*guide|recipe|nasıl\s*demlemeli|nasil\s*demlemeli)/i;

const METHOD_PATTERNS: Array<[RegExp, string]> = [
  [/\b(v60|pour\s*over|pourover|filter|filtre|chemex|dripper|origami)\b/i, 'Filter / Pour Over'],
  [/\bespresso\b/i, 'Espresso'],
  [/\baeropress\b/i, 'Aeropress'],
  [/\b(french\s*press|cafetiere)\b/i, 'French Press'],
  [/\b(türk\s*kahvesi|turk\s*kahvesi|cezve|ibrik)\b/i, 'Türk Kahvesi'],
  [/\b(cold\s*brew|soğuk\s*demleme|soguk\s*demleme)\b/i, 'Cold Brew'],
  [/\bmoka\s*pot\b/i, 'Moka Pot'],
];

export function extractBrewRecipes(text: string): BrewRecipe[] {
  if (!RECIPE_HEADING.test(text)) return [];

  const compact = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const method = detectMethod(compact);
  const dose = extractNumber(compact, /(?:doz|dose|kahve|coffee)\D{0,24}(\d{1,3}(?:[.,]\d+)?)(?:\s*)(?:g|gr|gram)\b/i);
  const water = extractNumber(compact, /(?:su|water)\D{0,24}(\d{2,4})(?:\s*)(?:g|gr|gram|ml)\b/i);
  const espressoYield = extractNumber(compact, /(?:yield|çıktı|cikti|verim)\D{0,24}(\d{2,4})(?:\s*)(?:g|gr|gram|ml)\b/i);
  const ratio = extractText(compact, /\b(1\s*[:/]\s*\d{1,2}(?:[.,]\d+)?)\b/i);
  const temperature = extractTemperature(compact);
  const brewTime = extractText(
    compact,
    /(?:süre|sure|time|brew\s*time|demleme\s*süresi|demleme\s*suresi)\D{0,24}((?:\d{1,2}:)?\d{1,2}(?::\d{2})?|\d+\s*(?:sn|saniye|sec|dk|dakika|min))\b/i
  );
  const grind = extractText(
    compact,
    /(?:öğütüm|ogutum|grind|değirmen|degirmen)\D{0,32}([^.;\n|]{3,80})/i
  );
  const steps = extractSteps(compact);
  const signals = [method, dose, water, espressoYield, ratio, temperature, brewTime, grind, steps.length > 0]
    .filter(Boolean)
    .length;

  if (signals < 3) return [];

  return [
    {
      method: method ?? 'Belirtilmemiş',
      dose_grams: dose,
      water_grams: water,
      yield_grams: espressoYield,
      ratio,
      grind,
      water_temp_c: temperature,
      brew_time: brewTime,
      steps,
      note: null,
      source: 'product_page',
      source_text: compact.slice(0, 700),
    },
  ];
}

function detectMethod(text: string) {
  for (const [regex, method] of METHOD_PATTERNS) {
    if (regex.test(text)) return method;
  }

  return null;
}

function extractNumber(text: string, regex: RegExp) {
  const match = text.match(regex);
  if (!match) return null;

  const value = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function extractText(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function extractTemperature(text: string) {
  const match = text.match(/(\d{2,3})(?:\s*[-–]\s*(\d{2,3}))?\s*(?:°\s*)?(?:c|derece)\b/i);
  if (!match) return null;

  return match[2] ? `${match[1]}-${match[2]} C` : `${match[1]} C`;
}

function extractSteps(text: string) {
  const stepMatches = text.match(
    /(?:bloom|ön demleme|on demleme|dök|dok|pour|bekle|karıştır|karistir)[^.\n]*(?:[.\n]|$)/gi
  );

  return (stepMatches ?? [])
    .map((step) => step.replace(/\s+/g, ' ').replace(/[.\n]+$/g, '').trim())
    .filter((step) => step.length >= 8)
    .slice(0, 6);
}
