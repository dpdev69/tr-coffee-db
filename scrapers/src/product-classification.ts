const EXCLUDED_ANYWHERE_PATTERNS = [
  /\bfiltre\s*kağıdı/i,
  /\bfiltre\s*k[aâ]ğıdı/i,
  /filtre\s*k[aâ]ğıdı/i,
  /\bfiltre\s*kagidi\b/i,
  /\bfiltresi\b/i,
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
  /\bseramik\b/i,
  /\bstoneware\b/i,
  /\bserver\b/i,
  /\böğütücü\b/i,
  /\bogutucu\b/i,
  /\bgrinder\b/i,
  /\bmakinesi\b/i,
  /\bmachine\b/i,
  /\bbaratza\b/i,
  /\bmalhkönig\b/i,
  /\bmalhkonig\b/i,
  /\bkapsül\b/i,
  /\bkapsul\b/i,
  /\bkitap\b/i,
  /\babonelik\b/i,
  /\bsubscription\b/i,
  /\bhediye\s*seti\b/i,
  /\bkahve\s*seti\b/i,
  /\btadım\s*paketi\b/i,
  /\btadim\s*paketi\b/i,
  /\bdeneme\s*paketi\b/i,
  /\bkahve\s*paketi\b/i,
  /\bpaket\s*kahve\b/i,
  /\bkeşif\s*seti\b/i,
  /\bkesif\s*seti\b/i,
  /\bkahve\s*kutusu\b/i,
  /\btanışma\s*seti\b/i,
  /\btanisma\s*seti\b/i,
  /\bkahveleri\s*seti\b/i,
  /\bkoleksiyonu\b/i,
  /\bbardak\s*altl/i,
  /\bkaşıklık\b/i,
  /\bkasiklik\b/i,
  /\bçanta\b/i,
  /\bcanta\b/i,
  /\bçuval[ıi]?\b/i,
  /\bcuval[ıi]?\b/i,
  /\badventure\s*box\b/i,
  /\bfull\s*collection\b/i,
  /\btoptan\s*giriş\b/i,
  /\btoptan\s*giris\b/i,
  /\bready\s*to\s*brew\b/i,
  /\biçilmeye\s*hazır\b/i,
  /\bicilmeye\s*hazir\b/i,
  /\bşişe\s*dahil\b/i,
  /\bsise\s*dahil\b/i,
  /\bçiğ\s*yeşil\s*(?:kahve\s*)?çekirdek\b/i,
  /\bcig\s*yesil\s*(?:kahve\s*)?cekirdek\b/i,
];

const EXCLUDED_PRODUCT_NAME_PATTERNS = [
  /çikolata/i,
  /\bcikolata\b/i,
  /\bkakao\b/i,
];

export function isLikelyCatalogCoffeeProduct(parts: Array<string | null | undefined>) {
  const normalizedParts = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase());
  const productName = normalizedParts[0] ?? '';
  const haystack = normalizedParts.join(' ');

  return (
    !EXCLUDED_ANYWHERE_PATTERNS.some((pattern) => pattern.test(haystack)) &&
    !EXCLUDED_PRODUCT_NAME_PATTERNS.some((pattern) => pattern.test(productName))
  );
}
