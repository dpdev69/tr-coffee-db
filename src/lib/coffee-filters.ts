import {
  BREW_METHOD_VALUES,
  BREW_METHOD_LABELS,
  FLAVOR_CATEGORIES,
  FLAVOR_CATEGORY_LABELS,
  PROCESS_VALUES,
  PROCESS_LABELS,
  ROAST_VALUES,
  ROAST_LABELS,
  SORT_VALUES,
} from '@/lib/constants/filter-options';
import {
  getBooleanParamValue,
  getClampedPriceParamValue,
  getEnumArrayParamValue,
  getFirstSearchParamValue,
  getPageParamValue,
  getStringArrayParamValue,
  normalizeCityFilterValue,
  normalizeSearchTerm,
  type SearchParamValue,
} from '@/lib/filter-contract';
import type { CoffeeFilters } from '@/lib/queries/coffees';

export type CoffeeSearchParams = Record<string, SearchParamValue>;

const PROCESS_VALUE_SET = new Set(PROCESS_VALUES);
const ROAST_VALUE_SET = new Set(ROAST_VALUES);
const BREW_METHOD_VALUE_SET = new Set(BREW_METHOD_VALUES);
const FLAVOR_CATEGORY_VALUE_SET = new Set<string>(FLAVOR_CATEGORIES);
const SORT_VALUE_SET = new Set<string>(SORT_VALUES);

export function parseCoffeeFilters(params: CoffeeSearchParams): CoffeeFilters {
  const sortValue = getFirstSearchParamValue(params.sort);

  return {
    origin: getStringArrayParamValue(params.origin),
    process: getEnumArrayParamValue(params.process, PROCESS_VALUE_SET),
    roastLevel: getEnumArrayParamValue(params.roastLevel, ROAST_VALUE_SET),
    roaster: getStringArrayParamValue(params.roaster),
    city: getCityArrayValue(params.city),
    flavorCategory: getEnumArrayParamValue(params.flavorCategory, FLAVOR_CATEGORY_VALUE_SET),
    brewMethod: getEnumArrayParamValue(params.brewMethod, BREW_METHOD_VALUE_SET),
    singleOrigin: getBooleanParamValue(params.singleOrigin),
    priceMin: getClampedPriceParamValue(params.priceMin),
    priceMax: getClampedPriceParamValue(params.priceMax),
    isDecaf: getBooleanParamValue(params.isDecaf),
    search: normalizeSearchTerm(getFirstSearchParamValue(params.search)),
    sort: sortValue && SORT_VALUE_SET.has(sortValue) ? (sortValue as CoffeeFilters['sort']) : 'newest',
    page: getPageParamValue(params.page),
    perPage: 24,
  };
}

function getCityArrayValue(value: SearchParamValue): string[] | undefined {
  if (!value) return undefined;

  const seen = new Set<string>();
  const cities: string[] = [];

  for (const rawItem of Array.isArray(value) ? value : [value]) {
    const city = normalizeCityFilterValue(rawItem);

    if (city && !seen.has(city)) {
      seen.add(city);
      cities.push(city);
    }
  }

  return cities.length > 0 ? cities : undefined;
}

export function getActiveCoffeeFilterLabels(filters: CoffeeFilters): string[] {
  const labels: string[] = [];

  if (filters.search) {
    labels.push(`Arama: ${filters.search}`);
  }

  filters.origin?.forEach((origin) => labels.push(`Köken: ${origin}`));
  filters.process?.forEach((process) =>
    labels.push(`İşleme: ${PROCESS_LABELS[process] ?? process}`)
  );
  filters.roastLevel?.forEach((roastLevel) =>
    labels.push(`Kavurma: ${ROAST_LABELS[roastLevel] ?? roastLevel}`)
  );
  filters.roaster?.forEach((roaster) => labels.push(`Kavurucu: ${roaster}`));
  filters.city?.forEach((city) => labels.push(`Şehir: ${city}`));
  filters.flavorCategory?.forEach((flavorCategory) =>
    labels.push(
      `Tat: ${
        FLAVOR_CATEGORIES.find((category) => category === flavorCategory)
          ? FLAVOR_CATEGORY_LABELS[flavorCategory as keyof typeof FLAVOR_CATEGORY_LABELS]
          : flavorCategory
      }`
    )
  );
  filters.brewMethod?.forEach((brewMethod) =>
    labels.push(`Demleme: ${BREW_METHOD_LABELS[brewMethod] ?? brewMethod}`)
  );

  if (filters.singleOrigin === true) {
    labels.push('Yalnızca tek köken');
  }

  if (filters.isDecaf === true) {
    labels.push('Sadece dekaf');
  }

  if (filters.priceMin != null || filters.priceMax != null) {
    if (filters.priceMin != null && filters.priceMax != null) {
      labels.push(`Bütçe: ${filters.priceMin}-${filters.priceMax} TL/100 g`);
    } else if (filters.priceMin != null) {
      labels.push(`Bütçe: ${filters.priceMin}+ TL/100 g`);
    } else if (filters.priceMax != null) {
      labels.push(`Bütçe: en fazla ${filters.priceMax} TL/100 g`);
    }
  }

  return labels;
}
