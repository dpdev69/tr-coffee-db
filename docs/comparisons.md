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

`src/lib/comparisons.ts`. Workers Free allows 10 ms of CPU a request, and hydrating a coffee costs about 0.13 ms, so the work is split in two derived results:

- `comparisons` (the facts for every side of every pair) never hydrates a coffee. Origin comes from the similarity candidates; process, roast, taste family and brew method from the quiz candidates' evidence (best-trusted statement, a blanket "every brew method" claim ignored); both lists are already derived. Prices come from one query: each listed coffee's cheapest in-stock 250 g TRY package, over its own and its size twins' offers. About 3.6 ms of JS on an M-series Mac.
- `comparison-cards:<slug>` hydrates only that pair's shown coffees (4 a side) and each side's cheapest coffee, about 1 to 2 ms.

Prices are the cheapest in-stock 250 g package of each coffee; other bag sizes never enter a price, and there is no per-100 g price anywhere (owner decision). The page prints how many coffees state each fact. Side counts follow the catalog's facts the way the quiz and similarity read them, so they can differ by a few from the linked landing page; the "see all" link carries no number for that reason.

Measured on the 17 Oct staging dump (`scripts/v2-read-budget.mts pages`): the facts read about 15,000 rows once per refresh (and once per deploy, since derived keys carry the Worker version), each pair's cards about 760 on its first visit; a page view that misses the edge reads 2 rows (index) or 4 (pair); an edge hit reads none. The price query is written as a subquery per coffee: the same join written flat read 3.8 million rows. The nightly warm-up requests `/karsilastir` and reports `comparisons` if it was not stored.

A page is `noindex, follow` while either side has fewer than 3 listed coffees (`MIN_COFFEES`). The sitemap decides the same from counts it already reads (landing facts, roasters), so building the facts never runs inside the sitemap request; brew sides have no landing and are always listed.

## Adding a pair

Add an entry to `COMPARISONS` with the search evidence in this file. Sides can be an origin from the country table, a process key, `espresso` or `filter`, or a roaster slug with its display name. The candidate lists hold the 5,000 newest listed coffees; past that, sides would undercount. Keep the list short and fixed: each pair is a page, never a query.

## Links and structured data

Each pair is linked from the index, from every other pair page, from its sides' own pages (origin and process landings, roaster pages) and from every coffee page whose stated origin, process or roaster is a side (`coffeeSides` in `src/components/v2/comparison-links.tsx`, with the same precedence the coffee page shows). The home page body, the guide and `/veri` link a few pairs and the index. The index is a `CollectionPage` and each pair a `WebPage`, both published by KahveDrop with the shared Basalt node as `parentOrganization`, and `dateModified` set to when the facts were built; the sitemap gives them the catalog's latest change as `lastModified`.
