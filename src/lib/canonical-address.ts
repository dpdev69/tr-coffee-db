import { canonicalCountry } from '../../shared/v2/country-labels';
import { BREW_METHOD_LABELS, FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS } from './constants/filter-options';
import { getFirstSearchParamValue, getPageParamValue, getStringArrayParamValue, normalizeSearchTerm, SEARCH_FILTER_MAX_LENGTH } from './filter-contract';
import { parseMatchLimit, parseQuizAnswers, quizQuery } from './quiz-filters';

/**
 * Every address that reads the catalog has one canonical query string; Workers Cache keys on the exact query, so any
 * other spelling would be a separate cache entry and a fresh catalog read. workers/miss-guard.ts redirects anything else
 * here before the app runs, and the site's own links, forms and fetches build these strings directly.
 *
 * The canonical query is what the page itself reads, written once: unknown keys, empty values, repeated single values,
 * defaults (sort=newest, page=1, the feed's own event) and options outside a closed list are dropped; free text is
 * trimmed and capped; multi-value filters are deduplicated, in option order (or sorted when the list is open), at most
 * MAX_VALUES. Keys come in the order of the filter form, page last.
 */
export const MAX_VALUES = 5;
/** Past any real catalog (24 per page); a page past the last one is redirected to the last one by the page itself. */
export const MAX_PAGE = 500;
/** Same shape as SAVED_SLUG (shared/v2/catalog.ts) and the /compare check. */
const SLUG = /^[a-z0-9_-]{1,240}$/i;

type Params = URLSearchParams;
const first = (params: Params, key: string) => getFirstSearchParamValue(params.getAll(key));
const known = (params: Params, key: string, options: Record<string, string>) => {
  const wanted = new Set(getStringArrayParamValue(params.getAll(key)) ?? []);
  return Object.keys(options).filter(option => wanted.has(option));
};
const open = (values: string[]) => [...new Set(values)].sort().slice(0, MAX_VALUES);
/** farm, producer, variety: matched as exact text, so only trimmed and capped (parseDiscoveryFilters reads the same). */
export const exactText = (value: string | undefined) => value?.slice(0, SEARCH_FILTER_MAX_LENGTH).trim() || undefined;

function listingQuery(path: string, params: Params): string {
  const out = new URLSearchParams();
  const add = (key: string, ...values: Array<string | undefined>) => { for (const value of values) if (value) out.append(key, value); };
  const event = first(params, 'event');
  if ((path === '/yeni' && event === 'RESTOCKED') || (path === '/firsatlar' && event === 'DEAL')) add('event', event);
  add('search', normalizeSearchTerm(first(params, 'search')));
  add('taste', ...known(params, 'taste', FLAVOR_CATEGORY_LABELS));
  // A landing page's own facet is fixed by its path; DiscoveryCatalog ignores it in the query.
  if (!path.startsWith('/kahveler/koken/')) add('origin', ...open((getStringArrayParamValue(params.getAll('origin')) ?? []).map(canonicalCountry)));
  add('roaster', ...open((getStringArrayParamValue(params.getAll('roaster')) ?? []).filter(slug => SLUG.test(slug))));
  for (const key of ['priceMin', 'priceMax']) {
    const raw = first(params, key);
    const value = raw === undefined ? NaN : Number(raw);
    if (Number.isFinite(value)) add(key, String(Math.round(Math.max(0, Math.min(100000, value)))));
  }
  if (!path.startsWith('/kahveler/islem/')) add('process', ...known(params, 'process', PROCESS_LABELS));
  add('roast', ...known(params, 'roast', ROAST_LABELS));
  add('brewMethod', ...known(params, 'brewMethod', BREW_METHOD_LABELS));
  for (const key of ['farm', 'producer', 'variety']) add(key, exactText(first(params, key)));
  add('altitude', normalizeSearchTerm(first(params, 'altitude')));
  const sort = first(params, 'sort');
  if (sort === 'price_asc' || sort === 'price_desc') add('sort', sort);
  const page = Math.min(MAX_PAGE, getPageParamValue(params.getAll('page')));
  if (page > 1) add('page', String(page));
  return out.toString();
}

const LISTING = /^\/(?:kahveler|yeni|firsatlar|kahveler\/(?:koken|islem)\/[^/]+)$/;
/** Pages and endpoints whose answer does not depend on the query at all. */
const BARE = /^\/(?:|kahve\/[^/]+|kavurucu\/[^/]+|kavurucular|bulten\/[^/]+|karsilastir|karsilastir\/[^/]+|veri|veri\/v1\/ozet\.json|api\/since|sitemap\.xml)$/;

/** The canonical query (without `?`) for a catalog address, or null for a path this does not govern. */
export function canonicalQuery(pathname: string, params: Params): string | null {
  if (LISTING.test(pathname)) return listingQuery(pathname, params);
  if (BARE.test(pathname)) return '';
  if (pathname === '/quiz/sonuc') return quizQuery(parseQuizAnswers(params));
  if (pathname === '/api/quiz/match') {
    const limit = parseMatchLimit(params.get('limit'));
    return [quizQuery(parseQuizAnswers(params)), limit === 4 ? '' : `limit=${limit}`].filter(Boolean).join('&');
  }
  // At most SAVED_LIMIT (50) slugs; more is a 400 from the handler, left as it is.
  if (pathname === '/api/saved') { const slugs = params.getAll('slug'); return slugs.length > 50 ? null : new URLSearchParams([...new Set(slugs.filter(slug => SLUG.test(slug)))].sort().map(slug => ['slug', slug])).toString(); }
  if (pathname === '/compare') return new URLSearchParams([...new Set(params.getAll('coffee').filter(slug => SLUG.test(slug)))].slice(0, 3).map(slug => ['coffee', slug])).toString();
  if (pathname === '/api/catalog') {
    const out = new URLSearchParams();
    for (const key of ['origin', 'process', 'taste', 'roaster']) for (const value of open(getStringArrayParamValue(params.getAll(key)) ?? [])) out.append(key, value);
    const q = normalizeSearchTerm(params.get('q') ?? undefined);
    if (q) out.append('q', q);
    const page = Math.min(MAX_PAGE, getPageParamValue(params.getAll('page')));
    if (page > 1) out.append('page', String(page));
    return out.toString();
  }
  return null;
}

/** A catalog listing address in canonical form, for links the site builds from a set of parameters. */
export function canonicalListing(path: string, params: Params): string {
  const query = listingQuery(path, params);
  return query ? `${path}?${query}` : path;
}
