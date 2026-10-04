# P9 — real staging queue cycles

Verified 2026-09-14 21:45:53 UTC. This is remote D1 and Cloudflare Queues evidence, not a local replay or a simulated clock. Only Petra, Daphne and Parsa were enqueued. Legacy production was untouched.

## Observed starting state

Remote D1 already contained three successful first baselines completed between 2026-09-14 21:15:54.976Z and 21:16:19.044Z, with parser `v2-source-2-eligibility`: Petra 8 products/198 offers, Daphne 7/15, Parsa 12/22. There were 1,265 price observations, zero events, zero crawl errors, and a current catalog of 480 coffees / 38 roasters / 682 available offers. Both primary and dead-letter queue backlogs were zero. Therefore the earlier queue-delivery blocker is superseded by successful delivery evidence for these three sources.

The crawler code deployed before these checks was version `92c0f8c0-18eb-44c4-b47a-98184f7bc553`, parser `v2-source-3-profile`, with the reviewed source allowlist and manual-feature guards. Scheduling was disabled throughout.

## Two new real cycles

Cycle 2 was submitted at **2026-09-14T21:41:29.391Z**, in baseline mode. Its four messages contained the three sources plus an exact duplicate Petra job with the same roaster ID and scheduled timestamp. The API accepted four messages; D1 recorded exactly three successful jobs and 235 new offer observations. The duplicate created no extra persisted run/history. This proves persistence idempotence; source HTTP request counts were not independently measured.

After those jobs completed and both queues were empty, the crawler's existing `CRAWL_MODE` binding was temporarily changed to `live`, preserving every other binding and `CRAWLS_ENABLED=false`. Cycle 3 was submitted at **2026-09-14T21:42:54.729Z**, with three messages. All new times came from the API/Worker clocks during actual public-source fetching; no historical capture was reingested under an invented observation time.

| Mode | Source | Worker started (UTC) | Worker completed (UTC) | Products | Offers | Result |
|---|---|---|---|---:|---:|---|
| baseline | petra | 2026-09-14T21:41:31.439Z | 2026-09-14T21:41:33.142Z | 8 | 198 | success |
| baseline | daphne | 2026-09-14T21:41:36.319Z | 2026-09-14T21:41:46.496Z | 7 | 15 | success |
| baseline | parsa | 2026-09-14T21:41:46.270Z | 2026-09-14T21:41:54.804Z | 12 | 22 | success |
| live | petra | 2026-09-14T21:42:56.963Z | 2026-09-14T21:42:58.073Z | 8 | 198 | success |
| live | daphne | 2026-09-14T21:43:01.818Z | 2026-09-14T21:43:11.464Z | 7 | 15 | success |
| live | parsa | 2026-09-14T21:43:11.880Z | 2026-09-14T21:43:19.760Z | 12 | 22 | success |

## D1 reconciliation

- Observations: **1,265 → 1,500 → 1,735**, exactly +235 per new cycle, including all **1,030 import observations**.
- Successful non-import runs: **6 baseline + 3 live**. No failed/partial runs or crawl errors in this check.
- Latest live versus preceding baseline: **235 matching offers**, with **zero price, compare-at price, weight, currency, or stock changes** across Petra 198, Daphne 15 and Parsa 22.
- Discovery events: **0** after both cycles. An unchanged live observation did not produce a false new/deal/drop/restock/sold-out event.
- Duplicate `(crawl_run_id, offer_id)` observations: **0**.
- Current catalog remains **480 coffees / 38 roasters / 682 available offers**. Archive row count remains **13,452**.
- Current profiles restored on **all 27 products**: Petra 28 inferred feature rows, Daphne 14, Parsa 56; **98 profile features** total, separate from the 27 eligibility features. Every profile has version `v2-profile-1`, null confidence, and a non-null source reference matching the product URL after canonicalization. Daphne's 14 references retain only a trailing slash that the stored canonical URL removes.

## Final state and limits

The final API checks reported **primary queue backlog 0 and dead-letter queue backlog 0**, including zero backlog bytes. Queue metrics are best-effort distributed counters; the successful D1 runs and exact observation reconciliation are the persistence evidence.

The crawler mode was restored and read back as **`CRAWL_MODE=baseline` and `CRAWLS_ENABLED=false`**. No broader schedule was enabled, no other source was queued, and no source code changed for this validation.

These rapid repeated cycles prove real queue delivery, successful fetching/parsing/reconciliation, profile restoration, unchanged-state event suppression, and duplicate-job persistence safety for three sources. They do not prove long-duration scheduling reliability, remote failure/retry/dead-letter behavior, or live event emission on actual price/stock changes; no source changes were manufactured to exercise those cases. The other 11 qualified adapters retain their captured-source qualification rather than this remote repeated-cycle evidence.

Machine-readable aggregate results, run IDs, submission payloads, and the final settings read-back are in [p9-queue-cycles.json](p9-queue-cycles.json). No subscriber data, credentials, or visitor identifiers are included.

