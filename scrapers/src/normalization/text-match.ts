const TOKEN_LEFT = String.raw`(?:^|[^\p{L}\p{N}])`;
const TOKEN_RIGHT = String.raw`(?=$|[^\p{L}\p{N}])`;

export function tokenRegex(source: string): RegExp {
  return new RegExp(`${TOKEN_LEFT}(${source})${TOKEN_RIGHT}`, 'iu');
}

export function matchedToken(match: RegExpMatchArray): string {
  return (match[1] ?? match[0]).trim();
}

/**
 * Turkish-aware case folding to lowercase ASCII: I/ı/İ/i all become "i" and ş ğ ç ö ü lose their marks, so
 * "YIKANMIŞ", "Yıkanmış" and "yikanmis" fold alike. Same length as the input for Latin text, so indexes carry over.
 */
export function foldTr(text: string): string {
  return text.replace(/ı/g, 'i').replace(/İ/g, 'I').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** For each whole-word match of a label (written in folded form), the label and the `after` characters behind it, cut at the sentence end. */
export function labelContexts(text: string, label: string, after: number): string[] {
  const folded = foldTr(text);
  const regex = new RegExp(`${TOKEN_LEFT}(${label})${TOKEN_RIGHT}`, 'giu');
  return [...folded.matchAll(regex)].map((match) => {
    const end = match.index + match[0].length;
    return match[1] + folded.slice(end, end + after).split(/[.!?\n;|]/)[0];
  });
}

/** Remove the roaster's own name (full and without a trailing "Coffee Roasters"-style suffix) so it never reads as data. */
export function stripRoasterName(text: string, roasterName: unknown): string {
  if (typeof roasterName !== 'string' || !roasterName.trim()) return text;
  const full = roasterName.trim();
  const short = full.replace(/(?:\s+(?:coffee|roasters?|roastery|roasting|co\.?|company|kahve))+$/iu, '');
  let result = text;
  for (const name of new Set([full, short])) {
    if (name.length < 3) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, String.raw`\s+`);
    result = result.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'giu'), '$1 ');
  }
  return result;
}
