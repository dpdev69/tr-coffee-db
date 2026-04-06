const EXCLUDED_TITLE_PATTERNS = [
  /\bfiltre\s*kağıdı\b/i,
  /\bfiltre\s*kagidi\b/i,
  /\bfilter\s*paper\b/i,
  /\bdripper\b/i,
  /\bchemex\b/i,
  /\bv60\b/i,
  /\bhario\b/i,
  /\bcafec\b/i,
  /\bkalita\b/i,
  /\btrapezoid\b/i,
  /\bkupa\b/i,
  /\bmug\b/i,
  /\bfincan\b/i,
  /\btakım\b/i,
  /\btakimi\b/i,
  /\bstoneware\b/i,
  /\bserver\b/i,
  /\böğütücü\b/i,
  /\bogutucu\b/i,
  /\bgrinder\b/i,
  /\bbaratza\b/i,
  /\bmalhkönig\b/i,
  /\bmalhkonig\b/i,
  /\bkapsül\b/i,
  /\bkapsul\b/i,
  /\bhediye\s*seti\b/i,
  /\bkahve\s*seti\b/i,
  /\btadım\s*paketi\b/i,
  /\btadim\s*paketi\b/i,
  /\bdeneme\s*paketi\b/i,
  /\btanışma\s*seti\b/i,
  /\btanisma\s*seti\b/i,
  /\bkahveleri\s*seti\b/i,
  /\badventure\s*box\b/i,
  /\bfull\s*collection\b/i,
  /\btoptan\s*giriş\b/i,
  /\btoptan\s*giris\b/i,
  /\bready\s*to\s*brew\b/i,
  /\biçilmeye\s*hazır\b/i,
  /\bicilmeye\s*hazir\b/i,
  /\bşişe\s*dahil\b/i,
  /\bsise\s*dahil\b/i,
];

export function isLikelyCatalogCoffeeProduct(parts: Array<string | null | undefined>) {
  const haystack = parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();

  return !EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(haystack));
}
