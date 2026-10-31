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
  /\borigami\b/i,
  /\blily\s*drip\b/i,
  /\blilydrip\b/i,
  /\böğütücü\b/i,
  /\bogutucu\b/i,
  /\bgrinder\b/i,
  /\bde[ğg]irmen\b/i,
  /\bterazi\b/i,
  /\bscale\b/i,
  /\bmakinesi\b/i,
  /\bmachine\b/i,
  /\bbaratza\b/i,
  /\bmalhkönig\b/i,
  /\bmalhkonig\b/i,
  /\bcomandante\b/i,
  /\btimemore\b/i,
  /\baeropress\b/i,
  /\bkinu\b/i,
  /\bkapsül\b/i,
  /\bkapsul\b/i,
  /\bkitap\b/i,
  /\bq\s*grader\b/i,
  /\bsertifika(?:syon)?\b/i,
  /\bcertification\b/i,
  /\bprogram[ıi]?\b/i,
  /\beğitim\b/i,
  /\begitim\b/i,
  /\bworkshop\b/i,
  /\batölye\b/i,
  /\batolye\b/i,
  /\bkurs\b/i,
  /\bcourse\b/i,
  /\bconsultancy\b/i,
  /\bdanışmanlık\b/i,
  /\bdanismanlik\b/i,
  /\bretakes?\b/i,
  /\bfoundation\b/i,
  /\bintermediate\b/i,
  /\bprofessional\b/i,
  /abonelik|aboneli[ğg]i/i,
  /\bsubscription\b/i,
  /kampanya(?:s[ıi])?/i,
  /\bcampaign\b/i,
  /\bbundle\b/i,
  /\bgroup\s*buy\b/i,
  /\bgroup-buy\b/i,
  /\bhediye\s*seti\b/i,
  /\bkahve\s*seti\b/i,
  /\bkahve\s*paketi\b/i,
  /\bpaket\s*kahve\b/i,
  /\bkahve\s*kutusu\b/i,
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
  /\by[üu]zen\s*kahve\b/i,
  /\bcandle\b/i,
  /\bmum\b/i,
  /\biçilmeye\s*hazır\b/i,
  /\bicilmeye\s*hazir\b/i,
  /\ba[şs][ıi]r[ıi]\s*kolay\s*cold\s*brew\b/i,
  /\bcam\s*şişe\b/i,
  /\bcam\s*sise\b/i,
  /\bşişe\s*dahil\b/i,
  /\bsise\s*dahil\b/i,
  /\bpeak\s*water\b/i,
  /\bkahve\s*suyu\b/i,
  /çiğ\s*yeşil\s*(?:kahve\s*)?çekirdek/i,
  /cig\s*yesil\s*(?:kahve\s*)?cekirdek/i,
];

// Trial and sample sets. In the product name they always exclude; in a shop category only when the name is not a
// single origin: Gourme files the one coffee "Honduras El Jardin (100GR)" under "Deneme Seti".
const SAMPLE_SET_PATTERNS = [/\btad[ıi]m\s*paketi\b/i, /\bdeneme\s*(?:paketi|seti)\b/i, /\bsample\s*(?:box|pack)\b/i, /\bke[şs]if\s*seti\b/i, /\btan[ıi][şs]ma\s*seti\b/i];

export const STRUCTURED_ORIGIN_TITLE_COUNTRY_PATTERN =
  /\b(?:etiyopya|ethiopia|ethiopian|kolombiya|colombia|colombian|brezilya|brazil|brazilian|brasil|kenya|kenyan|guatemala|guatemalan|kosta\s*rika|kostarika|costa\s*rica|panama|panamanian|peru|peruvian|honduras|honduran|el\s*salvador|salvadoran|meksika|mexico|mexican|endonezya|indonesia|indonesian|sumatra|rwanda|ruanda|rwandan|burundi|burundian|tanzanya|tanzania|tanzanian|uganda|ugandan|nikaragua|nicaragua|bolivya|bolivia|ekvador|ecuador|hindistan|india|indian|yemen|yemeni|kongo|congo|drc|dominik|dominican|küba|cuba|papua|png|çin|china|yunnan|myanmar|burma|vietnam)\b/i;

const ORIGIN_COUNTRIES = new RegExp(STRUCTURED_ORIGIN_TITLE_COUNTRY_PATTERN.source, 'gi');

/** One origin country and no pack wording: "Honduras El Jardin (100GR)", not "Kenya & Ethiopia" or "Panama Seti". */
function isSingleOriginName(name: string) {
  const lower = name.toLocaleLowerCase('tr');
  return new Set((lower.match(ORIGIN_COUNTRIES) ?? []).map((origin) => origin.replace(/\s+/g, ''))).size === 1 &&
    !/\bset(?:i|leri)?\b|paket|kutu|\bbox\b|[2-9]\s*x\s*\d|\s[&+]\s/i.test(lower);
}

const EXCLUDED_PRODUCT_NAME_PATTERNS = [
  // Paper files chocolate bars under Kahve; its Mixed Fruit Box is four 50 g coffee samples.
  // Both belong outside single-coffee comparisons, while chocolate/fruit tasting notes stay valid.
  /^paper\s+chocolate\b/i,
  /^mixed\s+fruit\s+box\b/i,
  /\bgift\s*set\b/i,
  /\b(?:matcha|chasen|chawan)\b/i,
  /(?:^|\s)(?:çay|cay|tea)\s+(?:demleme\s+)?(?:seti?|kit)\b/i,
  /^(?:yeşil|yesil|siyah|bitki)\s+çay[ıi]?(?:\s|$)/i,
  /^(?:green|black|herbal)\s+tea(?:\s|$)/i,
  /^(?:kakao|çikolata|cikolata)(?:\s+(?:bar|tablet|tozu|nibs?))?$/i,
  /(?:^|\s)(?:kakao|çikolata|cikolata)\s+(?:bar|tablet|tozu|nibs?)\b/i,
];

export function isLikelyCatalogCoffeeProduct(parts: Array<string | null | undefined>) {
  const normalizedParts = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase());
  const productName = normalizedParts[0] ?? '';
  const haystack = normalizedParts.join(' ');

  const sampleSet = SAMPLE_SET_PATTERNS.some((pattern) => pattern.test(productName)) ||
    (SAMPLE_SET_PATTERNS.some((pattern) => pattern.test(haystack)) && !isSingleOriginName(parts.find(Boolean) ?? ''));

  return (
    !sampleSet &&
    !EXCLUDED_ANYWHERE_PATTERNS.some((pattern) => pattern.test(haystack)) &&
    !EXCLUDED_PRODUCT_NAME_PATTERNS.some((pattern) => pattern.test(productName))
  );
}
