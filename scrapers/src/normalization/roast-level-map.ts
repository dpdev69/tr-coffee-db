// Detect roast level from product text and tags

import { foldTr, tokenRegex } from './text-match.js';

const ROAST_LABEL = String.raw`(?:kavrum|kavurma|kavrulma|roast)(?:\s*(?:profili|profile|seviyesi|level|derecesi))?`;

const LABELED_ROAST_MAP: [RegExp, string][] = [
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:filtre|filter)`), 'medium_light'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:espresso)`), 'medium_dark'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:açık[\s–-]*orta|acik[\s–-]*orta|light[\s–-]*medium)`), 'medium_light'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:orta[\s-]*açık|orta[\s-]*acik|medium[\s-]*light)`), 'medium_light'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:orta[\s-]*koyu|medium[\s-]*dark)`), 'medium_dark'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:açık|acik|light|düşük|dusuk)`), 'light'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:orta|medium)`), 'medium'],
  [tokenRegex(String.raw`${ROAST_LABEL}\s*[:\-]?\s*(?:koyu|dark|french)`), 'dark'],
];

const PHRASE_ROAST_MAP: [RegExp, string][] = [
  [tokenRegex(String.raw`(?:dark|koyu)\s*(?:filtre|filter|espresso|kahve)`), 'dark'],
  [tokenRegex(String.raw`(?:filtre|filter)\s*roast|(?:filtre|filter)\s*kavrum(?:u)?`), 'medium_light'],
  [tokenRegex(String.raw`espresso\s*roast|espresso\s*kavrum(?:u)?`), 'medium_dark'],
  [tokenRegex(String.raw`açık[\s–-]*orta\s*(?:kavrum|kavurma)|acik[\s–-]*orta\s*(?:kavrum|kavurma)|light[\s–-]*medium\s*roast`), 'medium_light'],
  [tokenRegex(String.raw`orta[\s-]*açık\s*(?:kavrum|kavurma)|medium[\s-]*light\s*roast`), 'medium_light'],
  [tokenRegex(String.raw`orta[\s-]*koyu\s*(?:kavrum|kavurma)|medium[\s-]*dark\s*roast`), 'medium_dark'],
  [tokenRegex(String.raw`açık\s*kavurma|acik\s*kavurma|light\s*roast|düşük\s*kavrum|dusuk\s*kavrum`), 'light'],
  [tokenRegex(String.raw`orta\s*kavurma|medium\s*roast`), 'medium'],
  [tokenRegex(String.raw`french\s*roast|koyu\s*kavurma|dark\s*roast`), 'dark'],
];

const STANDALONE_ROAST_MAP: [RegExp, string][] = [
  [/^(?:filtre|filter)$/iu, 'medium_light'],
  [/^(?:espresso)$/iu, 'medium_dark'],
  [/^(?:açık[\s–-]*orta|acik[\s–-]*orta|light[\s–-]*medium)$/iu, 'medium_light'],
  [/^(?:orta[\s-]*açık|orta[\s-]*acik|medium[\s-]*light)$/iu, 'medium_light'],
  [/^(?:orta[\s-]*koyu|medium[\s-]*dark)$/iu, 'medium_dark'],
  [/^(?:açık|acik|light|düşük|dusuk)$/iu, 'light'],
  [/^(?:orta|medium)$/iu, 'medium'],
  [/^(?:koyu|dark|french)$/iu, 'dark'],
];

export function detectRoastLevel(rawText: string): string {
  const text = foldTr(rawText); // every pattern below has an ASCII spelling, so "AÇIK KAVRUM" reads like "acik kavrum"
  for (const [regex, level] of [...LABELED_ROAST_MAP, ...PHRASE_ROAST_MAP]) {
    if (regex.test(text)) {
      return level;
    }
  }
  const agtronLevel = detectAgtronRoastLevel(text);
  if (agtronLevel !== 'unknown') return agtronLevel;
  return 'unknown';
}

export function detectStandaloneRoastLevel(text: string): string {
  const normalized = foldTr(text).replace(/\s+/g, ' ').trim();

  for (const [regex, level] of STANDALONE_ROAST_MAP) {
    if (regex.test(normalized)) {
      return level;
    }
  }

  return 'unknown';
}

function detectAgtronRoastLevel(text: string): string {
  const match =
    text.match(/\b(?:agtron|kavrulma\s+seviyesi)\D{0,24}(\d{2,3})\b/i) ??
    text.match(/\b(\d{2,3})\s*agtron\b/i);
  if (!match) return 'unknown';

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value)) return 'unknown';

  if (value >= 85) return 'light';
  if (value >= 75) return 'medium_light';
  if (value >= 65) return 'medium';
  if (value >= 55) return 'medium_dark';
  return 'dark';
}
