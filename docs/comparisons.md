# Written comparison pages (/karsilastir)

`/karsilastir` lists a fixed set of "X mı Y mi?" pages; each lives at `/karsilastir/<a>-vs-<b>`. They are the indexable, written counterpart of the interactive `/compare` tool, which stays `noindex` and disallowed in `robots.txt` because every combination would be a fresh render and catalog read.

## The pairs and why

Google autocomplete (tr, TR), checked 19 Oct 2026. Autocomplete shows that people search a phrase, not how many do.

| Page | Evidence |
|---|---|
| `etiyopya-vs-kolombiya` | "etiyopya mı kolombiya mı", "kolombiya mı etiyopya mı", "filtre kahve kolombiya mı etiyopya mı" |
| `kolombiya-vs-brezilya` | "kolombiya mı brezilya mı", "brezilya mi kolombiya kahvesi mi" |
| `kenya-vs-kolombiya` | "kenya mi kolombiya kahvesi mi" |
| `kenya-vs-etiyopya` | "kenya mı etiyopya mı" |
| `guatemala-vs-kolombiya` | "guatemala mı kolombiya mı", "kolombiya kahvesi mi guatemala mı" |
| `espresso-vs-filtre` | "espresso mu filtre kahve mi …" (drink-level), "espresso için çekirdek kahve önerisi", "filtre kahve için çekirdek önerisi" |
| `naturel-vs-yikanmis` | No Turkish "vs" query; the most basic process choice, and both sides have well over 100 coffees |
| `kronotrop-vs-petra`, `kronotrop-vs-montag`, `petra-vs-montag` | No "vs" query; brand autocomplete only (Kronotrop and Petra strong, Montag moderate). Long-tail bets; drop or replace them if Search Console shows nothing after eight weeks |

Mass-market brands people compare ("kahve dünyası mı tchibo mu") are not in the catalog, so they cannot be pages: every number has to come from our own data.

## Where the numbers come from

`src/lib/comparisons.ts`. One derived result, `comparisons`, holds every side of every pair. It is computed once per refresh (and once per deploy, since derived keys carry the Worker version):

1. the similarity candidates (already derived) give a wide first cut of coffees that might belong to a side;
2. those coffees are hydrated exactly as the catalog cards are;
3. each side is decided on the hydrated coffee: origin as the card names it, process, roast, brew and taste family as the quiz reads them (`evidence()`), roaster by slug.

Prices are the cheapest in-stock 250 g TRY package of each coffee; other bag sizes never enter a price, and there is no per-100 g price anywhere (owner decision). The page prints how many coffees state each fact.

Measured on the 17 Oct staging dump (`scripts/v2-read-budget.mts pages`): filling `comparisons` reads about 28,000 rows once per refresh; a page view that misses the edge reads 2 rows; an edge hit reads none. The sitemap reads the same derived row (2 more rows). The nightly warm-up requests `/karsilastir` and reports `comparisons` if it was not stored.

A page is indexable, and listed in the sitemap, only while both sides have at least 3 listed coffees (`MIN_COFFEES`); below that it says so and is `noindex, follow`.

## Adding a pair

Add an entry to `COMPARISONS` with the search evidence in this file. Sides can be an origin from the country table, a process key, `espresso` or `filter`, or a roaster slug with its display name. Keep the list short and fixed: each pair is a page, never a query.
