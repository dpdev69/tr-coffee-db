import { normalizeSearchTerm } from '@/lib/filter-contract';

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
    pathname === '/coffees' && currentQuery
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
  return query ? `/coffees?${query}` : '/coffees';
}
