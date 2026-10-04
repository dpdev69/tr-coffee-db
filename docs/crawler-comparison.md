# V2 crawler validation and comparison

## Current remote result — 2026-09-14, 21:52:49 UTC

All **14 reviewed sources now have successful remote staging baselines** using the corrected eligibility/profile policy. Their combined captures contain **281 products / 1,286 offers**, including **232 public / 49 hidden products** and **156 public products with an available offer**. All captured offers have known price and stock; **49 retain unknown weight**. These capture counts include hidden and unavailable products and are distinct from the current catalog totals below.

Petra, Daphne and Parsa completed two real baselines and one unchanged LIVE cycle each. The second baseline restored their current profiles; a duplicate Petra message added no duplicate persisted observations. The remaining 11 sources completed their first baseline on the first queue attempt at 21:50:51–21:51:56 UTC. Product/visibility, source offer identity/price/compare-at price/currency/weight/stock, and feature/provenance signatures for those 11 match the reviewed offline captures. No same-time legacy crawl is claimed.

Remote D1 now contains **481 current public available coffees / 38 roasters / 1,170 available offers**, **2,786 observations**, and **13,452 immutable archive rows**. Events, crawl errors and duplicate observation groups are all zero. Existing coffee visibility is unchanged. The net +1 available coffee is the already reviewed CoffeeNutz La Sirena Honey Peach SKU; it is not a generated RESTOCKED event. All 1,170 available offers use TRY; 4 have unknown price and 128 have unknown weight, including remaining imported records. Of the 49 unknown-weight offers in the qualified captures, 26 are public and available.

See [remote queue cycles](evidence/p9-queue-cycles.md) and [remaining qualified baseline evidence](evidence/p9-qualified-baselines.md) for actual timestamps, counts, package weights, nullable fields, comparisons and queue state. Both queues were empty after verification. `CRAWL_MODE=baseline` and `CRAWLS_ENABLED=false` remain unchanged. The **25 active unqualified sources remain paused**; no all-source or expanded LIVE schedule was enabled.

This establishes a remote baseline for the reviewed 14 and short repeated-cycle behavior for three. It does not establish long-term reliability, actual positive price/stock-change event generation, remote failure/retry/DLQ handling, or coverage for the other 25 active sources.

## Historical source investigation

The sections below retain the original 2026-09-14 source probes, subsequent offline reparses and checks, using Node 22.23.2. Their earlier counts and pending gates describe those stages; the remote result above is the current evidence.

## Initial read-only method and boundaries

`npx tsx scripts/v2-compare-crawlers.ts <explicit roaster slugs>` calls only the safe V2 public-source adapter. No remote database writes or legacy `run()` calls occur. Requests are sequential, delayed 500 ms, capped at 80 requests, five catalog pages, 15 seconds/request, and 5 MB/response. Off-roaster redirects and access challenges fail closed. Captures are stored in ignored `.local/v2/crawls/`; only a small factual specimen with provenance is committed in `tests/fixtures/v2/live-public-samples.json`. Cookies/authorization headers are not retained.

Two distinct comparisons were performed:

1. Current source results against `.local/v2/source.json`, exported at 20:33:51–20:34:32 UTC. This is an earlier stored legacy catalog, not a simultaneous legacy crawl.
2. Untouched legacy `fetchProducts()` replay against the same captured successful public JSON responses used by V2. The script intercepts every axios request, supplies only recorded responses, never invokes `run()`, and has no live network fallback. The database client is constructed with a dummy local-only URL/key if environment variables are absent; no database methods are called. Existing challenge paths receive no challenge payload and are never executed. Shopify’s legacy extra page request receives a synthetic empty page because the captured page contains fewer than the requested 250 products; this terminal-page inference is explicitly recorded.

Replay command: `npx tsx scripts/v2-compare-crawlers.ts --replay <capture-file>`. The `-replay.json` artifact contains raw legacy output, comparison, call count and parity results.

## Source results

| Roaster | Source probe UTC | V2 coffees | Offers | Available coffees / offers | Unknown weight / price / stock offers | Complete |
|---|---|---:|---:|---:|---:|---|
| Petra | 20:43:14 | 8 | 198 | 8 / 198 | 0 / 0 / 0 | Yes |
| Daphne | 20:44:14–20:44:22 | 7 | 15 | 2 / 5 | 0 / 0 / 0 | Yes |
| Parsa | 20:43:14–20:43:23 | 12 | 22 | 11 / 20 | 0 / 0 / 0 | Yes |
| Paper (IKAS) | 20:42:02 | 18 | 253 | 17 / 214 | 3 / 0 / 0 | No: embedded pagination unverified |
| Kronotrop (HTML) | 20:48:10–20:48:21 | 16 | 16 | 13 / 13 | 16 / 0 / 0 | No: complete package options unverified |

The three complete baselines contain **27 coffees / 235 offers**, with **21 available coffees**. Baseline ingestion must suppress NEW, PRICE_DROP, RESTOCKED and DEAL events. The two incomplete sources must not reconcile current state or infer absence.

## Stored catalog reconciliation

| Roaster | Stored coffees / available | Source coffees / available | Source-absent legacy records | Interpretation |
|---|---:|---:|---:|---|
| Petra | 22 / 8 | 8 / 8 | 14 | All 14 were already unavailable |
| Daphne | 8 / 2 | 7 / 2 | 1 | Already unavailable |
| Parsa | 27 / 11 | 12 / 11 | 15 | All 15 already unavailable; native product IDs need aliases |
| Paper | 26 / 15 | 18 / 17 | 10 | All ten absent records already unavailable; two source-only products need review |
| Kronotrop | 16 / 13 | 16 / 13 | 0 | All canonical URLs reconcile after category-classification fix; SKU coverage still incomplete |

For Parsa, all 12 matched products have native IDs such as `101`, versus legacy `catalog-101`. Canonical URL matches establish a deterministic mapping candidate. Paper’s native product IDs replace legacy slug IDs for 16 matched products. Kronotrop’s JSON-LD product IDs replace flattened URL-path IDs for all 16 products. None of these changes constitutes a NEW coffee. Review and persist identity aliases before baseline import or future live reconciliation.

Stored rows do not preserve the selected SKU IDs; every stored scalar price comparison is therefore reported as ambiguous. Equal weight is insufficient to prove the same grind/SKU. This report does not manufacture historical price drops.

## Same-response legacy parser replay

| Roaster | Legacy / V2 coffees | Legacy selected price+weight+stock tuples present in V2 | Source-ID variant checks | Result |
|---|---:|---:|---:|---|
| Petra | 8 / 8 | 8 / 8 | 198 | 48 bag-weight differences explained below; price and stock agree |
| Daphne | 7 / 7 | 0 / 7 | Legacy discarded IDs | All legacy selected weights are null; V2 reads real variation weights |
| Parsa | 12 / 12 | 12 / 12 | Legacy discarded IDs | Selected tuples agree; V2 retains all 22 native variants |

### Investigated differences and fixes

- **Petra compare-at zero sentinel:** source variants include `compare_at_price: "0.00"`. The first V2 probe failed rather than accepting a zero price. The parser now treats zero in this optional Shopify comparison field as unknown, preserving raw source data. A zero current price still fails validation. Successful re-probe produced the complete baseline above.
- **Parsa zero base component:** Guatemala Oriente (`kod:103`) declares base price `0.00`, then package surcharges `950.00` and `3230.00`. The first V2 probe failed by validating the intermediate component as a retail price. The parser now permits a nonnegative base component and validates the summed retail price. Native offer `127` is 250 g / TRY 950. Successful re-probe produced all 12 products / 22 offers.
- **Petra shipping weights are unreliable:** 48 source variants have `grams` that conflict with bag labels. Example KOYU variant `53698199912588` says `2.5kg` but `grams:250`; V2 uses 2500 g. Guatemala Abraço variant `47716333879436` says `500gr` but `grams:250`; V2 uses 500 g. This affects potential unit-price calculations, not a change in retail price. All 198 same-ID prices and stock states agree in replay. Some compare-at values are below current prices (for example TRY 189 versus TRY 7500); they remain raw promotion metadata and cannot qualify as a real deal.
- **Daphne legacy package parsing misses “Paket”:** the old adapter does not recognize this weight-attribute label and returns parent minimum price with null weight. V2 requests every variation and reads `Paket: 100 gr` / `Paket: 250 gr`. For Endonezya Guntur, legacy selected TRY 355 / unknown weight; source variation `6862` is 100 g / TRY 355 and `6863` is 250 g / TRY 850. This is additional package knowledge, not a price increase/drop.
- **Kronotrop origin-only product names:** initial generic V2 filtering unnecessarily required the word coffee, losing origin-only entries. Configured coffee-category discovery now uses the existing exclusion classifier without that redundant condition. A re-probe reconciled all 16 coffee URLs and 13 available coffees. JSON-LD does not establish bag weights, so all 16 remain unknown and the run remains partial until source-specific option parsing is verified.

## Reproducible artifacts

Complete source captures suitable for isolated staging baseline review:

- `.local/v2/crawls/2026-09-14T20-43-14-079Z-petra.json`
- `.local/v2/crawls/2026-09-14T20-44-14-843Z-daphne.json`
- `.local/v2/crawls/2026-09-14T20-43-14-282Z-parsa.json`

Each contains `summary`, `snapshot`, `comparison`, and successful/failed public `responses`. Associated `-replay.json` files record same-source legacy comparison. Paper’s first probe predates response-envelope capture but preserves parsed sourceData. Failed initial probes remain on disk for diagnosis.

## Initial checks and limits at 20:48 UTC

23 adapter tests passed on Node 22, including synthetic fixtures, reduced real Petra/Daphne/Parsa specimens, discovered zero-price-component regressions, complete/partial crawl semantics, pagination failures, duplicate IDs, unknowns, category names, redirects, and challenge refusal. Scraper typecheck and focused ESLint passed. Root web typecheck passed earlier in the work, but the final concurrent run failed in generated `.next/types/validator.ts` because `./routes.js` lacked AppRoutes/LayoutRoutes/ParamMap/AppRouteHandlerRoutes exports. No adapter/script type errors were reported; the root build owner must regenerate and recheck these Next artifacts.

At this initial stage, five roasters had been probed and the remaining 34 had not been live-validated. The later qualification and remote evidence below supersede that coverage count and the initial pending D1 baseline gate. IKAS and HTML families remain partial; failed or partial sources must not overwrite the imported catalog. No source-price observation from this initial report establishes a historical deal.


## Expanded bounded qualification: 20:51–20:59 UTC

The remaining 19 Shopify/Woo sources were attempted sequentially using a lower cap of 50 requests/source, five pages, 10 seconds/request and 500 ms delay. Known completed Petra/Daphne/Parsa sources were not fetched again. Clear parsing discrepancies were corrected with regression tests; Poka was reparsed offline from recorded responses to avoid another source crawl. No retry beyond a documented parser correction, access-challenge handling, or remote write occurred.

| Additional source | Coffees | Offers | Available coffees | Unknown-weight offers | Qualification |
|---|---:|---:|---:|---:|---|
| montag | 17 | 244 | 16 | 0 | Qualified baseline |
| aroasting-lab | 63 | 63 | 61 | 2 | Qualified baseline |
| coach-coffee | 12 | 216 | 10 | 9 | Qualified baseline |
| coffeenutz | 80 | 183 | 12 | 3 | Qualified baseline |
| homestead | 0 | 0 | 0 | 0 | Failed: network |
| nok-coffee | 16 | 18 | 15 | 0 | Qualified baseline |
| boxx | 5 | 57 | 5 | 0 | Qualified baseline |
| null-coffee | 0 | 0 | 0 | 0 | Failed: network |
| kimma | 13 | 132 | 13 | 7 | Qualified baseline |
| cup-of-joy | 9 | 72 | 9 | 18 | Qualified baseline |
| baristocrat | 6 | 7 | 6 | 0 | Qualified baseline |
| coffee-friendzone | 15 | 49 | 11 | 45 | Partial: 50-request cap |
| coffeemamma | 7 | 44 | 5 | 42 | Partial: 50-request cap |
| old-java | 0 | 0 | 0 | 0 | Failed: 10s timeout |
| ordinarius | 6 | 42 | 5 | 0 | Partial: 50-request cap |
| poka | 14 | 32 | 14 | 0 | Qualified baseline |
| sezy | 2 | 36 | 2 | 0 | Partial: 50-request cap |
| molecule | 19 | 27 | 19 | 10 | Qualified baseline |
| williams | 2 | 36 | 2 | 0 | Partial: 50-request cap |

**14 of 22 JSON-family sources now have reviewed complete baseline captures**, totaling 281 coffees / 1286 offers. 49 offers retain unknown weight; none has unknown price or stock. Eight JSON-family sources remain held (five request-budget limits, two network failures, one timeout). Paper and Kronotrop remain partial; the remaining 15 IKAS/HTML sources have not been probed. No failed/partial source is a scheduler allowlist candidate.

The exact reviewed source and replay paths are in ignored `.local/v2/crawls/qualification.json`. Treat this manifest as a baseline-review allowlist, not permission to publish unreviewed legacy ID changes or fake initial events. It deliberately selects the corrected `poka-reparsed.json`, not the preliminary capture. Source snapshots preserve original request timestamps.

Additional same-source replay findings:

- All eight newly qualified Shopify sources retained matching source-ID variant prices and stock. Weight differences arise from trustworthy product-title weight fallback or shipping-grams conflicts; weights without textual evidence remain null.
- Kimma lacked product_type and tags on three origin-only coffees. Removing the unsupported positive-keyword requirement restored 13 coffees / 132 offers, matching legacy replay.
- CoffeeNutz source-declared training tickets and bottled-only drinks must be excluded before SKU validation. Three legacy false positives are intentionally absent: Coffee Roasting Training & Acoustic-Based Crack Listener App; CoffeeNutz Kahve Barı; Intro to Coffee / Kahveye Giriş (Online). The corrected source capture contains 80 catalog coffees / 183 offers. Retained same-ID variant prices and stock agree.
- Poka initially included a gift-category mug and ready-to-drink bottled coffee. Restored Woo category exclusions and Turkish-safe substring matching remove both. Corrected offline reparse contains 14 coffees / 32 offers, matching legacy replay coffee count; all weights are known.
- Molecule has four uncategorized origin-only coffees. Preserving legacy exclusion-only behavior for such curated source records restored 19 coffees / 27 offers. All 19 legacy selected tuples exist in V2, and replay is complete.
- Boxx’s two previously available Ethiopia Guji listings and Baristocrat’s previously available Rwanda–Gisanga and Kenya–Bomu La Matunda Tatu were absent from captured source catalogs and legacy replay alike. Record source absence; do not pretend the roaster explicitly declared them out of stock.
- Legacy replay now records missingRequests and replayComplete, so legacy error fallbacks cannot falsely certify a comparison. Preliminary Molecule replay was incomplete because excluded products’ details had not been captured; the final corrected capture and replay are complete.

28 Node22 adapter tests, scraper typecheck, and focused ESLint passed after the expanded qualification fixes. This evidence supports controlled staging ingestion and a restricted scheduler; it does not establish all-roaster production readiness or multi-cycle stability.

## Eligibility reparse — 2026-09-14 UTC

The P5 comparison exposed a V2 policy regression: the adapter boundary marked every discovered coffee public, bypassing the existing specialty classifier. The 50 old-hidden→public cases comprised 35 generic blends, 14 broad catalog entries, and one separate importer CAFEC-substring defect. A Roasting Lab product `7667514540074`, “Coffee Filters Brown Filtre Kahve Kağıdı 4 Numara (80 Adet),” additionally demonstrated a filter-paper name and equipment-taxonomy gap.

`v2-source-2-eligibility` now calls the existing pure specialty classifier for visibility and records its decision/reason as a `RULE_INFERRED` eligibility feature. Its normalization results are used only as classifier inputs; they do not populate source-declared origin, taste or other metadata. Source URLs and IDs are excluded from classifier text to avoid inferring an origin from a handle. Filter paper with an intervening “kahve” word and explicit equipment taxonomy are hidden. The current policy rejects blend/harman titles without an explicit inclusion override; no new blend exception was invented.

All 14 qualified captures were reparsed from saved responses, with no public-source requests. The original capture times remain intact and `qualification.json` now points to the reparsed files while keeping `priorCaptureFile`. Product and offer preservation remains **281 products / 1,286 offers**; eligibility is now **232 public / 49 hidden**, with **156 public products having an available offer**. The old “201 available coffees” figure counted all discovered products regardless of eligibility and is not the public-catalog total. Migration reconciliation independently reviews visibility transitions before publication.

Validation: 32 adapter tests pass, including generic blends/broad entries, filter paper/taxonomy, named origin coffee, DESCAFECOL boundary safety and shared Woo/Parsa eligibility. Both application and scraper TypeScript checks and focused ESLint pass. This reparse does not establish a new observation time or a later source crawl.

The corrected P5 smoke then reported **zero hidden→public and zero public→hidden transitions** against the repaired importer seed. The staged-copy current catalog became 481 coffees / 38 roasters / 1,170 available offers, with zero baseline events. Its net +1 available coffee is CoffeeNutz Kolombiya La Sirena Honey Peach: source SKU `67409137041712` is in stock while sibling SKU `50077231776048` is not; the legacy flattened row represented only the unavailable selection. See `docs/evidence/p5-baseline.md` for the independent reconciliation evidence.

## Browser-found profile and translation repairs — 2026-09-15

The fresh-crawl browser check exposed an additional regression: successful reconciliation replaced prior normalized features with only the eligibility decision, leaving all eight Petra cards without a profile. Parser `v2-source-3-profile` now emits current-text origin, process, taste, variety, roast and brewing features as `RULE_INFERRED`, with `confidence: null`, source URL and `v2-profile-1` version. These values never populate source-declared metadata. The feature extractor excludes source IDs, handles, image URLs and unrelated navigation metadata. It removes the legacy Gesha/Geisha→Panama shortcut before origin extraction; unknown origin remains absent, and an explicit Guatemala mention is still recognized when Gesha precedes it.

All 14 source captures were reparsed offline again. Exact assertions prove unchanged product IDs, canonical URLs, names, raw payloads, eligibility decisions, offer IDs, prices, weights and stock for every product. Only profile features and parser version changed. `qualification.json` points to the new capture files, retaining `eligibilityCaptureFile`; source observation timestamps remain original. See `.local/v2/crawls/profile-reparse.json` for per-source before/after counts.

| Source | Products with profile before → after | Origin | Process | Taste |
|---|---:|---:|---:|---:|
| petra | 0 → 8 | 4 | 1 | 8 |
| montag | 0 → 17 | 16 | 16 | 17 |
| aroasting-lab | 0 → 63 | 52 | 58 | 63 |
| coach-coffee | 0 → 12 | 8 | 3 | 12 |
| coffeenutz | 0 → 79 | 70 | 54 | 66 |
| nok-coffee | 0 → 16 | 13 | 8 | 14 |
| boxx | 0 → 5 | 5 | 5 | 5 |
| kimma | 0 → 13 | 11 | 12 | 13 |
| cup-of-joy | 0 → 9 | 9 | 8 | 9 |
| baristocrat | 0 → 6 | 2 | 3 | 6 |
| daphne | 0 → 7 | 6 | 0 | 0 |
| parsa | 0 → 12 | 12 | 12 | 11 |
| poka | 0 → 14 | 13 | 12 | 14 |
| molecule | 0 → 19 | 9 | 9 | 11 |

Across 281 discovered products, 280 now have at least one current inferred profile feature. Counts include hidden products; eligibility remains 232 public / 49 hidden. Missing fields remain missing.

The same browser check found duplicate Brazil/Brezilya-style origin options and English case-sensitive process labels. Exact country translations now produce one canonical selector value with a Turkish label, expand known country aliases in raw/feature SQL filters, and leave unrecognized strings unchanged. Origin filtering does not infer countries from regions, varieties or substrings. Metadata filters bind JSON arrays so combining 20 selected countries with other filters remains under the D1 parameter limit. Card `Washed` and `NATURAL` labels now use existing Turkish process labels without changing raw source values.

Validation: 51 scoped adapter, catalog, country-label, worker and compatibility tests pass; scraper TypeScript and focused ESLint pass. Application TypeScript was blocked by generated `.next/types/validator.ts` route exports during concurrent development; no build or type generation was run. The subsequent remote baseline and three-source cycle evidence at the top verifies refreshed staged profile data. This paragraph records the checks available at the time of the parser repair; final application build and browser acceptance are documented by the root task.
