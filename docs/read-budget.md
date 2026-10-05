# D1 read budget

The free plan allows 5,000,000 rows read per day (and 100,000 written). On 4 October 2026 staging read 26.8 million rows in about 9,800 queries and was cut off until midnight UTC. This page records where the rows went, what changed, the daily arithmetic, and how to re-measure.

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

**Edge caching (Workers Cache, `cache.enabled` in wrangler.jsonc).** Every catalog page (`/`, `/kahveler`, landings, `/yeni`, `/firsatlar`, `/quiz/sonuc`, coffee, roaster, `/kavurucular`, `/bulten/[month]`) gets `CDN-Cache-Control: public, max-age=21600, stale-while-revalidate=86400, stale-if-error=86400` from `next.config.ts`, and `/api/catalog`, `/api/quiz/match`, `/api/saved`, `/api/since` set the same in the handler (`EDGE_CACHE_HEADERS` in `shared/v2/read-cache.ts`, the one place the policy lives). Browsers get `public, max-age=0, must-revalidate`, so they always ask the edge.

- *Why next.config:* vinext marks a page that reads `searchParams` as dynamic (`no-store`) whenever the address has a query string, and `revalidate` cannot change that. A `CDN-Cache-Control` header from `next.config` headers is vinext's documented owner of the final policy and applies to query-string addresses too (checked on a production build with `wrangler dev`). Before this, only `/`, coffee, roaster and `/kavurucular` pages were cached (5 minutes, ISR), and they also cached outage notices.
- *Key:* Workers Cache keys on path and full query string, in order, plus the Worker version (a deploy starts cold). It is tiered: one fill serves every location. Tracking parameters (`utm_*`, `fbclid`, `gclid`, `srsltid`, …, `TRACKING_PARAM`) are removed with a 308 before any catalog read (`dropTrackingParams`), so a shared link cannot make a fresh copy per click. Parameter order is not normalised: every link and form the site builds uses one order, and normalising would redirect every form submit.
- *Safe:* nothing personal is rendered on the server. Saved coffees, taste profile and "since your last visit" live in browser storage and are fetched from address-keyed JSON (`/api/saved?slug=…` returns the same for anyone asking for those slugs). The consent banner is decided in the browser. No cached response sets a cookie (vinext refuses to cache one that does).
- *Lifetime:* the nightly job purges everything once corrections are in (`POST /api/cache` with `CACHE_PURGE_TOKEN`, the last step of `scrape.yml`), so tonight's coffees show at once. Six hours bounds the lag when a purge is missed or not configured. `/api/since` ends its 30 Istanbul days at midnight, so its copy expires at Istanbul midnight at the latest. The home page's coffee of the day can show yesterday's pick from Istanbul midnight until the purge (about 03:20); this was judged not worth a second schedule.
- *Left uncached:* `POST /api/subscribe` and `/api/events` (writes), `/go/*` (every click must run to be counted; see failure handling), `/api/coffee-image` (unchanged), `/listem` and `/quiz` (no catalog reads), the sitemap (vinext never edge-caches metadata routes; its catalog query is a derived result instead).

**Derived results in D1 (`derived_cache`, migration 0008, `withDerivedCache`).** Results that are the same for every visitor until the next refresh and do not depend on the clock are computed once and stored in D1: catalog counts, roasters, origin options, landing facts, similarity candidates, quiz candidates, the coffee-of-the-day order and the sitemap's coffee list. Reading one costs 2 rows. The key carries the deployment stage and Worker version. A row is trusted only if it is younger than 24 hours and newer than the last invalidation; its time is the database clock read *before* computing, so a computation that overlaps the nightly write is discarded. `applyCorrections` (the last writer of the night) and `v2-refresh.mts` invalidate in their own batch. Tests and scripts read live (no `derive` on their database objects).

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

## Daily budget

| | Rows read per day |
|---|---:|
| Free plan allowance | 5,000,000 |
| Nightly refresh, typical (hard cap) | 80,000 (750,000) |
| Derived results refilled after the nightly invalidation (again after each deploy) | 226,000 |
| Left for visitors, typical | about 4,700,000 |
| Left for visitors, worst case (refresh at its cap, two refills) | about 3,800,000 |

A **cached view costs 0 rows.** An **uncached view** costs what the table above says: 1,000 for a coffee page, 5,000 for a roaster, 8,000–13,000 for a catalog list, landing or feed, about 20,000 for a price sort or price filter, under 600 for a quiz result.

A **full crawl of every indexable address** (478 coffees, 42 roasters, 28 landings, 20 catalog pages and the feeds) costs about 1,340,000 rows. Each address is rendered at most once per edge lifetime: once a day with the purge, at most four times if a crawler re-walks everything every six hours (5.4 million, the one pattern that would not fit; raise `max-age` in `EDGE_CACHE_CONTROL` if logs show it). `robots.txt` now also keeps crawlers out of free-text and price filters (`search=`, which every form submission carries, `priceMin`, `priceMax`, `farm`, `producer`, `variety`, `altitude`) and `/quiz/sonuc`; those were already `noindex`.

**Visits.** Shared addresses (home, catalog pages, landings, coffees, roasters) are rendered a few times a day however many people view them. What grows with visitors is addresses nobody asked for since the last purge: a new filter, sort or search combination, about 12,000 rows each (20,000 for price). With a daily crawl (1.34 million) and the nightly costs (0.3 million), about 3.3 million remain:

- 300 visits a day where 40% try a filter combination nobody else tried: about 1.5 million. Fits with room to spare.
- 300 visits a day where every visit creates a new combination: about 3.6 million. Fits, without headroom.
- Above roughly 250 new combinations a day plus a daily full crawl, the free plan is at its edge.

## When the allowance runs out

- A page that cannot read the catalog still renders its outage notice, but is sent as `no-store`: `keepOutOfEdgeCache()` sets vinext's own response veto, which overrides the next.config policy. The edge keeps serving the last good copy for up to a day past its lifetime (`stale-while-revalidate`); a visitor only sees the notice when the edge holds no copy of that address. Before, a notice was cached like a good page (5 minutes fresh, then a year of `stale-while-revalidate`).
- JSON endpoints answer 503 `no-store`; the edge serves the last good copy (`stale-if-error`, one day).
- `/go/[offerId]` and `/go/kavurucu/[slug]` need the database to find the destination. Their redirects are now stored at the edge with `max-age=0, stale-if-error=86400`: every click still runs the Worker (and is counted), but when the Worker answers 503 the edge sends the visitor on with the last redirect it saw for that address.
- The newsletter signup (`/api/subscribe`) never reads D1 and keeps working.
- The nightly refresh runs after the reset and stops itself at 750,000 rows.

## Rollout

1. Apply 0008 (`npm run db:migrate:staging`). It creates one empty table: no catalog rows are read and no existing table is touched. Nothing breaks in either order. Code before the migration: derived reads fail and fall through to live queries (correct, but every `/kahveler` miss recomputes the landing facts, 149,000 rows), and the next nightly run creates the table itself (`DERIVED_CACHE_TABLE`). Migration before code: an unused table.
2. Deploy the web Worker. The cache starts empty (the version is part of the key).
3. Owner: generate a token (`openssl rand -hex 32`), set it as the Worker secret `CACHE_PURGE_TOKEN` (`wrangler secret put`) and as the repository secret of the same name, and set the repository variable `SITE_URL`. Until then the purge step is skipped with a notice and pages refresh within six hours.

To check on staging after midnight UTC (one request each is enough):

- `curl -sI <site>/kahveler?sort=price_asc` twice: `cf-cache-status` should go from `MISS` to `HIT`; `?fbclid=x` should answer 308.
- The refresh summary (`rowsRead`) should be near 80,000; the purge step should answer `{"purged":true}`.
- D1 metrics for the next day: total rows read well under 1 million at current traffic.
- Not verifiable locally: that Workers Cache honours `stale-if-error` for the `/go` redirects and keeps a stale page when a revalidation returns `no-store`. If it evicts instead, an outage shows the notice for addresses not refreshed in the last six hours; nothing is cached wrongly either way.

## Verdict

The free plan fits today's traffic and a cautious launch with a few hundred visits a day, as long as the purge is configured and no crawler re-walks the site several times a day. It does not leave comfortable headroom: one aggressive crawler or a few hundred visitors each trying new filter combinations brings the day near 5 million, and a cut-off database also blocks the nightly refresh. Workers Paid (about 5 US dollars a month, 25 billion rows) removes the limit entirely and is the honest recommendation before any public promotion.
