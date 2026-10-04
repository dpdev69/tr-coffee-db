# P5 captured baseline acceptance

Checked 2026-09-14T21:14:22.679Z. Scope: **14 saved source captures**. This is offline SQLite integration using the real shared ingestion engine and catalog readers. No network, credentials or remote mutations were used.

| Source | Matched coffees | Actual source offers | In stock | Unknown weight | Absent coffees retained | Absent in-stock offers retained |
|---|---:|---:|---:|---:|---:|---:|
| petra | 8 | 198 | 198 | 0 | 14 | 0 |
| montag | 17 | 244 | 220 | 0 | 28 | 0 |
| aroasting-lab | 63 | 63 | 61 | 2 | 27 | 0 |
| coach-coffee | 12 | 216 | 180 | 9 | 2 | 0 |
| coffeenutz | 80 | 183 | 19 | 3 | 37 | 0 |
| nok-coffee | 16 | 18 | 17 | 0 | 34 | 0 |
| boxx | 5 | 57 | 57 | 0 | 7 | 2 |
| kimma | 13 | 132 | 132 | 7 | 0 | 0 |
| cup-of-joy | 9 | 72 | 72 | 18 | 1 | 0 |
| baristocrat | 6 | 7 | 7 | 0 | 11 | 2 |
| daphne | 7 | 15 | 5 | 0 | 1 | 0 |
| parsa | 12 | 22 | 20 | 0 | 15 | 0 |
| poka | 14 | 32 | 32 | 0 | 2 | 0 |
| molecule | 19 | 27 | 27 | 10 | 22 | 0 |

All 281 captured coffees matched imported source identities, including Parsa's explicit catalog-ID mapping. IDs, slugs and first-seen dates stayed stable. Exactly 281 ambiguous legacy offers were retired; their observations remained attached to their original IDs. Each of 1286 source offers has one new source observation and zero inherited import observations. No coffee was duplicated, and no observed coffee retained a legacy offer alongside its actual source offers.

Unknown weights: 49; unknown prices: 0; unknown stock: 0. Unknown weight remains SQL NULL and produces a NULL unit price. Captured prices, currencies, weights and stock states were checked field-by-field against every stored offer. Duplicate active offer identity groups: **0**; duplicate active source-variant groups: **0**.

Absence safety: all columns of 201 absent coffee rows and their offers remained unchanged, including 4 previously in-stock offers. A product missing from a complete capture did not become unavailable or receive an artificial retirement. This preserves source uncertainty; absence is not independent proof that retained stock is current.

All 1,030 import observations are byte-for-byte equivalent as ordered JSON before and after ingestion. Their SHA-256 is `bb2a15f61fdff00bb9a3a5f84e5e6ff87fcec865ba2cd12256600810193527d4`. All 13,452 archived source rows are unchanged, including all 1,030 original coffee payloads. Successful source crawls replace current raw metadata; the separate archive preserves its original legacy version.

Final database: 1030 coffees, 2316 offers including retired, 2316 observations and **zero events**. Foreign-key checks passed. Exact replay through both beginCrawl and ingestCrawl returned completed/replayed status and left the hash of all ingestion tables unchanged.

Canonical counts, every paginated catalog row and offer, and aggregated roaster counts reconcile: before 480 coffees / 38 roasters / 480 in-stock offers; after 481 / 38 / 1170. These are whole-database counts; other imported roasters retain their previous state.

Visibility bridge: 0 previously hidden imported coffees became public under the captured source classifiers; 1 coffees entered the available catalog and 0 left it. These are existing identities, not newly discovered coffees. Storage invariants do not independently establish whether every classification is appropriate; relevance review remains separate.

## Reproduce

Run with Node 22 or later from the coffee directory:

```sh
# Original Petra/Parsa/Daphne scope remains the default.
node --import tsx scripts/v2-baseline-smoke.ts
# All fourteen accepted entries in the local qualification manifest.
node --import tsx scripts/v2-baseline-smoke.ts --qualified
```

Both modes start with a fresh copy of the ignored migration database. Default output is `.local/v2/baseline-smoke.sqlite`; qualified output is `.local/v2/baseline-smoke-qualified.sqlite`. Each mode has its own corresponding `-report.json` with capture hashes, original timestamps, parser versions and exact metrics. Running either regenerates this Markdown report for that scope. All sorted D1 migrations are applied to the disposable copy. Source database SHA-256 remained `8daa2e364071ac3fcb8a8500e7869573dab4d5d1db08e3bfd187b49323656a32`; it was not modified.

## Scope and remaining gates

Qualification means a read-only single source run was complete and reviewed against captured-response legacy replay; it is not repeated-cycle or production certification. This script consumes the already qualified list and does not independently certify source-parser correctness. Qualification manifest: 2026-09-14T21:00:47.807823+00:00, SHA-256 2059a7ea562c749fdcc4cd8b989ec4c270e34b2f0237b67679060dead4051b36.

These assertions exercise SQLite atomic batches and actual shared application code. They do not prove remote D1 behavior, scheduled Queue delivery or the live site's user flows. Remote archive backfill was verified by the deployment owner separately; this script has no remote access. Remote Queue baseline and UI checks remain separate gates. Captures establish evidence at their recorded September 14 timestamps and are not new live crawls. No historical SKU prices were recovered or inferred.

## Significant visibility difference: investigated and corrected

The first fourteen-source run revealed fifty hidden-to-public changes: 35 legacy generic-blend exclusions, 14 broad-catalog exclusions, and Montag DESCAFECOL DECAF. This was a classifier-policy regression, not recovered objective metadata. The source snapshot contains 0 manual specialty overrides and no override signals among those fifty rows, so no actual force-exclude/admin record was lost in this snapshot.

The corrected captures use parser version `v2-source-2-eligibility`. The adapter now applies the legacy specialty eligibility rules separately from raw facts, including the explicit filter-paper regression. All 49 affected policy exclusions in this scope remain hidden. This run asserts both **zero hidden-to-public transitions and zero public-to-hidden transitions** against the corrected seed. These checks prevent a technically successful import from silently publishing reclassified products.

Concrete non-coffee defect corrected: A Roasting Lab source `7667514540074`, “Coffee Filters Brown Filtre Kahve Kağıdı 4 Numara (80 Adet)”. Its source describes filter papers and tags equipment/accessories. The earlier general filter matched “filtre kağıdı” but missed “filtre kahve kağıdı”. The reparsed snapshot retains the source evidence and offers with hidden visibility. Daphne's generic “Türk Kahvesi” likewise remains hidden, including in the default three-source mode; its sold-out state previously hid this regression from headline counts.

Montag DESCAFECOL DECAF (source `8278173483194`) is a separate reviewed false-positive correction: the archived source is already public/specialty. The old importer matched equipment brand “cafec” inside “descafecol”. The importer now uses a word boundary for this brand. The seed is 480 current coffees: 411 original fresh legacy-visible records + one reviewed DESCAFECOL recovery + 68 retained stale records. The targeted correction updates only visibility, requires the exact source checksum and unchanged imported metadata/timestamp, and stores a repair marker so replay cannot override later decisions. Its twelve migration tests pass. This smoke consumes that corrected seed.

The corrected fourteen-source run adds one current coffee through actual SKU availability, not classification: Coffeenutz “Kolombiya La Sirena Honey Peach” has unavailable source SKU `50077231776048` and available SKU `67409137041712`, whereas the legacy synthetic offer was unavailable. Baseline mode produces no RESTOCKED or NEW event.

Manual visibility persistence beyond this migration is a separate schema/engine concern: the source contract and current coffee table do not identify a dedicated manual publication override. A future manual hide needs an explicit persistence rule. This report does not claim that future admin overrides are verified or that publication of the wider allowlist has been approved.

| Roaster | Previously excluded product | Source product ID | Archived rejection | Corrected capture visibility |
|---|---|---|---|---|
| aroasting-lab | Darkness Blend Kahve 1000g | 7823845883946 | generic_blend | hidden |
| aroasting-lab | Titan Blend Kahve 50g | 7679828557866 | generic_blend | hidden |
| aroasting-lab | Intense Blend Kahve 50g | 7679828131882 | generic_blend | hidden |
| aroasting-lab | House Blend Kahve 50g | 7679828000810 | generic_blend | hidden |
| aroasting-lab | Good Fellas Espresso 50g | 7679827312682 | broad_catalog_entry | hidden |
| aroasting-lab | Astrower Blend Kahve 50g | 7679824920618 | generic_blend | hidden |
| aroasting-lab | Türk Kahvesi 100g | 7667932135466 | broad_catalog_entry | hidden |
| aroasting-lab | Türk Kahvesi 250g | 7667929350186 | broad_catalog_entry | hidden |
| aroasting-lab | Türk Kahvesi 1000g | 7667928596522 | broad_catalog_entry | hidden |
| aroasting-lab | Titan Blend Kahve 250g | 7667923189802 | generic_blend | hidden |
| aroasting-lab | Titan Blend Kahve 1000g | 7667921387562 | generic_blend | hidden |
| aroasting-lab | Intense Blend Kahve 250g | 7667821346858 | generic_blend | hidden |
| aroasting-lab | Intense Blend Kahve 1000g | 7667820593194 | generic_blend | hidden |
| aroasting-lab | House Blend Kahve 250g | 7667800244266 | generic_blend | hidden |
| aroasting-lab | House Blend Kahve 1000g | 7667798671402 | generic_blend | hidden |
| aroasting-lab | Good Fellas Espresso 1000g | 7667672842282 | broad_catalog_entry | hidden |
| aroasting-lab | Good Fellas Espresso 250g | 7667671859242 | broad_catalog_entry | hidden |
| aroasting-lab | Darkness Blend Kahve 250g | 7667567558698 | generic_blend | hidden |
| aroasting-lab | Coffee Filters Brown Filtre Kahve Kağıdı 4 Numara (80 Adet) | 7667514540074 | broad_catalog_entry | hidden |
| aroasting-lab | Astrower Blend Kahve - 1000g | 7667431768106 | generic_blend | hidden |
| aroasting-lab | Astrower Blend Kahve - 250g | 7667429081130 | generic_blend | hidden |
| coach-coffee | Coach Coffee Premium Türk Kahvesi \| Mr. Coach | 8104888271150 | broad_catalog_entry | hidden |
| coach-coffee | Coach Coffee Espresso \| Harmony Blend | 9739297095982 | generic_blend | hidden |
| coach-coffee | Coach Coffee Filtre Kahve \| Harmony Blend | 9316191043886 | generic_blend | hidden |
| coach-coffee | Coach Coffee Filtre Kahve \| Bench Blend | 8104877621550 | generic_blend | hidden |
| coach-coffee | Coach Coffee Espresso \| Bench Blend | 8104856912174 | generic_blend | hidden |
| coach-coffee | Coach Coffee Espresso \| Ace Blend | 8104855666990 | generic_blend | hidden |
| coach-coffee | Coach Coffee Filtre Kahve \| Ace Blend | 8104824766766 | generic_blend | hidden |
| coffeenutz | Türk Kahvesi No.2: Rüya | 15262475977008 | broad_catalog_entry | hidden |
| coffeenutz | Türk Kahvesi No.1: İskandinav | 15119066104112 | broad_catalog_entry | hidden |
| coffeenutz | NitroBrewd® Espresso Blend | 9890997502256 | generic_blend | hidden |
| coffeenutz | Süper Harman | 9692320694576 | generic_blend | hidden |
| coffeenutz | Ofis Kahvesi No.3: Test | 9294788854064 | generic_blend | hidden |
| coffeenutz | Ofis Kahvesi No.2: BitterSweet | 9251054977328 | generic_blend | hidden |
| coffeenutz | Ofis Kahvesi No.1: Harman | 6687335448679 | generic_blend | hidden |
| nok-coffee | Italiano Espresso Çekirdek Kahve 1 Kg x 10 Adet (Koli) | 9120698499303 | broad_catalog_entry | hidden |
| nok-coffee | Türk Kahvesi 1 Kg x 10 Adet (Koli) | 9120512344295 | broad_catalog_entry | hidden |
| nok-coffee | Intenso Espresso Çekirdek Kahve 1 Kg x 10 Adet (Koli) | 9086701863143 | broad_catalog_entry | hidden |
| nok-coffee | Intenso Espresso Kahve Harmanı Çekirdek (Öğütülmemiş) 1 Kg | 8966843269351 | generic_blend | hidden |
| nok-coffee | Italiano Espresso Kahve Harmanı Çekirdek (Öğütülmemiş) - 1 Kg | 8966840516839 | generic_blend | hidden |
| kimma | ESPRESSO BLEND NO: II | 4503575527484 | generic_blend | hidden |
| kimma | ESPRESSO BLEND NO: I | 4503574413372 | generic_blend | hidden |
| kimma | SPECIALTY BLEND | 4503573495868 | generic_blend | hidden |
| cup-of-joy | HOUSE BLEND KG | 7564225544327 | generic_blend | hidden |
| cup-of-joy | HOUSE BLEND 250 GR | 4797378068615 | generic_blend | hidden |
| baristocrat | Baristocrat Blend – Türk Kahvesi | 8537 | generic_blend | hidden |
| baristocrat | Aristocrat Espresso Blend | 8494 | generic_blend | hidden |
| daphne | Türk Kahvesi | 6493 | broad_catalog_entry | hidden |
| poka | POKA ESPRESSO BLEND | 3779 | generic_blend | hidden |

