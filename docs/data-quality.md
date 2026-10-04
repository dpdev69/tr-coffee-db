# Source data quality

## Source counts — 2026-10-05

`scrapers/src/roasters/configs.ts` now holds **44 configured sources**: 43 active and Cho Coffee inactive (HTTP 403). `shared/v2/qualified-sources.ts` lists **39 qualified sources**. Of the five sources added on 2026-10-05, `caffe-di-toee` passed the storefront review below and is qualified; `coffee-sapiens`, `lot-coffee`, `mayard` and `vitus` remain configured but **unqualified**. The nightly refresh still attempts them; because they are unqualified, `scripts/v2-refresh.mts` records their snapshots as partial and publishes nothing. The counts in the sections below describe their earlier dates (the 39-source and 14-source figures are historical).

To qualify a source (the process in [crawler-comparison.md](crawler-comparison.md) and [free-catalog-refresh.md](free-catalog-refresh.md)): capture a complete paced snapshot with `crawlRoaster` (it reports `complete: true` only when pagination and every SKU were covered), review its product identities, prices, weights and stock against the live storefront, run the staging baseline for the slug and compare it with that review, and only then add the slug to `QUALIFIED_SOURCE_SLUGS` and update the length assertions in `tests/v2-crawler-worker.test.ts`. The staging baseline writes to the remote database and needs the owner's go-ahead. Fixture tests alone do not qualify a source.

## Storefront review of the five new sources — 2026-10-05

One `crawlRoaster` snapshot per source was captured from a workstation (same paced crawler as the nightly job) and compared with the live product pages: page HTML fetched at least 1.5 s apart, the storefront's own variant data (Shopify variant `<option>`s, WooCommerce `data-product_variations`, IKAS `__NEXT_DATA__`), visible price text, and for client-rendered stock a browser check. Each snapshot was then run through `registerRoaster` → `beginCrawl` → `ingestCrawl` (baseline mode) against an in-memory SQLite database with all D1 migrations applied. No remote database was touched; the staging baseline for `caffe-di-toee` is still to be run by the scheduled job.

| Source | Snapshot (coffees / offers) | Sampled vs page | Price, weight, stock, currency, link | Decision |
| --- | ---: | ---: | --- | --- |
| `caffe-di-toee` (IKAS) | 12 / 14 | 12 of 12 | all match | **Qualified** |
| `lot-coffee` (WooCommerce) | 11 / 170 | 9 of 11 (+ Hola! Colombia) | all 146 sampled variants match | Not qualified: two unsupported profile values |
| `coffee-sapiens` (Shopify) | 13 / 180 | 10 of 13 | all 136 sampled variants match | Not qualified: a two-coffee set is public; one unsupported note |
| `mayard` (IKAS) | 16 / 141 | 11 of 16 | all sampled variants match, incl. 2 sold out | Not qualified: "Honey" tasting note from process names |
| `vitus` (IKAS) | 24 / 94 | 10 of 24 + listing | all match; every coffee is sold out | Not qualified: nothing to publish; latent set issue |

Ingestion skipped nothing for any source (0 crawl errors, no null prices or weights).

- **Caffe Di Toee.** The IKAS catalog (count 12) is the whole shop; all 12 products are kept, 8 public single origins and 4 hidden blends/Türk kahvesi. Every price is the page price (no discounts), every product is in stock and shows "Sepete Ekle", weights match the 250 g / 1000 g options and product names, currency is ₺. Profiles carry only origin (from the name) and decaf, which the pages support; descriptions state no process or notes.
- **Lot Coffee.** Config fix: `excludedProductSlugs: ['holacolombia']` — "Hola! Colombia" is a 100 g + 100 g + 50 g sampler filed under Specialty and was public as one 250 g coffee. Sample Box and equipment are correctly excluded. Grind options are separate SKUs at equal price and collapse in the catalog; the shop itself prices two grinds differently (Santa Helena 1000 g French Press 1,980 vs 2,200 ₺; Lot 01/02 1000 g Chemex/French Press 1,680 vs 1,850 ₺), and the snapshot reproduces that. Remaining defects (shared normalization): Santa Helena gets `brew_compatibility: moka_pot` from the supplier name "Moka Trade"; Honduras Tutule gets `roast_classification: medium_dark` from "Kavurma Profili Espresso/Filtre".
- **Coffee Sapiens.** Config fix: `collectionHandle: 'coffee-collection'`. The whole-shop feed has no product types or tags and listed seven zero-price brew guides ("FRENCH PRESS", "MOKA POT", "SOĞUK KAHVE NASIL YAPILIR?" were public with unknown price). The collection holds the 15 coffee products; capsules and the espresso set are correctly excluded. Remaining defects: "EVOLUTION & MUTATION İKİLİ SET" (two 100 g packs, page says "Her paket 100 gram") is public as a 200 g coffee because the set rule matches "seti" but not "set"; Gigi Manis gets tasting note "Orange" from the variety "Orange Bourbon" (page notes: nar, kiraz, naşi armudu).
- **Mayard.** Prices, weights and stock (Uganda and La Sirena show "STOKTA YOK") match. The IKAS query reads no product attributes, so tasting notes come from product names: "Honey" is emitted for El Mango, La Sirena, Liberica "Honey Mosto" and Las Torres, where honey is the process; the pages' own "Tadım Notları" are e.g. Beyaz Nektarin, Mango, Vanilya, Earl Grey (El Mango) and Şeftali, Beyaz Çay, Nektar, Bal Kavunu (Liberica).
- **Vitus.** The storefront really is sold out: the Nitelikli Kahveler listing shows "Tükendi" on all 10 coffees and product pages show "Stok Yok" (browser check); 127 of 128 variant stock entries are zero. Ingesting it publishes nothing. "XOX Espresso Experience 3x75GR" (a three-coffee box) would become public as a 225 g coffee on restock. Re-review when stock returns.

## Current V2 staging quality — 2026-09-14, 21:52:49 UTC

The verified remote current public available catalog contains **481 coffees / 38 roasters / 1,170 offers**. D1 holds **2,786 price observations**, including 1,030 imported snapshot observations, and **13,452 immutable archive rows**. There are **zero coffee events, zero crawl errors and zero duplicate observation groups**. The archived legacy records remain available for traceability; current offers and source-derived profiles are separate from that archive.

`shared/v2/qualified-sources.ts` now lists **38 qualified sources**. This snapshot (2026-09-14) covers the original 14, which all had successful real baselines. Petra, Daphne and Parsa also passed a second baseline and an unchanged LIVE cycle. The combined reviewed captures contain 281 products and 1,286 offers; 232 products are public, 49 hidden, and 156 public products have an available offer. Profiles come from current captured text as versioned `RULE_INFERRED` values with null confidence and source references. Raw source facts remain separate, and manual provenance is protected.

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
