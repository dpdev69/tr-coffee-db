// Detect roast level from product text and tags

import { tokenRegex } from './text-match.js';

const ROAST_MAP: [RegExp, string][] = [
  [tokenRegex(String.raw`orta[\s-]*açık|orta[\s-]*acik|medium[\s-]*light`), 'medium_light'],
  [tokenRegex(String.raw`orta[\s-]*koyu|medium[\s-]*dark`), 'medium_dark'],
  [tokenRegex(String.raw`filter\s*roast|filter\s*profile|filtre\s*(?:için|icin|kavrum|kavurma)|pour[\s-]*over|omni(?:roast)?|omni`), 'light'],
  [tokenRegex(String.raw`açık\s*kavurma|acik\s*kavurma|light\s*roast|light|düşük|dusuk|açık|acik`), 'light'],
  [tokenRegex(String.raw`espresso\s*roast|espresso\s*kavrum|espresso\s*kavurma|espresso`), 'medium_dark'],
  [tokenRegex(String.raw`orta\s*kavurma|medium\s*roast|medium|orta`), 'medium'],
  [tokenRegex(String.raw`french\s*roast|koyu\s*kavurma|dark\s*roast|dark|koyu`), 'dark'],
];

export function detectRoastLevel(text: string): string {
  // Check from most specific to least specific
  for (const [regex, level] of ROAST_MAP) {
    if (regex.test(text)) {
      return level;
    }
  }
  return 'unknown';
}
