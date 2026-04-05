import {
  BREW_METHOD_LABELS,
  FLAVOR_CATEGORIES,
  PROCESS_LABELS,
  ROAST_LABELS,
  SORT_OPTIONS,
} from '@/lib/constants/filter-options';
import type { CoffeeFilters } from '@/lib/queries/coffees';

type SearchParamValue = string | string[] | undefined;

export type CoffeeSearchParams = Record<string, SearchParamValue>;

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

function getFirstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0);
  }

  return value?.trim() ? value.trim() : undefined;
}

function getArrayValue(value: SearchParamValue): string[] | undefined {
  if (!value) return undefined;

  const items = (Array.isArray(value) ? value : [value])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? [...new Set(items)] : undefined;
}

function getNumberValue(value: SearchParamValue): number | undefined {
  const parsed = Number(getFirstValue(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getBooleanValue(value: SearchParamValue): boolean | undefined {
  const normalized = getFirstValue(value)?.toLowerCase();

  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export function parseCoffeeFilters(params: CoffeeSearchParams): CoffeeFilters {
  const sortValue = getFirstValue(params.sort);
  const page = getNumberValue(params.page);

  return {
    origin: getArrayValue(params.origin),
    process: getArrayValue(params.process),
    roastLevel: getArrayValue(params.roastLevel),
    roaster: getArrayValue(params.roaster),
    flavorCategory: getArrayValue(params.flavorCategory),
    brewMethod: getArrayValue(params.brewMethod),
    priceMin: getNumberValue(params.priceMin),
    priceMax: getNumberValue(params.priceMax),
    isDecaf: getBooleanValue(params.isDecaf),
    search: getFirstValue(params.search),
    sort: sortValue && SORT_VALUES.has(sortValue) ? (sortValue as CoffeeFilters['sort']) : 'newest',
    page: page && page > 0 ? page : 1,
    perPage: 24,
  };
}

export function getActiveCoffeeFilterLabels(filters: CoffeeFilters): string[] {
  const labels: string[] = [];

  if (filters.search) {
    labels.push(`Search: ${filters.search}`);
  }

  filters.origin?.forEach((origin) => labels.push(`Origin: ${origin}`));
  filters.process?.forEach((process) =>
    labels.push(`Process: ${PROCESS_LABELS[process] ?? process}`)
  );
  filters.roastLevel?.forEach((roastLevel) =>
    labels.push(`Roast: ${ROAST_LABELS[roastLevel] ?? roastLevel}`)
  );
  filters.roaster?.forEach((roaster) => labels.push(`Roaster: ${roaster}`));
  filters.flavorCategory?.forEach((flavorCategory) =>
    labels.push(
      `Flavor: ${
        FLAVOR_CATEGORIES.find((category) => category === flavorCategory) ?? flavorCategory
      }`
    )
  );
  filters.brewMethod?.forEach((brewMethod) =>
    labels.push(`Brew: ${BREW_METHOD_LABELS[brewMethod] ?? brewMethod}`)
  );

  if (filters.isDecaf === true) {
    labels.push('Decaf only');
  }

  if (filters.priceMin != null || filters.priceMax != null) {
    if (filters.priceMin != null && filters.priceMax != null) {
      labels.push(`Budget: ${filters.priceMin}-${filters.priceMax} TL/100g`);
    } else if (filters.priceMin != null) {
      labels.push(`Budget: ${filters.priceMin}+ TL/100g`);
    } else if (filters.priceMax != null) {
      labels.push(`Budget: up to ${filters.priceMax} TL/100g`);
    }
  }

  return labels;
}
