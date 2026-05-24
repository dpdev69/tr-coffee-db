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

const PROCESS_VALUE_SET = new Set(PROCESS_VALUES.filter((value) => value !== 'unknown'));
const ROAST_VALUE_SET = new Set(ROAST_VALUES.filter((value) => value !== 'unknown'));
const BREW_METHOD_VALUE_SET = new Set(BREW_METHOD_VALUES);
const FLAVOR_CATEGORY_VALUE_SET = new Set<string>(FLAVOR_CATEGORIES);
const SORT_VALUE_SET = new Set<string>(SORT_VALUES);

interface FilterRemoval {
  key: string;
  value?: string;
}

interface ActiveCoffeeFilterDefinition {
  label: string;
  remove: FilterRemoval[];
}

export interface ActiveCoffeeFilterChip {
  label: string;
  removeHref: string;
}

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
  return getActiveCoffeeFilterDefinitions(filters).map((filter) => filter.label);
}

export function getActiveCoffeeFilterChips(filters: CoffeeFilters): ActiveCoffeeFilterChip[] {
  return getActiveCoffeeFilterDefinitions(filters).map((filter) => ({
    label: filter.label,
    removeHref: buildCoffeeFiltersUrl(filters, filter.remove),
  }));
}

function getActiveCoffeeFilterDefinitions(filters: CoffeeFilters): ActiveCoffeeFilterDefinition[] {
  const filtersToShow: ActiveCoffeeFilterDefinition[] = [];

  if (filters.search) {
    filtersToShow.push({
      label: `Arama: ${filters.search}`,
      remove: [{ key: 'search' }],
    });
  }

  filters.origin?.forEach((origin) =>
    filtersToShow.push({
      label: `Köken: ${origin}`,
      remove: [{ key: 'origin', value: origin }],
    })
  );
  filters.process?.forEach((process) =>
    filtersToShow.push({
      label: `İşleme: ${PROCESS_LABELS[process] ?? process}`,
      remove: [{ key: 'process', value: process }],
    })
  );
  filters.roastLevel?.forEach((roastLevel) =>
    filtersToShow.push({
      label: `Kavurma: ${ROAST_LABELS[roastLevel] ?? roastLevel}`,
      remove: [{ key: 'roastLevel', value: roastLevel }],
    })
  );
  filters.roaster?.forEach((roaster) =>
    filtersToShow.push({
      label: `Kavurucu: ${roaster}`,
      remove: [{ key: 'roaster', value: roaster }],
    })
  );
  filters.city?.forEach((city) =>
    filtersToShow.push({
      label: `Şehir: ${city}`,
      remove: [{ key: 'city', value: city }],
    })
  );
  filters.flavorCategory?.forEach((flavorCategory) =>
    filtersToShow.push({
      label: `Tat: ${
        FLAVOR_CATEGORIES.find((category) => category === flavorCategory)
          ? FLAVOR_CATEGORY_LABELS[flavorCategory as keyof typeof FLAVOR_CATEGORY_LABELS]
          : flavorCategory
      }`,
      remove: [{ key: 'flavorCategory', value: flavorCategory }],
    })
  );
  filters.brewMethod?.forEach((brewMethod) =>
    filtersToShow.push({
      label: `Demleme: ${BREW_METHOD_LABELS[brewMethod] ?? brewMethod}`,
      remove: [{ key: 'brewMethod', value: brewMethod }],
    })
  );

  if (filters.singleOrigin === true) {
    filtersToShow.push({
      label: 'Yalnızca tek köken',
      remove: [{ key: 'singleOrigin' }],
    });
  }

  if (filters.isDecaf === true) {
    filtersToShow.push({
      label: 'Sadece dekaf',
      remove: [{ key: 'isDecaf' }],
    });
  }

  return filtersToShow;
}

function buildCoffeeFiltersUrl(filters: CoffeeFilters, removals: FilterRemoval[] = []) {
  const params = new URLSearchParams();
  const hasRemoval = (key: string, value?: string) =>
    removals.some((removal) => {
      if (removal.key !== key) return false;
      return removal.value == null || removal.value === value;
    });
  const appendArrayFilter = (key: string, values: string[] | undefined) => {
    values?.forEach((value) => {
      if (!hasRemoval(key, value)) {
        params.append(key, value);
      }
    });
  };

  if (filters.search && !hasRemoval('search')) {
    params.set('search', filters.search);
  }

  appendArrayFilter('origin', filters.origin);
  appendArrayFilter('process', filters.process);
  appendArrayFilter('roastLevel', filters.roastLevel);
  appendArrayFilter('roaster', filters.roaster);
  appendArrayFilter('city', filters.city);
  appendArrayFilter('flavorCategory', filters.flavorCategory);
  appendArrayFilter('brewMethod', filters.brewMethod);

  if (filters.singleOrigin != null && !hasRemoval('singleOrigin')) {
    params.set('singleOrigin', String(filters.singleOrigin));
  }

  if (filters.isDecaf != null && !hasRemoval('isDecaf')) {
    params.set('isDecaf', String(filters.isDecaf));
  }

  if (filters.sort && filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }

  const query = params.toString();
  return query ? `/coffees?${query}` : '/coffees';
}
