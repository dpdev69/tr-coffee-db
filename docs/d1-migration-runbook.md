# Supabase to D1 migration runbook

Status as of 2026-09-14: **source export, local canonical import/replay and reconciliation completed; remote staging verification and production cutover remain separate gates**. This is not a production migration completion claim. Do not disable Vercel, Supabase or the existing GitHub Actions scheduler before replacement validation.

## Baseline and local source evidence

Authorized source project: `orwpmyuqkqvlqjhtotou` (coffeedb). Snapshot: ignored `.local/v2/source.json`, completed `2026-09-14T20:34:32.201Z`, permissions 0600. Contains 43 roasters, 1,030 coffee rows, 4,041 scrape logs and public traceability records. It excludes correction reports, emails, redirect interaction data and private traceability rows.

```sh
npx tsx scripts/v2-export.ts
npx tsx scripts/v2-quality.ts --source .local/v2/source.json --write-reports
```

The exporter refuses to overwrite an existing file. For another capture, pass `--output .local/v2/source-TIMESTAMP.json`. It loads server credentials from local environment files without printing them, restricts the source hostname, verifies that output is ignored by git, orders and paginates every table, compares pre/post row counts and verifies stored table SHA256 digests. It makes SELECT requests only.

**Consistency limit:** this is an ordered paginated API export, not a PostgreSQL transaction or a complete disaster-recovery database backup. Stable row counts do not prove no values changed between pages or tables. At final cutover, pause the old writer under the cutover decision, export again, reconcile and retain the old database read-only. Do not claim a transactionally consistent snapshot until a write freeze or equivalent evidence exists.

## Phase gates

1. **P0 source audit:** preserve the export and review [data-quality.md](data-quality.md) and [crawler-health.md](crawler-health.md). Distinguish current public catalog (411 coffees at capture) from all 1,030 records. Do not filter historical/hidden rows out of migration merely to match a homepage count.
2. **P1 model:** review SQLite/D1 schema and source-to-canonical mapping. Never replay `supabase/migrations/*.sql` into SQLite. PostgreSQL arrays, JSONB, booleans, timestamps, generated identifiers, RLS and triggers need deliberate equivalents.
3. **P2 events:** pass deterministic identity, missing metadata, same-offer price, restock, idempotency and failed-crawl tests. Imports must produce zero discovery events.
4. **P3 runtime:** validate frontend/worker build and D1 binding contract in a real Workers-compatible runtime. Keep data import blocked until the root phase gate confirms the contract.
5. **P4 staging:** apply reviewed D1 migrations to a staging database, then load a transformed local source snapshot. No remote write is authorized by this document alone; follow the active task's deployment gate.
6. **P5 reconciliation:** run the checks below, repeat the exact import, and prove unchanged entity, observation and event counts. Exercise crawler overlap and failure recovery against staging.
7. **P6–P8 product:** verify event feed, filters, durable detail pages, outbound links, newsletter intake, error/empty states and privacy-safe analytics end to end.
8. **P9 cutover:** only after the evidence gates pass, freeze legacy writes, export/reconcile the final delta, switch frontend/API and then enable Cloudflare scheduling. Avoid two active writers into the same canonical target.

## Required legacy mapping rules

- Preserve every legacy roaster/coffee ID in `legacy_id_map` even when canonical IDs are deterministic hashes. Preserve old slugs as lookup aliases where unambiguous.
- Use stable `(roaster, external_id)` as a product source identity, retaining canonical URL as supporting evidence. A duplicate URL with different source IDs is a review conflict, not permission to merge products.
- **Known duplicate:** Sezy's `colombia-supremo-medellin` URL has legacy external IDs `387` and `61051`. Preserve both records/mappings; do not silently let one URL alias reassign the other identity.
- A legacy coffee carries only one flattened price/package. Create at most one explicitly uncertain legacy offer per legacy coffee; retain unknown weight/currency/stock as unknown. Do not invent a Shopify variant ID, or use weight/price/title changes as identity.
- Preserve current source observation once, with `source=import`, its genuine last-seen/scraped timestamp when available, and import provenance. Never stamp export time as a historical successful crawl observation.
- Zero/invalid prices must not become advertised free coffee or a valid unit price. Preserve original legacy value in archived source evidence and apply an explicit canonical validation policy.
- Legacy normalized roast/process/flavor/brew fields are feature evidence with a legacy rule version and unknown confidence unless source provenance establishes more. Keep them out of the objective raw-metadata fields when they are inferred.
- Preserve public lot/source/claim/assessment/certification/event data in a dedicated legacy evidence archive with original IDs and payloads. Do not turn one validated claim into a blanket verified-coffee claim.
- Preserve scrape logs as legacy operational history, separate from new successful live crawl evidence. Do not let import mode mark a roaster freshly crawled.

## Reconciliation acceptance criteria

| Check | Required evidence |
| --- | --- |
| Complete source coverage | Every exported roaster/coffee maps once; hidden/stale rows explicitly accounted for. |
| Source snapshot integrity | Counts and hashes match before transform; mismatches stop import. |
| Referential integrity | Actual SQLite `PRAGMA foreign_key_check` returns no violations. |
| Repeatability | Import identical snapshot twice into the same real SQLite/D1-compatible database; second pass changes no observations/events/entity counts. |
| Immutable history | The same snapshot cannot overwrite an imported price observation; changed snapshot handling is explicit. |
| No synthetic changes | NEW, PRICE_DROP, RESTOCKED, DEAL and OUT_OF_STOCK counts remain zero from import alone. |
| Monetary fidelity | Exact minor-unit conversion for positive prices; currency and known weight preserved; invalid values quarantined/unknown with retained raw evidence. |
| Legacy offer uncertainty | No inferred variant ID; later real SKU reconciliation does not compare unlike packages or synthesize restock/deal evidence. |
| Sample products | Compare several per adapter, including hidden/stale, missing price/weight, duplicate URL, decaf, and public traceability examples. |
| Counts | Report all-source vs legacy-current-public vs canonical-current-public separately; explain policy differences such as stale visibility and active-roaster rules. |
| Crawler overlap | Compare actual fresh old/new crawl identities, offers, prices, stock and timestamps for supported launch adapters; investigate differences. |
| Runtime | Browser user stories against staged Worker routes, real DB queries and endpoint errors; mocks clearly reported. |

The legacy database has no price history table. **Earlier price history cannot be recovered from this snapshot.** The only truthful migration result is one retained current-price observation per eligible legacy offer, with provenance; future successful crawls build trustworthy history. Baseline those new observations without flooding the feed with NEW events.

## Cutover and rollback

Before cutover record the old deploy identifier, canonical site URL, scheduler state, source export hashes, D1 staging/production identifiers and applied migration names in the checkpoint. Store secret values only in secret bindings or ignored local files. Prepare the old site's read-only rollback path before switching traffic.

At cutover pause the legacy writer, capture final source evidence, reconcile the accepted dataset, apply the known validated deploy, switch traffic and enable one Cloudflare scheduler. Check homepage/feed, representative detail routes, redirect destinations, signup response, analytics receipt and queue/crawl health. Purchase/domain registration is a separate owner action; no domain availability report authorizes buying it.

If critical data, routing, event or signup checks fail, disable the new scheduler, preserve D1 observations/logs for investigation and restore traffic to the prior working deployment with its retained Supabase data. Do not delete D1 evidence or restore an old snapshot over new immutable observations. If old ingestion must restart, make that an explicit operational decision so the read-only rollback is not silently converted to a competing writer.

Keep Supabase and prior deployment available read-only until the new production path has proved stable through agreed crawl cycles and actual monitoring. Record retirement as a separate later change. Schema rollback and frontend rollback are different operations; do not assume one reverts the other.

## Current evidence and remaining work

- Completed: live read-only source export, stable table counts, local digest verification, source-quality/crawl reports, gated importer implementation, actual SQLite repeated import and full local source reconciliation.
- Pending: staged D1 reconciliation, fresh crawler overlap, browser/runtime verification, final frozen export and production cutover. Root orchestration owns remote migration/deployment evidence; do not infer those steps from local success.
- Source limitations: no historic price time series; ambiguous flattened SKU identity; mixed normalized provenance; two zero-price unit-price entries; one duplicate-URL identity conflict. See linked reports for exact measured counts.

## P4 local migration evidence

Executed under **Node 22** after the root P3 compatibility gate. The local database is `.local/v2/migration.sqlite`, isolated from Wrangler's database. The script applies all sorted `migrations/d1/*.sql` locally with a checksum ledger; tested schema includes `0001_catalog.sql` and `0002_queue_job_idempotency.sql`.

```sh
node --import tsx scripts/v2-migrate.ts
node --import tsx --test tests/v2-migration-source.test.ts tests/v2-migration-import.test.ts
```

The first command reads the source snapshot, imports into the isolated real SQLite database, reconciles, replays the identical plan, reconciles again and writes:

- `.local/v2/import.sql`: DML-only staging artifact, no schema DDL or explicit BEGIN/COMMIT; keep ignored/private.
- `.local/v2/coffee-archive-backfill.sql`: additive original-coffee archive repair for a target already seeded with this exact source checksum.
- `.local/v2/migration-report.json`: source checksum, SQL SHA256, applied schema checksums, first/replay counts, warnings and query-plan evidence.

Use the SQL file through Cloudflare's **atomic bulk import** after applying the corresponding D1 schema. Do not split it into unrelated query batches. Cloudflare's import tool supplies its transaction; explicit BEGIN/COMMIT in the file are omitted per the [D1 import documentation](https://developers.cloudflare.com/d1/best-practices/import-export-data/). Remote staging database selected by root: `5090f52d-546e-4ba6-bdcd-b4ee531a29a3`; no remote write was performed by the importer.

The import guard accepts an empty target or the same stored source checksum. It refuses a different snapshot or an unseeded target that already has coffees, before inserting records. Every data insert uses conflict-ignore, so replay cannot roll a live price/stock update back, unretire a legacy offer, or overwrite immutable observations. A changed final export requires a fresh staging database or a separately reviewed delta migration; this seed tool deliberately does not silently update an existing seed.

| Local artifact metric | Verified value |
| --- | ---: |
| Roasters | 43 |
| Canonical coffees | 1,030 |
| Synthetic legacy offers | 1,030 |
| Import observations / import-mode observation runs | 1,030 / 1,030 |
| Normalized feature records | 7,229 |
| Legacy ID mappings including seed ledger and reviewed repair marker | 2,105 |
| Source/URL/slug aliases | 3,079 |
| Archived original coffee, roaster, traceability and scrape-log records | 13,452 |
| Discovery events generated | 0 |
| Foreign-key violations | 0 |
| Coffee/offer/observation samples reconciled | All 1,030 |
| Canonical visible current coffees / offers after reviewed name correction | 480 / 480 |
| Canonical current roasters | 38 |

**Count bridge:** after the reviewed DESCAFECOL correction, 480 canonical current coffees comprise exactly **411 original fresh legacy-current-public records, one recovered valid DESCAFECOL coffee, and 68 retained stale records**. No original fresh legacy-current-public coffee was lost. The previous 479-count artifact incorrectly excluded DESCAFECOL because its name contained the equipment-brand substring `cafec`. The additional stale records are a deliberate visibility-policy difference, not new releases, refreshed stock claims or evidence of 68 new SKUs.

**Identity bridge:** all 1,030 original coffee payloads are initially retained in `raw_metadata_json.sourceData.legacy` and verified against their legacy-map source hashes. Every exported table, including original coffee payloads, is separately preserved in `legacy_traceability` keyed by source table/original key. Successful crawls replace current raw metadata, so the separate archive is necessary for permanent legacy evidence. Observation runs are explicitly `mode=import` / `source=import`, and roaster last-success times retain actual legacy-log timestamps. No import time becomes a fresh successful crawl.

The Sezy duplicate-URL pair remains two hidden canonical identities pending review. Fifteen duplicate legacy-slug groups were found: nine aliases resolve only the sole legacy-current-public member; six ambiguous groups receive no arbitrary legacy-slug alias. Canonical slugs remain unique. Parsa `catalog-N` identifiers map to adapter-native `N`, retaining both source aliases and the original legacy payload; normalization that would merge two existing IDs fails planning.

The twelve targeted tests pass, including changed-checksum rejection with rollback, SQL metacharacters treated as data, missing timestamp rejection, duplicate identities/slugs, native-ID mapping, unknown weight/zero-price handling, raw/feature separation, immutable observations, replay after later stock/price/retirement changes, and additive archive repair after current raw metadata was replaced. Targeted ESLint and standalone TypeScript checks pass. Actual SQLite query plans use `offers_coffee_stock`, `observations_offer_time` and `events_type_time` for the tested offer, history and feed queries.

### Original coffee archive repair

The initial remote seed artifact omitted the coffee table from the separate archive because it existed in the current raw metadata. P5 real-ingestion smoke exposed that current raw metadata is replaced on every successful source crawl. The repaired importer archives all source tables, and the additive artifact repairs the existing remote seed without replaying current catalog rows.

Verified 2026-09-14 21:02 UTC: `.local/v2/coffee-archive-backfill.sql` is 1,844,316 bytes, SHA-256 `25fdc9e2ac2633f313cffff80fc4365c4497c81876a9752147af7b62296c8ec5`. Apply it through one atomic D1 bulk import. It requires the exact existing seed checksum, adds 1,030 `source_table='coffees'` records with conflict-ignore and touches no current coffee/offer rows. A different or unseeded database fails before mutation. Exact repeated application changes no rows.

Read-only post-import checks:

```sql
SELECT source_table,count(*) FROM legacy_traceability GROUP BY source_table;
SELECT count(*) AS coffee_payloads FROM legacy_traceability WHERE source_table='coffees'; -- 1030
SELECT count(*) AS total_archive FROM legacy_traceability; -- 13452
SELECT count(*) AS invalid_identity FROM legacy_traceability
 WHERE source_table='coffees' AND json_extract(payload_json,'$.id')<>legacy_id; -- 0
SELECT count(*) AS import_observations FROM price_observations WHERE source='import'; -- 1030
PRAGMA foreign_key_check; -- no rows
```

The fresh full `import.sql` is now 20,262,811 bytes, SHA-256 `58cf977c6a1c16fbf41001042c07f020392017fc5ce419a15412c812341a2014`. Use the smaller additive file on the existing remote seed. [P5 baseline evidence](evidence/p5-baseline.md) proves all 13,452 archived rows survive real source ingestion and replay locally; remote application remains the deployment owner's gate.

Local evidence is computational validation of this snapshot and schema. It does not establish physical stock, new-parser completeness, successful remote import, newsletter delivery, or production readiness.


### Reviewed DESCAFECOL visibility correction

The source row `b2c54bd1-f95f-43a3-9aa9-a6fe40ba1fed` / native product `8278173483194` is named DESCAFECOL DECAF and was already public/specialty in the export. The inherited equipment-name matcher incorrectly matched CAFEC inside that word. The importer now matches CAFEC at word boundaries; CAFEC accessories remain excluded.

`.local/v2/descafecol-visibility-repair.sql` is 3,772 bytes, SHA-256 `034e2f1b7f77e582c9dfe39a8c2ab07dfa7211c0a0139d06b35cba22ef1973ef`. Apply atomically only to the exact seed. It requires the reviewed ID/source ID/name and unchanged original raw metadata/timestamp before changing visibility. A `legacy_id_map` repair marker prevents repeated application from overriding a subsequent manual or live change. Prices, offers and observations are untouched. The repair adds one ledger row; seed reconciliation reports its separate `repairLedgerCount`. Root reported remote and local Wrangler application verified.

Local seed reproduction: `node --import tsx scripts/v2-migrate.ts --repair-visibility`. A new seed already has the corrected public visibility; an existing seed needs this explicit correction because ordinary seed replay intentionally never overwrites current rows. A touched target without the repair marker is rejected for review.

Both corrected offline baseline modes pass: `node --import tsx scripts/v2-baseline-smoke.ts` (three sources) and `node --import tsx scripts/v2-baseline-smoke.ts --qualified` (fourteen reviewed captures). The fourteen-source mode preserves all publication decisions and yields 481 current coffees / 38 roasters / 1,170 available offers. Its one added available coffee is explained by a newly observed available SKU, with no baseline event. See [P5 evidence](evidence/p5-baseline.md).
