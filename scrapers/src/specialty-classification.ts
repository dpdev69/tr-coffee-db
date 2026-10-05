import { isLikelyCatalogCoffeeProduct } from './product-classification.js';
import type { NormalizedCoffee, RawProduct } from './types.js';

export type SpecialtyStatus = 'specialty' | 'not_specialty' | 'unclassified';
export type SpecialtyOverrideAction = 'force_include' | 'force_exclude';

export interface SpecialtyOverride {
  roaster_id: string;
  external_id: string;
  override_action: SpecialtyOverrideAction;
  reason?: string | null;
}

export interface SpecialtyClassificationInput {
  raw: RawProduct;
  normalized: NormalizedCoffee;
  roasterId?: string | null;
  override?: SpecialtyOverride | null;
}

export interface SpecialtyClassification {
  specialty_status: SpecialtyStatus;
  specialty_score: number;
  specialty_signals: string[];
  specialty_rejection_reason: string | null;
  is_public: boolean;
}

const CATALOG_COFFEE_SIGNAL = 'catalog_coffee';

const GENERIC_BLEND_PATTERNS = [
  /\bblend\b/i,
  /\bharman\b/i,
  /\bespresso\s+(?:blend|harman[ıi]?)\b/i,
  /\bhouse\s+blend\b/i,
  /\bdaily\s+coffee\b/i,
  /\bg[uü]nl[uü]k\s+kahve\b/i,
  /\bofis\s+kahvesi\b/i,
];

const BROAD_CATALOG_PATTERNS = [
  /\bt[üu]rk\s+kahvesi\b/i,
  /\bfiltre\s+kahve\b/i,
  /\bespresso\b/i,
  /\bcoffee\s+beans?\b/i,
  /\bçekirdek\s+kahve\b/i,
  /\bcekirdek\s+kahve\b/i,
];

const TRACEABILITY_PATTERNS = [
  /\b(?:farm|finca|estate|station|washing\s+station)\b/i,
  /\b(?:çiftlik|ciftlik|istasyon|üretici|uretici|producer)\b/i,
  /\blot\s*[#:\-]?\s*[a-z0-9-]+/i,
  /\bmicro\s*lot\b/i,
  /\bmicrolot\b/i,
  /\bnano\s*lot\b/i,
];

export const STRUCTURED_ORIGIN_TITLE_COUNTRY_PATTERN =
  /\b(?:etiyopya|ethiopia|ethiopian|kolombiya|colombia|colombian|brezilya|brazil|brazilian|brasil|kenya|kenyan|guatemala|guatemalan|kosta\s*rika|kostarika|costa\s*rica|panama|panamanian|peru|peruvian|honduras|honduran|el\s*salvador|salvadoran|meksika|mexico|mexican|endonezya|indonesia|indonesian|sumatra|rwanda|ruanda|rwandan|burundi|burundian|tanzanya|tanzania|tanzanian|uganda|ugandan|nikaragua|nicaragua|bolivya|bolivia|ekvador|ecuador|hindistan|india|indian|yemen|yemeni|kongo|congo|drc|dominik|dominican|küba|cuba|papua|png|çin|china|yunnan|myanmar|burma|vietnam)\b/i;

const STRUCTURED_ORIGIN_TITLE_PROCESS_PATTERN =
  /\b(?:anaerobic|anaerobik|karbonik|carbonic|experimental|deneysel|semi[\s-]*washed|wet[\s-]*hulled|honey|pulped\s*natural|washed|yikanmis|natural|natürel|naturel|dogal)\b/i;

export function classifySpecialtyProduct(
  input: SpecialtyClassificationInput
): SpecialtyClassification {
  const overrideClassification = classifyOverride(
    input.override,
    input.roasterId,
    input.normalized.external_id || input.raw.externalId
  );
  if (overrideClassification) return overrideClassification;

  const { raw, normalized } = input;
  const text = evidenceText(raw, normalized);
  const titleText = [raw.name, normalized.name, normalized.name_normalized].join(' ');

  if (!isLikelyCatalogCoffeeProduct([raw.name, ...(raw.tags ?? [])])) {
    return rejected(0, ['reject:non-coffee-or-bundle'], 'non_coffee_or_bundle');
  }

  const signals: string[] = [];
  let score = 0;

  if (normalized.sca_score !== null && normalized.sca_score >= 80) {
    score += 4;
    signals.push(`sca_score:${normalized.sca_score}`);
  }

  if (normalized.origin_farm) {
    score += 2;
    signals.push('origin_farm');
  }

  if (normalized.origin_producer || /\b(?:producer|üretici|uretici)\b/i.test(text)) {
    score += 2;
    signals.push('producer');
  }

  if (normalized.origin_region) {
    score += 1;
    signals.push('origin_region');
  }

  if (normalized.origin_altitude) {
    score += 1;
    signals.push('altitude');
  }

  if (normalized.process !== 'unknown') {
    score += normalized.process === 'anaerobic' || normalized.process === 'honey' ? 2 : 1;
    signals.push(`process:${normalized.process}`);
  }

  if (normalized.variety) {
    score += 1;
    signals.push('variety');
  }

  if (normalized.harvest_year) {
    score += 1;
    signals.push('harvest_year');
  }

  if (normalized.flavor_notes_normalized.length >= 2 || normalized.flavor_notes.length >= 2) {
    score += 1;
    signals.push('flavor_notes');
  }

  if (/\b(?:specialty|nitelikli|single\s+origin|tek\s+orijin)\b/i.test(text)) {
    score += 1;
    signals.push('specialty_language');
  }

  if (hasStructuredSingleOriginTitle(raw, normalized)) {
    score += 3;
    signals.push('structured_single_origin_title');
  }

  if (TRACEABILITY_PATTERNS.some((pattern) => pattern.test(text))) {
    score += 2;
    signals.push('traceable_lot_language');
  }

  const uniqueSignals = [...new Set(signals)];

  if (isGenericBlendTitle(titleText)) {
    return rejected(score, [...uniqueSignals, 'reject:generic_blend'], 'generic_blend');
  }

  if (isBroadCatalogEntry(titleText, normalized)) {
    return rejected(score, [...uniqueSignals, 'reject:broad_catalog_entry'], 'broad_catalog_entry');
  }

  return {
    specialty_status: 'specialty',
    specialty_score: score,
    specialty_signals: uniqueSignals.length > 0 ? uniqueSignals : [CATALOG_COFFEE_SIGNAL],
    specialty_rejection_reason: null,
    is_public: true,
  };
}

function classifyOverride(
  override: SpecialtyOverride | null | undefined,
  roasterId: string | null | undefined,
  externalId: string
): SpecialtyClassification | null {
  if (!override) return null;
  if (roasterId && override.roaster_id !== roasterId) return null;
  if (override.external_id !== externalId) return null;

  const reason = override.reason?.trim() || `manual_${override.override_action}`;
  if (override.override_action === 'force_include') {
    return {
      specialty_status: 'specialty',
      specialty_score: 100,
      specialty_signals: [`override:force_include:${reason}`],
      specialty_rejection_reason: null,
      is_public: true,
    };
  }

  return {
    specialty_status: 'not_specialty',
    specialty_score: 0,
    specialty_signals: [`override:force_exclude:${reason}`],
    specialty_rejection_reason: reason,
    is_public: false,
  };
}

function evidenceText(raw: RawProduct, normalized: NormalizedCoffee): string {
  return [
    raw.name,
    raw.description,
    ...(raw.tags ?? []),
    normalized.name,
    normalized.name_normalized,
    normalized.origin_country,
    normalized.origin_region,
    normalized.origin_farm,
    normalized.origin_altitude,
    normalized.origin_producer,
    normalized.process,
    normalized.process_detail,
    normalized.variety,
    normalized.harvest_year,
    ...normalized.flavor_notes,
    ...normalized.flavor_notes_normalized,
    ...collectRawDataText(raw.rawData),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function collectRawDataText(value: unknown, output: string[] = [], depth = 0): string[] {
  if (value == null || output.length >= 100 || depth > 5) return output;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text) output.push(text);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectRawDataText(item, output, depth + 1);
    return output;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value)) collectRawDataText(nested, output, depth + 1);
  }

  return output;
}

function isGenericBlendTitle(titleText: string): boolean {
  return GENERIC_BLEND_PATTERNS.some((pattern) => pattern.test(titleText));
}

function isBroadCatalogEntry(
  titleText: string,
  normalized: NormalizedCoffee
): boolean {
  if (normalized.origin_country || normalized.origin_region || normalized.origin_farm) {
    return false;
  }

  if (!BROAD_CATALOG_PATTERNS.some((pattern) => pattern.test(titleText))) return false;
  return !/\b(?:single\s+origin|tek\s+orijin|microlot|micro\s*lot|finca|farm|producer|üretici|uretici)\b/i.test(
    titleText
  );
}

function hasStructuredSingleOriginTitle(
  raw: RawProduct,
  normalized: NormalizedCoffee
): boolean {
  if (!normalized.origin_country || normalized.process === 'unknown') return false;

  return [raw.name, normalized.name, normalized.name_normalized]
    .filter((title): title is string => Boolean(title))
    .some((title) => {
      const segments = title.split('/').map((segment) => segment.trim()).filter(Boolean);
      if (segments.length < 3) return false;

      const originSegment = segments[0];
      const lotSegments = segments.slice(1, -1).join(' ');
      const processSegment = segments[segments.length - 1];

      return (
        STRUCTURED_ORIGIN_TITLE_COUNTRY_PATTERN.test(originSegment) &&
        /[a-zçğıöşü]{2,}/i.test(lotSegments) &&
        STRUCTURED_ORIGIN_TITLE_PROCESS_PATTERN.test(processSegment)
      );
    });
}

function rejected(
  score: number,
  signals: string[],
  reason: string
): SpecialtyClassification {
  return {
    specialty_status: 'not_specialty',
    specialty_score: score,
    specialty_signals: [...new Set(signals)],
    specialty_rejection_reason: reason,
    is_public: false,
  };
}
