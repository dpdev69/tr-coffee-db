const COMPARISON_TARGET_GRAMS = 250;
const GRAM_UNIT_PATTERN = String.raw`(?:grams?|gr\.?|g\.?)(?![\p{L}])`;
const KG_UNIT_PATTERN = String.raw`(?:kg|kilogram)(?![\p{L}])`;
const WEIGHT_UNIT_PATTERN = String.raw`(?:${GRAM_UNIT_PATTERN}|${KG_UNIT_PATTERN})`;

export function parsePackageWeight(text: string): number | null {
  const multiPackMatch = text.match(
    new RegExp(String.raw`(\d+)\s*-?\s*[x×]\s*-?\s*(\d+(?:[.,]\d+)?)\s*${WEIGHT_UNIT_PATTERN}`, 'iu')
  );
  if (multiPackMatch) {
    const count = Number.parseInt(multiPackMatch[1], 10);
    const unit = /(?:kg|kilogram)/i.test(multiPackMatch[0]) ? 1000 : 1;
    const unitWeight = unit === 1000
      ? parseLocalizedDecimalNumber(multiPackMatch[2])
      : parseLocalizedWeightNumber(multiPackMatch[2]);
    if (Number.isFinite(count) && unitWeight != null) {
      return Math.round(count * unitWeight * unit);
    }
  }

  const gMatch = text.match(
    new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*${GRAM_UNIT_PATTERN}`, 'iu')
  );
  if (gMatch) return Math.round(parseLocalizedWeightNumber(gMatch[1]) ?? 0) || null;

  const kgMatch = text.match(
    new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*${KG_UNIT_PATTERN}`, 'iu')
  );
  if (kgMatch) {
    const weight = parseLocalizedDecimalNumber(kgMatch[1]);
    return weight == null ? null : Math.round(weight * 1000);
  }

  return null;
}

export function comparePackageWeightPreference(
  leftWeight: number | null,
  leftText: string,
  rightWeight: number | null,
  rightText: string
): number {
  return packageWeightScore(leftWeight, leftText) - packageWeightScore(rightWeight, rightText);
}

function packageWeightScore(weight: number | null, text: string): number {
  if (weight == null) return Number.POSITIVE_INFINITY;

  const normalizedText = text.toLowerCase();
  const isMultipack = /\b\d+\s*-?\s*[x×]\s*-?\s*\d+/.test(normalizedText);
  const isComparisonPack = !isMultipack && weight >= 150 && weight <= 350;
  const bandScore = isComparisonPack ? 0 : weight < 150 ? 1 : weight < 500 ? 2 : 3;

  return bandScore * 10_000 + Math.abs(weight - COMPARISON_TARGET_GRAMS);
}

function parseLocalizedWeightNumber(text: string): number | null {
  const parts = text.split(/[.,]/);
  if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) {
    const value = Number.parseInt(parts.join(''), 10);
    return Number.isFinite(value) ? value : null;
  }

  return parseLocalizedDecimalNumber(text);
}

function parseLocalizedDecimalNumber(text: string): number | null {
  const compact = text.trim();
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '');
  } else {
    normalized = compact.replace(',', '.');
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}
