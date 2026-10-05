# Free catalog refresh

GitHub Actions runs the parsers on Node 22; D1 remains the canonical database and the Cloudflare web Worker remains its reader. `scrape.yml` replaces the old Supabase writer and schedules one refresh daily at 00:00 UTC (03:00 Istanbul; GitHub can delay starts). Cloudflare crawler cron triggers and `CRAWLS_ENABLED` are disabled. Both old queue deliveries are paused, preventing backlog retries from competing with the new writer. The queue handler is retained for deliberate recovery.

`CLOUDFLARE_D1_API_TOKEN` is an Actions secret scoped to Account → D1 → Edit for the existing account. `d1-backup.yml` reuses it weekly for `wrangler d1 export` (the export endpoint is a POST job; D1 Edit covers it, D1 Read may not) and keeps a gzipped SQL artifact for 30 days; the catalog holds no emails or subscriber data. No paid Cloudflare plan was enabled. A 20-minute Linux job timeout bounds scheduled usage to 620 minutes in a 31-day month, excluding manual runs and other workflows.

## Ingestion

All active database roasters are attempted. Complete snapshots commit through the same atomic ingestion transaction via D1 REST. Failed/partial snapshots update health only. Successful jobs deduplicate by roaster and UTC date; workflow concurrency serializes runs. First native baselines produce no discovery/deal events from imported prices. Stable coffee IDs/URLs, immutable observations and reviewed manual features survive.

The runner overlaps three independent roasters. Requests within each storefront retain their 300 ms pacing, discovery limits and access checks. D1 REST requests remain serialized, so each quota check includes the preceding batch's actual usage. In-flight workers settle before the final report is written, including when reporting fails. Reports include total and per-roaster `elapsedMs`.

Complete variant discovery retires withdrawn offers for an observed product without fabricating stock observations. Explicitly unavailable parents may have no offers. Returning variants recover their identity. A first complete baseline supersedes synthetic legacy offers across that roaster, retaining their history. Entirely absent native products are not declared sold out.

Absent products also leave the public catalog without any write: migration 0005 limits `public_catalog_coffees` to coffees whose `last_seen_at` is within 7 days of their roaster's `last_success_at`. Only successful crawls move either timestamp, so failed/partial runs or a stopped workflow never hide a catalog. A delisted coffee disappears after the first successful crawl at least 7 days past its last sighting; if it returns, the next success shows it again.

Apply 0005 with `npm run db:migrate:staging` (`wrangler d1 migrations apply --remote`, token with D1 Edit). The runner records 0004 in `d1_migrations` itself, so first confirm with `npx wrangler d1 migrations list coffeedb-v2-staging --remote` that only `0005_current_offers_freshness.sql` is pending; if older files appear, their objects already exist, so record them in the ledger rather than re-running them. The runner deliberately does not install 0005. Read caching and the daily row budget are in [read-budget.md](read-budget.md).

Attempts older than two hours expire as failed. Reports include actual D1 rows read/written. A full night reads about 80,000 rows and writes about 28,000 ([read-budget.md](read-budget.md)); a process stops further requests after 750,000 reads or 65,000 writes, leaving most of the 5,000,000 daily reads to visitors; the final atomic batch can cross that threshold. This is a per-process guard, not an account-wide quota guarantee. Reports remain available for seven days; source failures fail the job visibly.

## Incident and evidence — 26 September 2026 UTC

The migrated Worker did run, but only a subset of sources completed. CPU exhaustion and repeated deliveries stranded attempts. Heavy parsing now runs outside Workers Free.

[The first Actions smoke run](https://github.com/dpdev69/tr-coffee-db/actions/runs/36271554862) authenticated successfully but its first D1 batch was rejected because the daily read quota was exhausted. It did not import new data. The quota resets at 00:00 UTC.

Query analytics identified a correlated coffee-detail alias scan as the main read drain: 36,838,662 reported reads for that query in the inspected daily group. Detail lookup now resolves candidate IDs using indexed unions. Migration 0004 adds a covering alias index; the runner installs it idempotently before refreshing. The query fix was deployed as web Worker version `5c9a4871-e9c5-4823-9f59-21549cc68007`. The Cloudflare cron was removed through the API.

Public captures replayed through actual SQLite ingestion against a copy of the migrated catalog: **38 sources, 902 coffees, 5,511 offers, zero reconciliation failures**. These are snapshot counts, not available catalog counts or evidence of remote writes.

Shopify, Woo and Parsa use complete catalog discovery. Woo variants are fetched in batches with exact ID coverage. All ten IKAS stores use paginated storefront queries with their actual currency, price list and warehouses. Probador uses option/price pairs; Coffee Department uses Ticimax native variants and tax-inclusive prices. Kronotrop and Milestones preserve source option identities and surcharges. KafeinKültür resolves valid combinations through its detail endpoint. Ordinarius now uses IdeaSoft: seven current parents, 112 variants.

**Cho Coffee remains unqualified:** ordinary public pages can respond, but the identified crawler receives HTTP 403. Its bounded parser is tested; full allowed source validation is still required. No access challenge is bypassed. All 39 active sources are attempted; qualification and current success are distinct. `shared/v2/qualified-sources.ts` is authoritative.

## Performance — 29 September 2026

Compared with `f451ebb` on Node 22.23.3 using all 39 sources and 415 captured public HTTP responses. Recorded network delays and source pacing were scaled equally to 10%; database operations used local SQLite. These are replay timings, excluding remote D1 latency.

| Trial | Sequential runner | Three roasters at a time |
|---|---:|---:|
| 1 | 59.93 s | 27.43 s |
| 2 | 64.32 s | 28.51 s |
| 3 | 59.45 s | 30.25 s |
| Median | **59.93 s** | **28.51 s** |

**52.4% less elapsed time (2.1× throughput).** Every trial consumed the same 415 requests and produced identical source outcomes and database contents, including the prior day's price observations. All table hashes matched `cb18da09beceebe9e21661ccdbd50cef16ca29b558ea5645a2224d5ddbdf4525`. Capture hash: `8f8828313e2ace81b6d07486952ebe3ef0d68435a12b3c0f0836dcd64a3132c2`.

The runner overlaps independent sources; ingestion classifies each coffee once and reuses that result across package offers. No dependencies were added. HTTP request counts and persisted data are unchanged. Source access failures still fail the scheduled job visibly.

## Verification

Run `npm test` and `npm run check`. Focused tests cover page completeness, SKU price/stock coupling, rollback, recovery, daily deduplication, retirement and indexed detail lookup.

`scripts/v2-benchmark-refresh.mts BASELINE_DIRECTORY RESPONSES_JSONL` compares the current runner with an exported baseline against the same public HTTP captures. Each JSONL entry records `[URL, method, body]` as `key`, response `status`, `headers`, `cookies`, `body` and observed network `ms` (or `error`). It seeds the prior day's snapshot before measuring a live refresh, checks every request is consumed, and compares source outcomes and a hash of every database table. It uses local SQLite, scales recorded network delays and the source pacing equally to 10%, and reports the median of three trials. It makes no live requests or D1 writes. Remote D1 latency and production performance require verification in the next scheduled run.

With the captured responses available, reproduce the comparison from the repository root:

```sh
crawler_baseline=$(mktemp -d)
git archive f451ebb scripts/v2-refresh.mts scripts/v2-d1-rest.ts scrapers/src shared migrations/d1 | tar -x -C "$crawler_baseline"
ln -s "$PWD/node_modules" "$crawler_baseline/node_modules"
ln -s "$PWD/scrapers/node_modules" "$crawler_baseline/scrapers/node_modules"
node_modules/.bin/tsx scripts/v2-benchmark-refresh.mts "$crawler_baseline" /path/to/responses.jsonl
```

After quota reset, inspect the daily job's summary/artifact and D1 successes, health, catalog counts and row usage. Do not claim remote recovery until that run commits. Do not enable the Cloudflare cron alongside Actions.
