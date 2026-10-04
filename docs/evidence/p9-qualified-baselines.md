# P9: remaining qualified staging baselines

Verified 2026-09-14T21:52:49.942Z against remote D1 `coffeedb-v2-staging`. Exactly 11 jobs were accepted at 2026-09-14T21:50:48.330Z, one per remaining reviewed source. All completed successfully on their first queue attempt, using `baseline` and `v2-source-3-profile`. No source or application code changed.

## Outcome

- 254 source products and 1,051 source offers observed in real fresh requests. Observations increased from 1,735 to 2,786 (+1,051); events and crawl errors remained zero. No duplicate `(crawl_run_id, offer_id)` observations.
- Current public available catalog: 480 → 481 coffees, 38 → 38 roasters, 682 → 1,170 offers. This exactly matches the corrected 14-source offline reconciliation.
- All 1,030 existing coffee IDs remain present, with zero visibility transitions. The sole availability transition is the reviewed CoffeeNutz Kolombiya La Sirena Honey Peach: source SKU `67409137041712` is in stock at TRY 980 / 250g while sibling `50077231776048` remains out of stock. The legacy synthetic unavailable offer is retired; its history remains.
- For every source, normalized product-ID/visibility, offer identity/price/compare-at price/currency/weight/stock and complete feature/provenance tuples match the reviewed offline capture signatures. No detected identity, price, weight, stock, eligibility or profile differences. These are separate capture times, not a same-time legacy crawl.
- 1,534 feature rows restored/retained for these 254 products, including their 254 eligibility rows. All compared source profile values preserve the reviewed inferred provenance, version, null confidence and source reference.
- All 1,051 newly observed offers have known prices and stock. 1002 have known weight. Unknowns remain null.
- Across the full current public available catalog, 1,166/1,170 offers have known price, 1,042/1,170 have known weight, and all 1,170 have TRY currency. Remaining imported unknowns are not invented.
- Immutable archive remains 13,452 rows. Main queue and DLQ both report zero backlog/bytes. `CRAWL_MODE=baseline` and `CRAWLS_ENABLED=false` remain unchanged; consumer concurrency stays at the existing configuration.

## Per-source result

Available columns below count current in-stock public offers among this crawl’s observations. Unknown weights are deliberately retained and cannot support per-weight price comparisons.

| Source | Products | Offers | Public available offers | Available unknown weight | Available known weights (g) | Completed UTC |
|---|---:|---:|---:|---:|---|---|
| aroasting-lab | 63 | 63 | 41 | 0 | 50,250,1000 | 21:50:51.399Z |
| baristocrat | 6 | 7 | 4 | 0 | 250 | 21:51:03.161Z |
| boxx | 5 | 57 | 57 | 0 | 250,1000 | 21:51:07.155Z |
| coach-coffee | 12 | 216 | 54 | 0 | 250,1000 | 21:51:11.495Z |
| coffeenutz | 80 | 183 | 10 | 0 | 250 | 21:51:11.856Z |
| cup-of-joy | 9 | 72 | 54 | 9 | 250 | 21:51:15.605Z |
| kimma | 13 | 132 | 114 | 7 | 100,250,1000 | 21:51:16.248Z |
| molecule | 19 | 27 | 27 | 10 | 200,1000 | 21:51:56.661Z |
| montag | 17 | 244 | 220 | 0 | 150,250,300,1000 | 21:51:19.802Z |
| nok-coffee | 16 | 18 | 11 | 0 | 1000,10000 | 21:51:24.444Z |
| poka | 14 | 32 | 30 | 0 | 250,500,1000 | 21:51:44.300Z |

All sources succeeded; no automatic failure retry or DLQ path was exercised, and no manual retries were added. Only these 11 baseline jobs were submitted. The earlier Petra/Daphne/Parsa cycles are documented separately in [p9-queue-cycles.md](p9-queue-cycles.md). No unqualified source ran, no expanded LIVE cycle ran, and cron remains disabled.

## Evidence and limits

[Aggregate machine-readable evidence](p9-qualified-baselines.json) includes actual run times, before/after counts, availability change, per-source tuple signatures, comparisons, queue metrics and settings. Local inputs are `.local/v2/crawls/qualification.json`, its referenced reviewed captures, `.local/v2/p9-qualified-offline.json`, `.local/v2/p9-qualified-remote.json`, and `.local/v2/p9-qualified-final-checks.json`. Comparison signatures use count-checked, canonical sorted tuples and 64-bit FNV-1a for compact non-security regression checks; source-reference trailing slashes are normalized. No PII or credentials are included.

This verifies one remote baseline per additional qualified source. It does not prove repeated long-term crawling, actual positive price/stock-change event generation, or remote failure/retry handling. The three earlier sources separately passed an unchanged LIVE cycle.
