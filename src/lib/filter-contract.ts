export type SearchParamValue = string | string[] | undefined;

export const PRICE_FILTER_MIN = 0;
export const PRICE_FILTER_MAX = 5000;
export const SEARCH_FILTER_MAX_LENGTH = 80;

const QUERY_CONTROL_PUNCTUATION = /[,%()"'\\{}\[\]:;]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function getFirstSearchParamValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0)?.trim();
  }

  return value?.trim() ? value.trim() : undefined;
}

export function normalizeSearchTerm(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(QUERY_CONTROL_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_FILTER_MAX_LENGTH)
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeFreeTextFilterValue(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeCityFilterValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : undefined;
}

export function getStringArrayParamValue(value: SearchParamValue): string[] | undefined {
  if (!value) return undefined;

  const seen = new Set<string>();
  const items: string[] = [];

  for (const rawItem of Array.isArray(value) ? value : [value]) {
    const item = normalizeFreeTextFilterValue(rawItem);

    if (item && !seen.has(item)) {
      seen.add(item);
      items.push(item);
    }
  }

  return items.length > 0 ? items : undefined;
}

export function getEnumArrayParamValue<T extends string>(
  value: SearchParamValue,
  allowedValues: ReadonlySet<T>
): T[] | undefined {
  if (!value) return undefined;

  const seen = new Set<T>();
  const items: T[] = [];

  for (const rawItem of Array.isArray(value) ? value : [value]) {
    const item = rawItem.trim() as T;

    if (allowedValues.has(item) && !seen.has(item)) {
      seen.add(item);
      items.push(item);
    }
  }

  return items.length > 0 ? items : undefined;
}

export function getBooleanParamValue(value: SearchParamValue): boolean | undefined {
  const normalized = getFirstSearchParamValue(value)?.toLowerCase();

  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export function getClampedPriceParamValue(value: SearchParamValue): number | undefined {
  const parsed = Number(getFirstSearchParamValue(value));

  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(PRICE_FILTER_MAX, Math.max(PRICE_FILTER_MIN, parsed));
}

export function getPageParamValue(value: SearchParamValue): number {
  const parsed = Number(getFirstSearchParamValue(value));

  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}
