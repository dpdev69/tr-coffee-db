// Detect roast level from product text and tags

import { tokenRegex } from './text-match.js';

const ROAST_LABEL = String.raw`(?:kavrum|kavurma|roast)(?:\s*(?:profili|profile|seviyesi|level|derecesi))?`;

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
  [/^(?:açık[\s–-]*orta|acik[\s–-]*orta|light[\s–-]*medium)$/iu, 'medium_light'],
  [/^(?:orta[\s-]*açık|orta[\s-]*acik|medium[\s-]*light)$/iu, 'medium_light'],
  [/^(?:orta[\s-]*koyu|medium[\s-]*dark)$/iu, 'medium_dark'],
  [/^(?:açık|acik|light|düşük|dusuk)$/iu, 'light'],
  [/^(?:orta|medium)$/iu, 'medium'],
  [/^(?:koyu|dark|french)$/iu, 'dark'],
];

export function detectRoastLevel(text: string): string {
  for (const [regex, level] of [...LABELED_ROAST_MAP, ...PHRASE_ROAST_MAP]) {
    if (regex.test(text)) {
      return level;
    }
  }
  return 'unknown';
}

export function detectStandaloneRoastLevel(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  for (const [regex, level] of STANDALONE_ROAST_MAP) {
    if (regex.test(normalized)) {
      return level;
    }
  }

  return 'unknown';
}
