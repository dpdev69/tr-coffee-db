# Source data quality

## Current V2 staging quality — 2026-09-14, 21:52:49 UTC

The verified remote current public available catalog contains **481 coffees / 38 roasters / 1,170 offers**. D1 holds **2,786 price observations**, including 1,030 imported snapshot observations, and **13,452 immutable archive rows**. There are **zero coffee events, zero crawl errors and zero duplicate observation groups**. The archived legacy records remain available for traceability; current offers and source-derived profiles are separate from that archive.

All **14 qualified sources** have successful real baselines. Petra, Daphne and Parsa also passed a second baseline and an unchanged LIVE cycle. The combined reviewed captures contain 281 products and 1,286 offers; 232 products are public, 49 hidden, and 156 public products have an available offer. Profiles come from current captured text as versioned `RULE_INFERRED` values with null confidence and source references. Raw source facts remain separate, and manual provenance is protected.

| Current quality measure | Verified value |
| --- | ---: |
| Public available offers with known price | 1,166 / 1,170 |
| Public available offers with unknown price | 4 |
| Public available offers with known weight | 1,042 / 1,170 |
| Public available offers with unknown weight | 128 |
| Public available offers with TRY currency | 1,170 / 1,170 |
| Qualified-capture offers with unknown price or stock | 0 / 1,286 |
| Qualified-capture offers with unknown weight | 49 / 1,286 |
| Qualified-capture public available offers with unknown weight | 26 |
| Existing coffee visibility transitions after corrected baselines | 0 |

Unknown values remain null; an unknown weight cannot support a unit-price comparison. The full catalog includes imported offers from unqualified sources, which explains why its unknown counts exceed the qualified captures. The sole net availability increase from the corrected baseline is the reviewed CoffeeNutz La Sirena Honey Peach native SKU that the legacy flattened selection omitted. Baseline ingestion did not invent a restock or price event.

See [queue-cycle evidence](evidence/p9-queue-cycles.md) and [qualified-baseline evidence](evidence/p9-qualified-baselines.md) for actual runs, before/after comparisons and available package weights. The 25 active unqualified sources remain paused, and cron remains disabled for all sources. One baseline does not prove continued source health; repeated remote cycles cover only three sources. Positive event generation and remote failure/retry handling were not exercised by these successful runs.

## Historical legacy audit — export at 20:34:32 UTC

Measured from the read-only legacy Supabase export completed **2026-09-14T20:34:32.201Z**. Project: coffeedb. Reproduce with `npx tsx scripts/v2-export.ts --output .local/v2/source-NEW.json` then `npx tsx scripts/v2-quality.ts --source .local/v2/source-NEW.json --write-reports`.

## Legacy scope and counts

“Current public catalog” reproduces the existing 3-day freshness, specialty/public, availability and name-exclusion rules; cutoff **2026-09-11T20:34:32.201Z**. “All source” includes hidden and stale rows so migration reconciliation does not discard data. A stale record is not proof of stock absence.

| Metric | All source | Current public catalog |
| --- | ---: | ---: |
| Roasters | 43 | 36 |
| Roasters marked active | 39 | — |
| Coffee records | 1030 | 411 |
| Coffee records marked available (before freshness/visibility filters) | 563 | — |
| Canonical SKU offers | Not modeled in legacy source | Not measurable |
| Missing origin | 197 | 31 |
| Missing/unknown process | 318 | 62 |
| Missing/invalid weight | 299 | 97 |
| Missing/invalid price | 11 | 4 |
| Stale or never-seen coffee records | 432 | — |
| Stale active roasters (last successful log >3 days or none) | 2 | — |
| Duplicate (roaster, external_id) groups | 0 | — |
| Duplicate canonical URL groups within a roaster | 1 | — |
| Duplicate legacy slug groups | 15 | — |
| Stored unit price inconsistent with positive TRY price/known weight | 2 | — |

## Legacy trust limitations and migration implications

- Legacy coffees contain one flattened package/price, not all offers. An active-offer count cannot honestly be reconstructed by renaming coffee count. The importer may create one explicitly uncertain legacy offer per row, but that is a migration artifact, not verified complete SKU coverage.
- **Historical prices: unrecoverable from this source.** There is no legacy price-observation/history table in the repository schema. Only the current snapshot price and observation timestamp can be preserved once; do not generate historical price drops, deals, restocks or NEW events from the import. Trace listed events are mutable current evidence, not a price time series.
- **Compare-at pricing: not measured.** Legacy source has no separate compare-at column; questionable compare-at pricing counts are N/A, not zero.
- **Suspicious identity changes: not provable from one snapshot.** Duplicate canonical URL groups (1) are review candidates, not confirmed identity churn. Distinct source IDs must not be merged automatically.
- Existing normalized process, roast, brew and taste fields have mixed declared/inferred origins. Preserve them as legacy feature provenance with unknown confidence; do not promote them into verified raw source truth.
- Counts and table hashes were checked during ordered, paginated export. The export is not a transactionally consistent cross-table database backup; a write freeze and final export/reconciliation remain required at cutover.
- Correction reports, emails, redirect interaction data, and non-public traceability records are excluded. 0 exported rows had credential/email-like values redacted. Public producer/assessor names in catalog provenance are retained as catalog data.

## Preserved source table counts

| Table | Rows |
| --- | ---: |
| roasters | 43 |
| coffees | 1030 |
| coffee_specialty_overrides | 0 |
| supply_chain_organizations | 39 |
| coffee_lots | 744 |
| trace_sources | 744 |
| coffee_claims | 3220 |
| trace_events | 2825 |
| coffee_assessments | 22 |
| coffee_certifications | 0 |
| lot_organizations | 744 |
| scrape_logs | 4041 |

## Duplicate URL candidates

- Coffee IDs: 0a6bc039-727c-446b-858a-99fbf13dbbbe, ef740213-67eb-4c1c-ae28-110b4c1eeb0c. External IDs: 387, 61051.

## Crawler evidence

See [crawler-health.md](crawler-health.md) for current V2 staging health and the separately dated historical success rates, adapter errors and last attempts. No new crawl or remote mutation was run to generate the original legacy source audit; the later authorized staging runs are summarized at the top of this document.
