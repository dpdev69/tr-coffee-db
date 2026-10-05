import { canonicalListing } from '@/lib/canonical-address';

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
  params.set('search', nextSearch);
  params.delete('page');
  // canonicalListing normalises the term (and drops it when empty), so the router asks for the one cached address.
  return canonicalListing(CATALOG_PATH, params);
}
