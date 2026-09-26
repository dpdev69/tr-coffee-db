# Free catalog refresh

GitHub Actions runs the parsers on Node 22; D1 remains the canonical database and the Cloudflare web Worker remains its reader. `scrape.yml` replaces the old Supabase writer and schedules one refresh daily at 00:00 UTC (03:00 Istanbul; GitHub can delay starts). Cloudflare crawler cron triggers and `CRAWLS_ENABLED` are disabled. Both old queue deliveries are paused, preventing backlog retries from competing with the new writer. The queue handler is retained for deliberate recovery.

`CLOUDFLARE_D1_API_TOKEN` is an Actions secret scoped to Account → D1 → Edit for the existing account. No paid Cloudflare plan was enabled. A 20-minute Linux job timeout bounds scheduled usage to 620 minutes in a 31-day month, excluding manual runs and other workflows.

## Ingestion

All active database roasters are attempted. Complete snapshots commit through the same atomic ingestion transaction via D1 REST. Failed/partial snapshots update health only. Successful jobs deduplicate by roaster and UTC date; workflow concurrency serializes runs. First native baselines produce no discovery/deal events from imported prices. Stable coffee IDs/URLs, immutable observations and reviewed manual features survive.

Complete variant discovery retires withdrawn offers for an observed product without fabricating stock observations. Explicitly unavailable parents may have no offers. Returning variants recover their identity. A first complete baseline supersedes synthetic legacy offers across that roaster, retaining their history. Entirely absent native products are not declared sold out.

Attempts older than two hours expire as failed. Reports include actual D1 rows read/written. A process stops further requests after 3 million reads or 65,000 writes, leaving headroom; the final atomic batch can cross that threshold. This is a per-process guard, not an account-wide quota guarantee. Reports remain available for seven days; source failures fail the job visibly.

## Incident and evidence — 26 September 2026 UTC

The migrated Worker did run, but only a subset of sources completed. CPU exhaustion and repeated deliveries stranded attempts. Heavy parsing now runs outside Workers Free.

[The first Actions smoke run](https://github.com/dpdev69/tr-coffee-db/actions/runs/36271554862) authenticated successfully but its first D1 batch was rejected because the daily read quota was exhausted. It did not import new data. The quota resets at 00:00 UTC.

Query analytics identified a correlated coffee-detail alias scan as the main read drain: 36,838,662 reported reads for that query in the inspected daily group. Detail lookup now resolves candidate IDs using indexed unions. Migration 0004 adds a covering alias index; the runner installs it idempotently before refreshing. The query fix was deployed as web Worker version `5c9a4871-e9c5-4823-9f59-21549cc68007`. The Cloudflare cron was removed through the API.

Public captures replayed through actual SQLite ingestion against a copy of the migrated catalog: **38 sources, 902 coffees, 5,511 offers, zero reconciliation failures**. These are snapshot counts, not available catalog counts or evidence of remote writes.

Shopify, Woo and Parsa use complete catalog discovery. Woo variants are fetched in batches with exact ID coverage. All ten IKAS stores use paginated storefront queries with their actual currency, price list and warehouses. Probador uses option/price pairs; Coffee Department uses Ticimax native variants and tax-inclusive prices. Kronotrop and Milestones preserve source option identities and surcharges. KafeinKültür resolves valid combinations through its detail endpoint. Ordinarius now uses IdeaSoft: seven current parents, 112 variants.

**Cho Coffee remains unqualified:** ordinary public pages can respond, but the identified crawler receives HTTP 403. Its bounded parser is tested; full allowed source validation is still required. No access challenge is bypassed. All 39 active sources are attempted; qualification and current success are distinct. `shared/v2/qualified-sources.ts` is authoritative.

## Verification

Run `npm test` and `npm run check`. Focused tests cover page completeness, SKU price/stock coupling, rollback, recovery, daily deduplication, retirement and indexed detail lookup.

After quota reset, inspect the daily job's summary/artifact and D1 successes, health, catalog counts and row usage. Do not claim remote recovery until that run commits. Do not enable the Cloudflare cron alongside Actions.
