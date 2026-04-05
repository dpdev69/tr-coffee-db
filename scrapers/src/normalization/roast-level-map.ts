// Detect roast level from product text and tags

const ROAST_MAP: [RegExp, string][] = [
  [/\b(açık\s*kavurma|light\s*roast|light|düşük|açık)\b/i, 'light'],
  [/\b(orta[\s-]*açık|medium[\s-]*light)\b/i, 'medium_light'],
  [/\b(orta\s*kavurma|medium\s*roast|medium|orta)\b/i, 'medium'],
  [/\b(orta[\s-]*koyu|medium[\s-]*dark)\b/i, 'medium_dark'],
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
