// Detect roast level from product text and tags

const ROAST_MAP: [RegExp, string][] = [
  [/\b(orta[\s-]*açık|medium[\s-]*light)\b/i, 'medium_light'],
  [/\b(orta[\s-]*koyu|medium[\s-]*dark)\b/i, 'medium_dark'],
  [/\b(filter\s*roast|filter\s*profile|filtre\s*(?:için|icin|kavrum|kavurma)|pour[\s-]*over|omni(?:roast)?|omni)\b/i, 'light'],
  [/\b(açık\s*kavurma|light\s*roast|light|düşük|açık)\b/i, 'light'],
  [/\b(espresso\s*roast|espresso\s*kavrum|espresso\s*kavurma|espresso)\b/i, 'medium_dark'],
  [/\b(orta\s*kavurma|medium\s*roast|medium|orta)\b/i, 'medium'],
  [/\b(french\s*roast)\b/i, 'dark'],
  [/\b(koyu\s*kavurma|dark\s*roast|dark|koyu)\b/i, 'dark'],
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
