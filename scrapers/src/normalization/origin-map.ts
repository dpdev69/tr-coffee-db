// Extract origin country, region, altitude from product text

const COUNTRY_MAP: [RegExp, string][] = [
  [/\b(etiyopya|ethiopia|ethiopian)\b/i, 'Ethiopia'],
  [/\b(kolombiya|colombia|colombian)\b/i, 'Colombia'],
  [/\b(brezilya|brazil|brazilian|brasil)\b/i, 'Brazil'],
  [/\b(kenya|kenyan)\b/i, 'Kenya'],
  [/\b(guatemala|guatemalan)\b/i, 'Guatemala'],
  [/\b(kosta\s*rika|kostarika|costa\s*rica)\b/i, 'Costa Rica'],
  [/\b(panama|panamanian)\b/i, 'Panama'],
  [/\b(peru|peruvian)\b/i, 'Peru'],
  [/\b(honduras|honduran)\b/i, 'Honduras'],
  [/\b(el\s*salvador|salvadoran)\b/i, 'El Salvador'],
  [/\b(meksika|mexico|mexican)\b/i, 'Mexico'],
  [/\b(endonezya|indonesia|indonesian|sumatra)\b/i, 'Indonesia'],
  [/\b(rwanda|ruanda|rwandan)\b/i, 'Rwanda'],
  [/\b(burundi|burundian)\b/i, 'Burundi'],
  [/\b(tanzanya|tanzania|tanzanian)\b/i, 'Tanzania'],
  [/\b(uganda|ugandan)\b/i, 'Uganda'],
  [/\b(nikaragua|nicaragua)\b/i, 'Nicaragua'],
  [/\b(bolivya|bolivia)\b/i, 'Bolivia'],
  [/\b(ekvador|ecuador)\b/i, 'Ecuador'],
  [/\b(hindistan|india|indian)\b/i, 'India'],
  [/\b(yemen|yemeni)\b/i, 'Yemen'],
  [/\b(kongo|congo|drc)\b/i, 'DR Congo'],
  [/\b(dominik|dominican)\b/i, 'Dominican Republic'],
  [/\b(kuba|cuba)\b/i, 'Cuba'],
  [/\b(papua|png)\b/i, 'Papua New Guinea'],
  [/\b(cin|china(?!\s+alta\b)|yunnan)\b/i, 'China'], // "China Alta" is a Colombian lot
  [/\b(myanmar|burma)\b/i, 'Myanmar'],
  [/\b(vietnam)\b/i, 'Vietnam'],
];

// Known regions per country
const REGION_PATTERNS: [RegExp, string][] = [
  // Ethiopia
  [/\b(yirgacheffe|yirga\s*cheffe|yirgachefe)\b/i, 'Yirgacheffe'],
  [/\b(sidamo|sidama)\b/i, 'Sidama'],
  [/\b(guji)\b/i, 'Guji'],
  [/\b(harrar|harar)\b/i, 'Harrar'],
  [/\b(limu)\b/i, 'Limu'],
  [/\b(jimma)\b/i, 'Jimma'],
  [/\b(kochere|kocere)\b/i, 'Kochere'],
  [/\b(bensa)\b/i, 'Bensa'],
  // Colombia
  [/\b(huila)\b/i, 'Huila'],
  [/\b(nariño|narino)\b/i, 'Nariño'],
  [/\b(antioquia)\b/i, 'Antioquia'],
  [/\b(cauca)\b/i, 'Cauca'],
  [/\b(tolima)\b/i, 'Tolima'],
  // Brazil
  [/\b(cerrado)\b/i, 'Cerrado'],
  [/\b(mogiana)\b/i, 'Mogiana'],
  [/\b(minas\s*gerais)\b/i, 'Minas Gerais'],
  // Kenya
  [/\b(nyeri)\b/i, 'Nyeri'],
  [/\b(kiambu)\b/i, 'Kiambu'],
  [/\b(kirinyaga)\b/i, 'Kirinyaga'],
  // Guatemala
  [/\b(antigua)\b/i, 'Antigua'],
  [/\b(huehuetenango|huehuetango)\b/i, 'Huehuetenango'],
  [/\b(atitlan)\b/i, 'Atitlan'],
];

/** Every country named in `text`, in order of mention. A second country counts only after a separator ("Brazil / Colombia"), so "Colombia China Alta" is one. */
export function detectCountries(text: string): string[] {
  const searchText = normalizeForMetadataSearch(text);
  const hits = COUNTRY_MAP.flatMap(([regex, country]) => {
    const match = regex.exec(searchText);
    return match ? [{ country, start: match.index, end: match.index + match[0].length }] : [];
  }).sort((a, b) => a.start - b.start);

  const countries: string[] = [];
  let previousEnd = 0;
  for (const hit of hits) {
    if (countries.includes(hit.country)) continue;
    if (countries.length > 0 && !/[/,&+–—-]|\b(?:ve|and|ile|x)\b/.test(searchText.slice(previousEnd, hit.start))) continue;
    countries.push(hit.country);
    previousEnd = hit.end;
  }
  return countries;
}

export function detectOrigin(text: string): {
  country: string | null;
  region: string | null;
  altitude: string | null;
  farm: string | null;
} {
  const searchText = normalizeForMetadataSearch(text);
  let region: string | null = null;

  for (const [regex, name] of REGION_PATTERNS) {
    if (regex.test(searchText)) {
      region = name;
      break;
    }
  }

  // Extract altitude (e.g., "1800-2100m", "1900 masl", "1800m")
  const altMatch = text.match(/(\d{3,4}\s*[-–]\s*\d{3,4}\s*m(?:asl)?|\d{3,4}\s*m(?:asl)?)/i);
  const altitude = altMatch ? altMatch[1].replace(/\s+/g, '') : null;

  // Extract farm name (common patterns: "Finca X", "Farm X", "Çiftlik X")
  const farmMatch = text.match(/(?:finca|farm|çiftlik|estate|station)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?:\s*[-,.|]|\s*$)/i);
  const farm = farmMatch ? farmMatch[1].trim() : null;

  return { country: detectCountries(text)[0] ?? null, region, altitude, farm };
}

function normalizeForMetadataSearch(text: string): string {
  return text
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[çğöşü]/g, (char) => {
      switch (char) {
        case 'ç':
          return 'c';
        case 'ğ':
          return 'g';
        case 'ö':
          return 'o';
        case 'ş':
          return 's';
        case 'ü':
          return 'u';
        default:
          return char;
      }
    });
}
