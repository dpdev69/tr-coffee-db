# V2 staging acceptance

Updated 2026-09-15 Istanbul. [Review staging](https://coffeedb-v2-web-staging.hellobasalt.workers.dev). Implementation and current checks are below; production cutover is not approved. No domain has been purchased.

| # | Acceptance criterion | Evidence / scope |
| --- | --- | --- |
| 1 | Canonical counts agree | Remote D1 and browser: 481 available coffees / 38 roasters / 1,170 available offers. [Browser](evidence/p9-web-browser.md), [data](evidence/p9-qualified-baselines.md). |
| 2 | Unknown weight has no fake unit price | Real SQLite/model/display tests preserve null weight/unit price. Current available offers include 128 unknown weights and four unknown prices. |
| 3 | Failed crawls cannot mass-hide stock | Atomic ingestion and partial/failure tests pass; failure mutates health only. Remote failure/DLQ injection was not performed. |
| 4 | Price drops refer to same offer history | Identity/weight/currency/prior-price tests pass. Real unchanged live cycle generated zero events; a remote positive price drop was not forced. |
| 5 | No duplicate active offers | Constraints, replay tests and remote duplicate audit pass; duplicate queue job added no observations. |
| 6 | Per-roaster crawl health | Fourteen qualified sources completed real baselines, zero errors. Three repeated baseline/live cycles passed. Other 25 legacy sources remain paused. [Health](crawler-health.md). |
| 7 | D1 reconciles with Supabase | All 1,030 source identities and 13,452 archives retained; 2,786 total observations. Guarded visibility repair and expected SKU availability difference reviewed. [Data quality](data-quality.md). |
| 8 | Old/new crawlers compared | Same-capture comparison across 14 qualified sources. [Comparison](crawler-comparison.md). |
| 9 | Significant differences reviewed | Eligibility, SKU stock, unknown weights and inferred profiles reviewed. Profile refresh preserves manual data and does not invent history. |
| 10 | Cloudflare staging works | Web and crawler deployed; real remote browser/data/queue checks pass. Cron is disabled and mode restored to baseline. [Deployment](cloudflare-deployment.md). |
| 11 | Kit signup end to end | Owner received and confirmed; read-only state active. Deployed form also succeeded with existing confirmed address. [Kit](evidence/p7-kit.md), [integration](evidence/p9-integration.md). |
| 12 | No email leakage | Server-only provider flow; strict telemetry allowlist and redaction tests. Built-output scan found zero actual key copies; generated local credential file removed by build cleanup. |
| 13 | Outbound clicks measurable | Actual Safari click and all seven product event types persisted in Analytics Engine Studio. Separate CWA traffic beacon remains unverified due local DNS filter. [Receipt table](evidence/p9-integration.md). |
| 14 | No open redirect | Trusted stored host/HTTPS validation and attack tests pass. Deployed HEAD ignores attacker destination and UTM parameters; missing offer404. [HTTP](evidence/p9-http.md). |
| 15 | Purchase ends at roaster | Actual Safari opened Petra's selected 250 g / 870 TL variant with controlled referral tags. No purchase occurred. |
| 16 | Core mobile experience | Actual 390 px browser checks on home, filters/empty state, expanded detail and quiz; no horizontal overflow. Touch controls measured 44 px. [Browser](evidence/p9-web-browser.md). |
| 17 | Canonical metadata | Remote pages200, correct staging canonical/noindex; robots disallow; sitemap789 same-host URLs; legacy308 and query preservation. [HTTP](evidence/p9-http.md). |
| 18 | Rollback exists | Legacy deployment/database/scheduler retained; immutable archives and export retained. Full production backup/final sync are cutover steps, not performed. [Runbook](cutover-runbook.md). |
| 19 | Features separate from source/user data | Versioned provenance, raw archives and manual survival/rejection tests pass. No persistent user taste data introduced. [Roadmap](personalization-roadmap.md). |
| 20 | Retained utilities work | Real quiz→filtered catalog, two-coffee compare/removal, calculator error/recovery and keyboard navigation pass. [Utilities](evidence/p6-utilities.md). |

## Verification and limitations

284 tests passed with zero failures/skips. Full ESLint, Next route typecheck, scraper typecheck, Next production build and Cloudflare web build passed using Node 22.23.2. The deployed artifact was exercised in WebKit and native Safari. Remote CI has not run because the branch has not been pushed.

Staging catalog counts reflect availability; the sitemap includes 741 durable public coffee pages and 39 active roaster pages, including pages with no current available offer. This difference is intentional.

Cloudflare Web Analytics is configured for the exact staging hostname, but this computer resolves its script host to 0.0.0.0. Leave that filter intact and verify traffic-beacon receipt from another suitable device/network. All seven first-party product events are independently verified. Rapid queue checks do not establish scheduled 18-hour reliability, and only 14 adapters are qualified. No full performance/accessibility audit or genuine acquisition/retention study is claimed.

## Remaining launch decisions

Choose an owned brand/domain and complete branded sender/privacy review. Then obtain explicit production cutover approval against this evidence and the runbook. Full backup, final source synchronization, production deployment/DNS, scheduled stability checks and any later legacy retirement are separate steps. Growth experiments are prepared in [growth plan](growth-plan.md); no outreach has been sent. Personalization remains deferred until user evidence warrants it.
