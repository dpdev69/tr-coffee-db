# D1 read budget

The free plan allows 5,000,000 rows read per day (and 100,000 written), shared by every product on the account (KahveDrop, Kaç Papel, Göçmeden). On 4 October 2026 staging read 26.8 million rows in about 9,800 queries and was cut off until midnight UTC. On 20 October 2026 production crawlers took the account to 4.63 million by 18:53 UTC. This page records where the rows went, what changed, the daily arithmetic, and how to re-measure.

## Measuring

`scripts/v2-read-budget.mts` runs each page's and endpoint's catalog calls (in the same shape as the page files) against a local D1 copy and prints D1's own `meta.rows_read` per page view; local D1 counts rows the way production does. It never touches the remote database.

```sh
npx wrangler d1 execute coffeedb-v2-staging --local --persist-to .local/perf-d1 --yes --file=<dump.sql>
npx wrangler d1 migrations apply coffeedb-v2-staging --local --persist-to .local/perf-d1
npx tsx scripts/v2-read-budget.mts pages [--verbose] [--live]   # per page view; --live skips the derived cache
npx tsx scripts/v2-read-budget.mts refresh                      # one unchanged night, on a throwaway copy
npx tsx scripts/v2-read-budget.mts sql --q "SELECT ..."         # rows read by any statement
git archive <ref> shared src scripts data | tar -x -C .local/old && ln -s "$PWD/node_modules" .local/old/node_modules
npx tsx scripts/v2-read-budget.mts equivalence --old .local/old # old and new reads on the same data, must be identical
```

Numbers below: the staging dump of 4 October 2026 (`staging-pre-0007.sql`, 1,137 coffees of which 478 listed, 5,444 offers, 74,666 price observations) with migrations 0007 and 0008 applied. The refresh is a replay of an unchanged night: every active roaster that succeeded last time sees the same products again, through the real `ingestCrawl`, `syncRoasters`, `attentionNeeded` and `applyCorrections`.

## 20 October 2026: crawlers on uncached pages

Source: Cloudflare D1 analytics for the account, 20 October 2026. By 18:53 UTC the account had read 4.63 million rows, 4.62 million of them KahveDrop's. Hourly reads were 65,000 to 350,000 all day, with 1.09 million between 17:00 and 18:00 UTC when DataForSeoBot made 480 requests. The readers were crawlers (DataForSeoBot, Googlebot smartphone, Amazonbot, SemrushBot) on addresses the edge did not hold. The brake (below) did nothing: `D1_ANALYTICS_TOKEN` had never been set. Top statements of the day:

| Statement | Rows read | Runs | Rows per run | Where it came from |
|---|---:|---:|---:|---|
| `SELECT c.*,… count(*) OVER() AS total_count FROM public_catalog_coffees c JOIN roasters …` | 2,171,584 | 295 | 7,361 | every list: `/kahveler` and its pages, filters and sorts, landings, feeds, roaster pages, the home page's three feeds |
| `SELECT p.* FROM price_observations p JOIN offers o … WHERE g.group_id=? ORDER BY p.observed_at DESC …` | 450,950 | 706 | 639 | every coffee page, for a price history that no page shows |
| `SELECT count(DISTINCT o.coffee_id\|\|'\|'\|\|coalesce(o.weight_g,'')… FROM public_catalog_coffees …` | 310,055 | 167 | 1,857 | every roaster page, for its package count |

What changed (measured below; local copy of the staging export of 17 October 2026, `staging-launch-2026-10-17.d1-import.sql`, 490 listed coffees):

- **List index** (`listIndex` in `shared/v2/catalog.ts`, derived result `list-index`). Once per refresh, one pass records for every listed coffee what the list query filters and sorts on: roaster, the package price a card shows, the text values each closed facet (origin, process, roast, taste, brew method) can match under the MANUAL rule, the newest still-valid event of each type, and the order of each of the four sorts. A list without free text or traceability now reads the index (2 rows), picks its page of ids, and reads only those coffees by id (about 190 rows for 24) before hydrating them. Search, farm, producer, variety, altitude and traceability still run the query. The landing facts are counted from the same index, so the nightly derived results got cheaper too (258,414 → 187,039 rows). Stored size 121,120 bytes for 490 coffees (about 250 bytes a coffee; 1.9 MB is reached near 7,500); parsing and filtering it costs about 0.25 ms per list miss (M-series Mac, Node).
- **Coffee page**: `getCoffeeDetail` no longer reads the price history (no page shows it; `getPriceHistory` reads it on request).
- **Roaster page**: the package count comes from the derived roaster list, which counts it with the same rules.
- **Equivalence**: the old and new code on the same data (21 + 11 filter sets × 4 sorts × 4 pages, every landing, every roaster page, plus the existing checks), through the derived cache cold and warm: all identical (see *Equivalence* below). `tests/v2-list-index.test.ts` compares both paths on a small catalog with MANUAL facts, events, unpriced and foreign-currency packages.
- **robots.txt** (`src/lib/robots-rules.ts`): `Disallow: /` for SEO-tool crawlers that send no visitors (DataForSeoBot, SemrushBot, AhrefsBot, MJ12bot, DotBot, BLEXBot, Barkrowler, SeekportBot, serpstatbot). Search engines and AI answer crawlers keep the `*` group. Also `Disallow: /*:` (below).
- **Edge lifetime** 6 → 48 hours (`EDGE_CACHE_CONTROL`). The nightly purge still replaces every copy, so a copy normally lives until the next night; a crawler that walks the site twice in a day now reads nothing the second time. A failed purge turns the nightly job red; until it is fixed a quiet page can be up to 48 hours old (72 with stale-while-revalidate).
- **Colon paths.** vinext marked each streamed icon with `data-vinext-streamed-icon="/kahveler/islem/naturel:1ur9nj5:0"`, and Googlebot fetched those values as pages (about 74 of 178 sampled 404s in Search Console), each a full render. The key is now built without the path (`vite-streamed-icons.ts`, checked in the built bundle by `scripts/v2-sanitize-build.mjs`), the miss guard answers any path with a colon with a stored 404 and no app or database, and robots.txt disallows `/*:`. No route, slug or id contains a colon (`stableSlug`, `stableId`).
- **Trailing slash**: `/kahveler/` and the like are redirected to the one cached spelling by the miss guard, like a non-canonical query.

Rows read per uncached view, before and after (the same dump, through the derived cache as the Worker reads):

| Address | Before | After |
|---|---:|---:|
| `/` | 10,422 | 705 |
| `/kahveler` | 13,684 | 2,795 |
| `/kahveler?sort=price_asc` | 19,445 | 1,130 |
| `/kahveler?page=10` | 11,885 | 996 |
| `/kahveler?taste=fruity&roast=light` (no match) | 7,757 | 8 |
| `/kahveler?search=etiyopya` (free text, unchanged) | 11,003 | 11,003 |
| `/kahveler?priceMax=600` | 21,539 | 1,458 |
| `/kahveler/koken/etiyopya` | 14,376 | 1,714 |
| `/yeni` | 9,210 | 2,793 |
| `/yeni?event=RESTOCKED` | 3,343 | 210 |
| `/kahve/[slug]` | 2,773 | 390 |
| `/kavurucu/[slug]` (largest roaster) | 5,857 | 917 |
| `/api/catalog` | 13,680 | 2,791 |
| Derived results after the nightly invalidation (once) | 258,414 | 187,039 |

What remains of a list miss is hydration of its 24 coffees: offers, features and latest events (the events query, about 1,600 rows for the first page, checks each arrival's genuineness; a derived set of genuine arrival ids would cut it further). The three statements above become: lists about 190 rows for their coffees instead of 7,361; coffee pages 0 for history instead of 639; roaster pages 0 for the count instead of 1,857.

Arithmetic for a day like 20 October, from the per-run numbers: the three statements were 2.93 million of KahveDrop's 4.62 million. With the same requests they become about 56,000 (295 lists × about 190 rows; the coffee and roaster pages read nothing for them), so the same day would have read about 1.75 million. The rest (hydration, `/api/since`, searches, derived results after the purge and after each deploy) is not broken down in the analytics above. Two changes cut the number of misses rather than their price and are not in that figure: the SEO-tool crawlers are asked to stay out (DataForSeoBot alone made 480 requests in the 1.09-million hour), and a page rendered once is not rendered again that day. A full crawl of every indexable address (490 coffees, 42 roasters, 28 landings, 20 catalog pages and the feeds) is now about 300,000 rows instead of 1.34 million, two thirds of it coffee pages. Set the brake (owner: `D1_ANALYTICS_TOKEN`) regardless: it is the only bound on a day.

## Where the 26.8 million rows went

Rows read per uncached view, before and after.

| Address | Before: queries | Before: rows | After: queries | After: rows |
|---|---:|---:|---:|---:|
| `/` | 19 | 42,406 | 16 | 8,985 |
| `/kahveler` | 36 | 300,735 | 8 | 12,168 |
| `/kahveler?sort=price_asc` | 36 | 309,695 | 8 | 18,048 |
| `/kahveler?page=10` | 36 | 299,556 | 8 | 10,989 |
| `/kahveler?taste=fruity&roast=light` | 33 | 299,764 | 5 | 7,993 |
| `/kahveler?search=etiyopya` | 36 | 299,207 | 8 | 9,902 |
| `/kahveler?priceMax=600` | 36 | 318,330 | 8 | 19,703 |
| `/kahveler/koken/etiyopya` | 8 | 56,411 | 8 | 13,220 |
| `/yeni` | 7 | 35,759 | 6 | 7,406 |
| `/yeni?event=RESTOCKED` | 7 | 28,929 | 6 | 3,277 |
| `/firsatlar` | 4 | 25,541 | 3 | 9 |
| `/kahve/[slug]` | 9 | 13,708 | 10 | 1,056 |
| `/kavurucu/[slug]` | 8 | 5,548 | 7 | 5,386 |
| `/kavurucular` | 1 | 16,119 | 1 | 2 |
| `/quiz/sonuc?taste=fruity&brew=filter` | 4 | 14,189 | 5 | 585 |
| `/sitemap.xml` | 31 | 283,850 | 4 | 8 |
| `/api/catalog` | 6 | 29,129 | 5 | 12,162 |
| `/api/quiz/match?taste=fruity&limit=4` | 4 | 13,900 | 5 | 264 |
| `/api/saved` (5 slugs) | 4 | 233 | 4 | 233 |
| `/api/since` | 1 | 148,374 | 1 | 6,981 |
| `/go/[offerId]` | 1 | 6 | 1 | 6 |
| Nightly refresh (unchanged night) | 12,427 | 79,136 | 12,430 | 79,173 |

Most plausible account of the 26.8 million: about 90 views of `/kahveler` in any variant (300,000 rows and 36 queries each, 8,300 rows per query, matching the reported 2,700-rows-per-query average once cheaper calls are mixed in), plus sitemap fetches (284,000 each) and `/api/since` (148,000 each). None of these were cached: `/kahveler`, the feeds, landings, quiz results and every JSON endpoint were `no-store`, and the Cache API read cache (below) did not help. The refresh was never the problem: it reads about 80,000 rows a night.

The four causes, in order of size:

1. **Landing facts:** every `/kahveler` view counted all 28 origin and process landing pages with one full catalog scan each (28 queries, 249,000 rows).
2. **`catalogChangesByDay`** paired every listed coffee with every valid event (148,000 rows for one small chart).
3. **Repeated catalog-wide reads per view:** roasters with counts (16,000), origin options (9,400), counts (12,000), similarity candidates on every coffee page (12,600), quiz candidates (13,700), each recomputed on every view although they change once a night.
4. **A second scan per list** only to count the total.

## What changed

**Edge caching (Workers Cache, `cache.enabled` in wrangler.jsonc).** Every catalog page (`/`, `/kahveler`, landings, `/yeni`, `/firsatlar`, `/quiz/sonuc`, coffee, roaster, `/kavurucular`, `/bulten/[month]`) gets `CDN-Cache-Control: public, max-age=172800, stale-while-revalidate=86400, stale-if-error=86400` from `next.config.ts`, and `/api/catalog`, `/api/quiz/match`, `/api/saved`, `/api/since` set the same in the handler (`EDGE_CACHE_HEADERS` in `shared/v2/read-cache.ts`, the one place the policy lives). Browsers get `public, max-age=0, must-revalidate`, so they always ask the edge.

- *Why next.config:* vinext marks a page that reads `searchParams` as dynamic (`no-store`) whenever the address has a query string, and `revalidate` cannot change that. A `CDN-Cache-Control` header from `next.config` headers is vinext's documented owner of the final policy and applies to query-string addresses too (checked on a production build with `wrangler dev`). Before this, only `/`, coffee, roaster and `/kavurucular` pages were cached (5 minutes, ISR), and they also cached outage notices.
- *Key:* Workers Cache keys on path and full query string, in order, plus the Worker version (a deploy starts cold). It is tiered: one fill serves every location. Every catalog address has one canonical query string and anything else is redirected to it before the app runs (see *Bounding misses* below).
- *Safe:* nothing personal is rendered on the server. Saved coffees, taste profile and "since your last visit" live in browser storage and are fetched from address-keyed JSON (`/api/saved?slug=…` returns the same for anyone asking for those slugs). The consent banner is decided in the browser. No cached response sets a cookie (vinext refuses to cache one that does).
- *Lifetime:* the nightly job purges everything once corrections are in (`POST /api/cache` with `CACHE_PURGE_TOKEN`, the last step of `scrape.yml`), so tonight's coffees show at once. 48 hours (6 until 20 October 2026) bounds the lag when a purge is missed or not configured. `/api/since` ends its 30 Istanbul days at midnight, so its copy expires at Istanbul midnight at the latest. The home page's coffee of the day can show yesterday's pick from Istanbul midnight until the purge (about 03:20); this was judged not worth a second schedule.
- *Left uncached:* `POST /api/subscribe` and `/api/events` (writes), `/go/*` (every click must run to be counted; see failure handling), `/api/coffee-image` (unchanged), `/listem` and `/quiz` (no catalog reads), the sitemap (vinext never edge-caches metadata routes; its catalog query is a derived result instead).

**Derived results in D1 (`derived_cache`, migration 0008, `withDerivedCache`).** Results that are the same for every visitor until the next refresh and do not depend on the clock are computed once and stored in D1: catalog counts, roasters, origin options, landing facts, similarity candidates, quiz candidates, the coffee-of-the-day order, the sitemap's coffee list, and the comparison facts and per-pair cards of `/karsilastir` (about 15,000 rows for the facts, built from the two candidate lists and one price query, plus about 760 per pair on its first visit; docs/comparisons.md). The numbers page `/veri` and its open copy `/veri/v1/ozet.json` share one more, `catalog-stats` (`src/lib/catalog-stats.ts`): counts, roasters and landing facts that are already derived, two event counts in the `/yeni` and `/firsatlar` shape, and one bag-price query written as a subquery per coffee like the comparison prices; the nightly warm-up requests both addresses and reports `catalog-stats` if it was not stored. It is derived rather than a committed file because static files change only with a deploy, while these numbers change every night. Reading one costs 2 rows. The key carries the deployment stage and Worker version. A row is trusted only if it is younger than 24 hours and newer than the last invalidation; its time is the database clock read *before* computing, so a computation that overlaps the nightly write is discarded. `applyCorrections` (the last writer of the night) and `v2-refresh.mts` invalidate in their own batch. Tests and scripts read live (no `derive` on their database objects).

The in-Worker Cache API read cache it replaces keyed on SQL text and bound values for five minutes, but the Cache API is local to one data center, is not tiered, is documented as working only on custom domains (staging is on workers.dev), and the event feeds bound a timestamp rounded to five minutes, so the key changed every five minutes. In practice nearly every read went to D1.

**Rewritten queries** (`shared/v2/catalog.ts`, `shared/v2/quiz-rank.ts`):

| Query | Change | Rows |
|---|---|---|
| `listCatalog` | total from `count(*) OVER()` on the page query instead of a second scan; a separate count only for a page past the end; the arrivals join only for the newest sort | /kahveler 15,000 → 10,200 for the list itself |
| `catalogFacts` / `listLandings` | `catalogFactsMany`: every filter evaluated in one pass per query (as many as fit in 100 bound parameters), then derived; a landing page reads its facts from the shared landing list | 249,000 per view → 149,000 once a night |
| `catalogChangesByDay` | join from the few valid events to their groups (`CROSS JOIN` fixes the order) instead of every listed coffee × every event | 148,000 → 7,000 |
| `getSimilarCoffees`, `rankQuizMatches` | candidate list derived once (only the fields scoring reads), winners re-read by id from the public view | 12,600 / 13,700 per view → a few hundred (once a night: 13,500 / 13,700) |
| `getCatalogCounts`, `listRoasters`, `listOrigins`, coffee-of-the-day order, sitemap coffees | derived, queries unchanged | 2 each |

No index was added: `EXPLAIN QUERY PLAN` shows every lookup already uses an index; the remaining cost is the public-catalog view's per-coffee freshness and stock check (about 4,500 rows per scan of 1,137 coffees) and the filters' per-coffee feature lookups, which an index cannot remove. The price sorts and price filters pay about 9,000 more rows for the package price each card shows (`PREFERRED_PRICE`).

**Equivalence.** `equivalence` mode runs the old tree (`git archive` of the base commit) and this one on the same data and compares JSON output: counts, roasters, origins, all landings and their facts (including unlisted ones), the sitemap, ten days of coffee of the day, `catalogChangesByDay`, `listCatalog` for 21 filter sets × 4 sorts × pages 1, 2, 5 and 999, similar coffees for all 478 listed coffees at limits 4 and 12, and quiz rankings for 256 answer sets at limits 4 and 8. Each new read runs twice (cold, then from the derived cache). Result on the dump: **3,704 of 3,704 identical**.

**Nightly refresh.** It already read each roaster's state in five indexed queries (not per product); a full unchanged night is 79,000 rows read and 28,000 written, half of the reads being the last two price observations of each offer (needed for deal detection). Unchanged products already skip feature rewrites. The guard in `scripts/v2-d1-rest.ts` now stops at 750,000 reads (was 3,000,000) and 65,000 writes: about 9× a normal night, so a runaway job cannot take more than 15% of the day. Price observations are untouched.

## Bounding misses

The app runs only when the edge has no copy of an address, so everything below acts on misses alone and never slows a visitor served from cache. `workers/web.ts` is the Worker entry. Its default export is a thin gateway with caching off (`exports` in wrangler.jsonc) that runs on every request: it asks the `App` entrypoint, which Workers Cache sits in front of, and then adds a fresh CSP nonce to HTML and `X-Robots-Tag` on workers.dev (`workers/edge-headers.ts`; no database, no KV, about 0.5 ms of CPU for the largest page). `App` runs `workers/miss-guard.ts`, then the app. With Workers Cache on, Cloudflare bills the gateway's call into `App` as a request too, so each page view counts as two requests against the Workers Free allowance of 100,000 a day.

**One address per page** (`src/lib/canonical-address.ts`). The canonical query is what the page reads, written once: unknown keys (tracking ones included), empty values (every form submission carries a dozen), repeated single values, defaults (`sort=newest`, `page=1`, a feed's own `event`), options outside a closed list (taste, process, roast, brew method) and a landing page's own facet are dropped; origins are written as their canonical country; prices are whole lira between 0 and 100,000; search, altitude and farm/producer/variety are trimmed and capped at 80 characters; open lists (origin, roaster) are deduplicated, sorted and capped at 5 values; the page at 500, and a page past the last one now redirects (307) to the last page instead of rendering at its own address. Keys follow the filter form, page last. Pages and endpoints that do not read the query (home, coffee, roaster, roaster index, newsletter issue, `/api/since`, the sitemap) canonicalise to none; `/quiz/sonuc` and `/api/quiz/match` to `quizQuery` (and `limit` when not 4), `/api/saved` to sorted unique slugs, `/compare` to at most three coffees. Anything else, a trailing slash included, gets a 308 to the canonical form, with no database read, stored at the edge like a page. A path with a colon is never a page and gets a stored 404 the same way. The router's `_rsc` pair is kept, last. The site builds these forms itself: chips, pagination, the header search, the quiz, the home page's quiz widget and the saved list; a crawl of the 334 internal links of a local build found none that redirects. The tracking-parameter redirect in the pages (`dropTrackingParams`) stays as a second line for any path served without the entry.

**Per-client limit on misses.** `CATALOG_LIMITER`, 20 a minute, for list-sized renders (home, catalog, landings, feeds, roaster pages, `/api/catalog`, `/api/since`, the sitemap: 5,000 to 21,000 rows each), and `PAGE_LIMITER`, 60 a minute, for one-coffee-sized ones (coffee pages, quiz result, `/api/quiz/match`, `/api/saved`, `/kavurucular`, newsletter issues, `/compare`, `/karsilastir` pages: under 1,100 each once their derived results exist; the first miss after a purge builds them, as a coffee page builds the similarity candidates). The client is the IPv4 address or the IPv6 /64 (one subscriber's network; a per-address key would give an IPv6 client 2^64 budgets); only `cf-connecting-ip` is trusted. People behind one carrier-grade NAT share a budget, which at today's few hundred visits a day rarely matters. A person filtering quickly on a cold cache spends about 5 on the first page (the page and the header links the browser prefetches) and one per filter change, so 20 allows a change every 4 seconds for a minute; redirects are answered before the limit and do not count. The refusal costs nothing: 429, `Retry-After: 60`, `no-store` for browser and edge, a short Turkish page (JSON for `/api/*`). The limiter is per Cloudflare location and approximate by design; a limiter error lets the request through.

**Global brake.** With the Worker secret `D1_ANALYTICS_TOKEN` (an API token with *Account Analytics: Read*) and the variable `D1_BUDGET_ACCOUNT_ID`, each isolate asks D1's analytics (GraphQL `d1AnalyticsAdaptiveGroups`, summed over the account, UTC day: the same count the allowance uses) at most every 30 seconds, in the background, and from 3,500,000 rows read today every guarded miss answers 503 with `Retry-After` until 00:05 UTC and a Turkish note. Pages already at the edge keep working. It costs no database rows and adds no latency; without the token it is off. The reserve of 1,500,000 covers the nightly refresh at its own cap (750,000), the warm-up (283,000) and about a minute of the brake's lag at the worst rate one client can reach.

**What else made misses expensive** (found while measuring on a local build):

- A router (RSC) request without a loading boundary runs the page once before rendering it, so every client navigation and prefetch read the catalog twice (`/kahveler?page=2`: 23,192 rows as RSC, 11,596 as HTML). Reads and derived results are now shared within a request (`readOncePerRequest`): 11,595.
- A `Link` with a query string is prefetched as a router-state-specific variant that vinext never lets the edge store, so each visitor who scrolled one into view paid a full render even with a warm cache (24,328 rows for the catalog's next-page link). Chips, pagination, feed switches and the roaster's catalog link are no longer prefetched, and neither are the 28 landing links (cacheable, but about 13,000 rows each on a cold cache, per visitor). Header links still are; they are cached.
- vinext stores a page at the edge only when the request said it accepts HTML. A script's `Accept: */*` miss was rendered every time and never stored; the guard now passes such page requests on as HTML requests.

## After a purge and after a deploy

Both empty the edge; the nightly invalidation (or a new Worker version) also empties the derived results. Measured on the local copy:

| | Rows |
|---|---:|
| First `/kahveler` with no derived results | 186,852 |
| Same, derived results present | 12,164 |
| Warm-up (`scripts/warm-cache.mts`: sitemap, home, catalog, both feeds, each as page and router payload, roaster index, one coffee, quiz match; 12 requests, one at a time) | 282,638 |

Before, every simultaneous first reader computed every derived result itself: ten visitors on ten isolates after the purge, about 1.8 million rows for the same landing facts. Now simultaneous readers in one isolate share one computation, and across isolates the first to claim `lease:<key>` in `derived_cache` computes while the others re-read the row (2 rows a read, every 400 ms, at most 15 seconds) and use it; a lease whose holder died is taken over after a minute. The nightly job runs the warm-up right after its purge, and `deploy:vinext` (staging) and `deploy:production` run it after a deploy, so normally no visitor computes a derived result at all. Locally all requests share one isolate and one serialized database, so the cross-isolate case is shown by a test, not by these numbers.

## Stored results

Two derived results grow with the catalog. Measured on 478 listed coffees:

| | Before: bytes | After: bytes | Before: parse + rank per view | After |
|---|---:|---:|---:|---:|
| `similar-candidates` (every coffee page) | 296,656 | 167,010 | 4.46 ms | 0.31 ms |
| `quiz-candidates` (quiz result, home widget) | 253,356 | 162,895 | 1.75 ms | 0.56 ms |

(CPU on an M-series Mac, Node 24; a Worker is slower, against a 10 ms limit per request on the free plan.) Similarity now stores each candidate's three fact lists already resolved and lower-cased; the quiz stores each candidate's evidence per dimension instead of its features, so ranking no longer folds and matches text per request. The equivalence run against the previous main (same data, cold and from the derived cache) is again 3,704 of 3,704 identical. At about 350 bytes a coffee both stay under D1's 2 MB row limit up to the existing 5,000-candidate cap (1.75 MB); before, they crossed it at about 3,200 and 3,800 listed coffees. A value over 1,900,000 bytes is not sent; that and any failed store are logged as `Derived result not stored: <key> …`. The nightly warm-up lists every stored result with its size in the job summary, warns above 1,000,000 bytes (about 2,900 listed coffees) and reports a missing one as an error.

## Daily budget

| | Rows read per day |
|---|---:|
| Free plan allowance | 5,000,000 |
| Nightly refresh, typical (hard cap) | 80,000 (750,000) |
| Warm-up after the nightly purge (again after each deploy), including the derived results | 283,000 |
| Left for visitors, typical | about 4,640,000 |
| Brake: guarded misses stop at | 3,500,000 |

A **cached view costs 0 rows.** An **uncached view** costs what the table above says: 1,000 for a coffee page, 5,000 for a roaster, 8,000–13,000 for a catalog list, landing or feed, about 20,000 for a price sort or price filter, under 600 for a quiz result.

A **full crawl of every indexable address** (478 coffees, 42 roasters, 28 landings, 20 catalog pages and the feeds) costs about 1,340,000 rows. Each address is rendered at most once per edge lifetime: once a day with the purge, and no more often since the lifetime became 48 hours (with six hours a crawler re-walking everything every six hours cost four renders a day). These two paragraphs predate the list index; per-miss costs are now those of the 20 October section. `robots.txt` now also keeps crawlers out of free-text and price filters (`search=`, which every form submission carries, `priceMin`, `priceMax`, `farm`, `producer`, `variety`, `altitude`) and `/quiz/sonuc`; those were already `noindex`.

**Visits.** Shared addresses (home, catalog pages, landings, coffees, roasters) are rendered a few times a day however many people view them. What grows with visitors is addresses nobody asked for since the last purge: a new filter, sort or search combination, about 12,000 rows each (20,000 for price). With a daily crawl (1.34 million) and the nightly costs (0.3 million), about 3.3 million remain:

- 300 visits a day where 40% try a filter combination nobody else tried: about 1.5 million. Fits with room to spare.
- 300 visits a day where every visit creates a new combination: about 3.6 million. Fits, without headroom.
- Above roughly 250 new combinations a day plus a daily full crawl, the free plan is at its edge.

**Worst cases.** A miss costs at most about 21,000 rows (a price filter, a past-the-end page of a landing) or 1,100 (one coffee). One client at both limits all minute: 20 × 21,000 + 60 × 1,100 ≈ 490,000 rows a minute. Before, one loop could spend the day in well under a minute; now it takes one client about ten minutes, and a limit per minute cannot bound a day on its own: a client that keeps going for 24 hours could ask for 700 million. That is the brake's job. With it on, visitors' misses stop at 3,500,000 plus what arrives during its lag (up to 30 seconds of polling plus D1 analytics' own delay, to be measured on staging): one client at the worst rate for one minute adds about 490,000, leaving about 1,000,000 for the refresh (80,000 typical, 750,000 at its cap) and the warm-up (283,000). A hundred clients at once reach 49 million a minute; nothing in a Worker on the free plan stops that before the allowance is gone (the limiter only spreads them per address, the brake reacts after the fact). Their misses are refused from then on, cached pages keep working, the refresh after the reset still gets a fresh allowance, and the remedy at that scale is a zone rate-limiting or WAF rule once the site has its own domain.

## When the allowance runs out

- A page that cannot read the catalog still renders its outage notice, but is sent as `no-store`: `keepOutOfEdgeCache()` sets vinext's own response veto, which overrides the next.config policy. The edge keeps serving the last good copy for up to a day past its lifetime (`stale-while-revalidate`); a visitor only sees the notice when the edge holds no copy of that address. Before, a notice was cached like a good page (5 minutes fresh, then a year of `stale-while-revalidate`).
- JSON endpoints answer 503 `no-store`; the edge serves the last good copy (`stale-if-error`, one day).
- `/go/[offerId]` and `/go/kavurucu/[slug]` need the database to find the destination. Their redirects are now stored at the edge with `max-age=0, stale-if-error=86400`: every click still runs the Worker (and is counted), but when the Worker answers 503 the edge sends the visitor on with the last redirect it saw for that address.
- The newsletter signup (`/api/subscribe`) never reads D1 and keeps working.
- The nightly refresh runs after the reset and stops itself at 750,000 rows.
- Every catalog statement has 6 seconds to answer (`D1_DEADLINE_MS`, `withDeadline` in `shared/v2/last-good.ts`). After the first timeout or daily-limit error in a request, the rest of that request's reads fail at once, so a page shows its fallback in seconds instead of hanging. On 18 October `/kahveler` hung for 20 seconds.
- Last-good copies in KV (`LAST_GOOD`; KV has its own free allowance of 100,000 reads and 1,000 writes a day). Every derived result and each page of the unfiltered newest listing is copied after it is computed, at most once per 12 hours per key. When D1 fails, they are served instead: `/kahveler` shows the copy under a "Veriler dünkü" notice, and `/api/catalog` (unfiltered) and `/api/since` add `copy.writtenAt`. Landing lists, counts, origins and roasters come from the derived copies. A response built from a copy is never edge-cached. Filtered listings, coffee pages and the quiz have no copy and still show their notice. Bump `LAST_GOOD_SCHEMA` when a stored shape changes.
- D1's free allowance is per account, so Kaç Papel and Göçmeden lose their reads at the same moment as KahveDrop.

## Rollout

Miss guard (this change): no migration. Build and deploy the Worker (`npm run build:cloudflare && npm run deploy:vinext`; its post step warms the cache). Then, owner: create an API token with *Account Analytics: Read* for this account and set it as the Worker secret `D1_ANALYTICS_TOKEN` to turn the brake on; without it everything else works. The rate-limit namespaces (1003, 1004 on staging, 2003, 2004 on production) are created by the deploy.

Read-budget change (before this one):

1. Apply 0008 (`npm run db:migrate:staging`). It creates one empty table: no catalog rows are read and no existing table is touched. Nothing breaks in either order. Code before the migration: derived reads fail and fall through to live queries (correct, but every `/kahveler` miss recomputes the landing facts, 149,000 rows), and the next nightly run creates the table itself (`DERIVED_CACHE_TABLE`). Migration before code: an unused table.
2. Deploy the web Worker. The cache starts empty (the version is part of the key).
3. Owner: generate a token (`openssl rand -hex 32`), set it as the Worker secret `CACHE_PURGE_TOKEN` (`wrangler secret put`) and as the repository secret of the same name, and set the repository variable `SITE_URL`. Until then the purge step is skipped with a notice and pages refresh within six hours.

To check on staging after midnight UTC (one request each is enough):

- `curl -sI <site>/kahveler?sort=price_asc` twice: `cf-cache-status` should go from `MISS` to `HIT`; `?fbclid=x` should answer 308.
- The refresh summary (`rowsRead`) should be near 80,000; the purge step should answer `{"purged":true}`.
- D1 metrics for the next day: total rows read well under 1 million at current traffic.
- Miss guard: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' '<site>/kahveler?utm_source=x&taste=Fruity&search=&sort=newest'` answers `308 …/kahveler?taste=Fruity`; then `for i in $(seq 25); do curl -s -o /dev/null -w '%{http_code} ' "<site>/kahveler?search=zz$i"; done` shows 200s, then 429s from about the 21st (search misses are uncached by construction; 25 of them cost about 140,000 rows, so run it once); `curl -sI` on one 429 shows `cf-cache-status` absent or `BYPASS`/`DYNAMIC`, never `HIT` a minute later. With `D1_ANALYTICS_TOKEN` set, the Worker logs show no `Read budget check failed`; compare the brake's view with the dashboard by temporarily lowering `BRAKE_ROWS` on a preview version if needed.
- Not verifiable locally: that Workers Cache honours `stale-if-error` for the `/go` redirects and keeps a stale page when a revalidation returns `no-store`. If it evicts instead, an outage shows the notice for addresses not refreshed in the last six hours; nothing is cached wrongly either way.

## Verdict

The owner has decided to stay on the free plan. It fits today's traffic and a cautious launch with a few hundred visits a day, as long as the purge is configured. A single badly behaved client can no longer spend the day in a minute (about ten minutes at the limits), and with the brake on it stops at 3.5 million, keeping the rest for the nightly refresh. A coordinated attack from many addresses can still exhaust the allowance; cached pages keep working while it lasts.
