# Crawler health

## Current staging verification — 2026-09-14 UTC

Remote D1 and Cloudflare Queues were checked at **21:52:49 UTC**. All **14 qualified sources** completed real staging baselines successfully. Petra, Daphne and Parsa additionally completed a second baseline and an unchanged LIVE cycle; the other 11 completed one baseline each. These checks produced 20 successful non-import runs with **2,786 total observations** (including 1,030 imported observations), **zero events** and **zero crawl errors**. One duplicate Petra queue message produced no duplicate persisted run or observations.

The current public available catalog is **481 coffees / 38 roasters / 1,170 offers**. The broader catalog still includes imported records from sources without a qualified V2 adapter; 38 visible roasters does not mean 38 verified crawlers. The 14-source allowlist is enforced by the scheduler and queue consumer. The remaining **25 active, unqualified sources remain paused**, and `CRAWLS_ENABLED=false` keeps cron disabled for every source. No expanded LIVE schedule was enabled. Main queue and DLQ backlogs were both zero at verification.

All 14 baselines match the reviewed eligibility and profile policy. The additional 11 matched their reviewed product identities and offer price, weight, stock and profile signatures. No existing coffee visibility changed; the only availability increase is the reviewed CoffeeNutz SKU that the flattened legacy row missed. Evidence: [three-source queue cycles](evidence/p9-queue-cycles.md), [remaining qualified baselines](evidence/p9-qualified-baselines.md), and [data quality](data-quality.md).

These are bounded staging successes, not a long-term success-rate estimate. Repeated crawling is demonstrated only for Petra, Daphne and Parsa. Actual positive price/stock events, remote failure/retry/DLQ behavior, and the 25 unqualified sources remain unverified. Unknown source fields remain unknown.

## Historical legacy audit — export at 20:34:32 UTC

Source export completed **2026-09-14T20:34:32.201Z**. This report summarizes persisted Supabase scrape logs; it does not claim a fresh probe of every storefront. Reproduce using `npx tsx scripts/v2-quality.ts --source .local/v2/source.json --write-reports`.

## Observed execution rates

| Window | Logged runs | Success | Failed | Success rate |
| --- | ---: | ---: | ---: | --- |
| Last 7 days | 125 | 111 | 14 | 88.8% |
| Last 30 days | 1100 | 235 | 865 | 21.4% |
| All exported logs | 4041 | 1697 | 2344 | 42.0% |

Success rate uses all logged attempts as denominator, including any nonterminal statuses; absent logs are not counted as failures or successes. A stale schedule can have perfect historical success while providing no current data.

## Adapter errors (all exported history)

| Legacy platform | Roasters | Logged attempts | Failed | Error percentage |
| --- | ---: | ---: | ---: | --- |
| custom | 8 | 708 | 446 | 63.0% |
| ikas | 12 | 1040 | 616 | 59.2% |
| shopify | 12 | 1179 | 638 | 54.1% |
| woocommerce | 11 | 1113 | 643 | 57.8% |

“Platform” is the stored legacy roaster category, not necessarily the exact current adapter implementation or parser version. Error means logged status `failed`; no parser version or stage-specific error table existed.

## Last source activity by roaster

| Roaster | Active | Platform | Last attempt | Last successful completion | Last status |
| --- | --- | --- | --- | --- | --- |
| a4-kahve | Yes | ikas | 2026-09-13T08:06:46.664+00:00 | 2026-09-13T08:06:48.429+00:00 | success |
| aroasting-lab | Yes | shopify | 2026-09-13T08:02:09.126+00:00 | 2026-09-13T08:02:15.189+00:00 | success |
| baristocrat | Yes | woocommerce | 2026-09-13T08:02:51.281+00:00 | 2026-09-13T08:02:53.313+00:00 | success |
| boxx | Yes | shopify | 2026-09-13T08:02:35.503+00:00 | 2026-09-13T08:02:39.138+00:00 | success |
| caffe-di-toee | No | ikas | No log | No success log | Unknown |
| calibre | Yes | ikas | 2026-09-13T08:06:44.556+00:00 | 2026-09-13T08:06:46.479+00:00 | success |
| cho-coffee | Yes | custom | 2026-09-13T08:12:12.764+00:00 | 2026-09-13T08:12:23.473+00:00 | success |
| coach-coffee | Yes | shopify | 2026-09-13T08:02:15.408+00:00 | 2026-09-13T08:02:20.606+00:00 | success |
| coffee-department | Yes | custom | 2026-09-13T08:08:13.992+00:00 | 2026-09-13T08:08:29.478+00:00 | success |
| coffee-friendzone | Yes | woocommerce | 2026-09-13T08:02:53.504+00:00 | 2026-09-13T08:04:05.011+00:00 | success |
| coffee-sapiens | No | shopify | 2026-04-06T10:00:58.327+00:00 | 2026-04-06T10:01:01.479+00:00 | success |
| coffeemamma | Yes | woocommerce | 2026-09-13T08:04:05.644+00:00 | 2026-09-13T08:04:16.479+00:00 | success |
| coffeenutz | Yes | shopify | 2026-09-13T08:02:20.815+00:00 | 2026-09-13T08:02:26.296+00:00 | success |
| coffeerem | Yes | custom | 2026-09-13T08:08:13.081+00:00 | 2026-07-12T21:15:07.686+00:00 | failed |
| cup-of-joy | Yes | shopify | 2026-09-13T08:02:47.515+00:00 | 2026-09-13T08:02:51.094+00:00 | success |
| daphne | Yes | woocommerce | 2026-09-13T08:04:16.706+00:00 | 2026-09-13T08:04:19.217+00:00 | success |
| gourme | Yes | ikas | 2026-09-13T08:06:31.486+00:00 | 2026-09-13T08:06:33.261+00:00 | success |
| grizzly | No | custom | No log | No success log | Unknown |
| homestead | Yes | shopify | 2026-09-13T08:02:26.494+00:00 | 2026-09-13T08:02:30.248+00:00 | success |
| hound | Yes | ikas | 2026-09-13T08:06:33.462+00:00 | 2026-09-13T08:06:40.97+00:00 | success |
| kafeinkultur | Yes | custom | 2026-09-13T08:07:09.406+00:00 | 2026-09-13T08:08:09.039+00:00 | success |
| kernel | Yes | ikas | 2026-09-13T08:06:41.158+00:00 | 2026-09-13T08:06:42.472+00:00 | success |
| kimma | Yes | shopify | 2026-09-13T08:02:43.621+00:00 | 2026-09-13T08:02:47.323+00:00 | success |
| kronotrop | Yes | custom | 2026-09-13T08:06:50.613+00:00 | 2026-09-13T08:07:05.12+00:00 | success |
| milestones | Yes | custom | 2026-09-13T08:10:20.597+00:00 | 2026-09-13T08:12:12.465+00:00 | success |
| molecule | Yes | woocommerce | 2026-09-13T08:05:11.964+00:00 | 2026-09-13T08:06:14.164+00:00 | success |
| montag | Yes | shopify | 2026-09-13T08:01:55.431+00:00 | 2026-09-13T08:02:00.648+00:00 | success |
| nok-coffee | Yes | shopify | 2026-09-13T08:02:30.434+00:00 | 2026-09-13T08:02:35.31+00:00 | success |
| null-coffee | Yes | shopify | 2026-09-13T08:02:39.315+00:00 | 2026-09-13T08:02:43.444+00:00 | success |
| old-java | Yes | woocommerce | 2026-09-13T08:04:19.406+00:00 | 2026-09-13T08:04:48.682+00:00 | success |
| ordinarius | Yes | woocommerce | 2026-09-13T08:04:48.988+00:00 | 2026-09-13T08:04:58.582+00:00 | success |
| orkun-ustel | Yes | ikas | 2026-09-13T08:06:42.658+00:00 | 2026-09-13T08:06:44.388+00:00 | success |
| paper | Yes | ikas | 2026-09-13T08:06:20.894+00:00 | 2026-09-13T08:06:24.412+00:00 | success |
| parsa | Yes | woocommerce | 2026-09-13T08:04:58.909+00:00 | 2026-09-13T08:05:05.598+00:00 | success |
| petra | Yes | shopify | 2026-09-13T08:01:46.561+00:00 | 2026-09-13T08:01:54.593+00:00 | success |
| poka | Yes | woocommerce | 2026-09-13T08:05:06.18+00:00 | 2026-09-13T08:05:08.806+00:00 | success |
| probador | Yes | custom | 2026-09-13T08:07:05.536+00:00 | 2026-09-13T08:07:09.207+00:00 | success |
| sezy | Yes | woocommerce | 2026-09-13T08:05:11.527+00:00 | 2026-09-09T07:57:42.478+00:00 | failed |
| spada | Yes | ikas | 2026-09-13T08:06:29.116+00:00 | 2026-09-13T08:06:31.301+00:00 | success |
| story | Yes | ikas | 2026-09-13T08:06:24.604+00:00 | 2026-09-13T08:06:28.585+00:00 | success |
| tetra-n | Yes | ikas | 2026-09-13T08:06:48.631+00:00 | 2026-09-13T08:06:50.418+00:00 | success |
| ultra | No | ikas | 2026-05-21T09:27:02.147+00:00 | No success log | failed |
| williams | Yes | woocommerce | 2026-09-13T08:06:14.428+00:00 | 2026-09-13T08:06:20.272+00:00 | success |

## Historical audit findings and remaining gate

- At the legacy export timestamp, 2 active roasters have no successful recorded crawl inside the current 3-day freshness window. Investigate scheduler execution separately from parser failures.
- V2 must distinguish attempted, failed, successful, absent-on-success and explicitly unavailable states. Failed or missing log evidence must never synthesize out-of-stock transitions.
- The subsequent staging comparisons above satisfy the bounded baseline gate for 14 sources. They do not establish complete coverage or continued health for all 39 active sources. Failed or partial sources must preserve current rows and remain outside the allowlist until independently qualified.
