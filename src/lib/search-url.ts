import { normalizeSearchTerm } from '@/lib/filter-contract';

const CATALOG_PATH = '/kahveler';

/** Header search lands on the catalog; searching from the catalog keeps its other filters. */
export function buildGlobalSearchUrl({
  pathname,
  currentQuery,
  nextSearch,
}: {
  pathname: string;
  currentQuery?: string;
  nextSearch: string;
}) {
  const params =
    pathname === CATALOG_PATH && currentQuery
      ? new URLSearchParams(currentQuery)
      : new URLSearchParams();
  const search = normalizeSearchTerm(nextSearch);

  if (search) {
    params.set('search', search);
  } else {
    params.delete('search');
  }

  params.delete('page');

  const query = params.toString();
  return query ? `${CATALOG_PATH}?${query}` : CATALOG_PATH;
}
