# P9 live integration evidence

Verified 2026-09-14 at approximately 22:00–22:06 UTC (2026-09-15 in Istanbul), against https://coffeedb-v2-web-staging.hellobasalt.workers.dev. Native Safari, real Cloudflare Worker/D1/Analytics Engine and Kit. No production cutover or purchase.

## Newsletter and roaster destination

After the owner received and confirmed the earlier authorized test, a read-only Kit lookup returned active. The same existing confirmed address was submitted once through the deployed staging hero form. The UI moved through pending to success with the optional quiz link. The address and credential are deliberately excluded from project evidence. This staging submission verifies the deployed secret and accepted association; it is not a second new confirmed subscriber. No broadcast was sent.

On the deployed Guatemala Las Penas detail page, clicking the first actual offer link navigated through `/go/offer_2233339c94ec331e662364d8facec70e2ba5c64587799469e285e0237d38b330?source=detail` to Petra's product page. Safari showed the selected 250 g standard package at 870 TL, matching staging. The destination preserved `variant=44444451438732` and used `utm_source=kahvedrop&utm_medium=referral&utm_content=detail`. No cart or checkout action occurred.

## Persisted product events

Authenticated Cloudflare Analytics Engine Studio executed this read-only query against the real dataset:

```sql
SELECT blob2 AS event, blob3 AS stage, SUM(_sample_interval) AS count
FROM coffeedb_v2_staging
WHERE timestamp > NOW() - INTERVAL '1' DAY
GROUP BY event, stage
ORDER BY event
```

| Event | Environment | Sample-weighted count |
| --- | --- | ---: |
| coffee_detail_view | staging | 2 |
| feed_filter_change | staging | 3 |
| newsletter_signup_submit | staging | 1 |
| newsletter_signup_success | staging | 1 |
| outbound_roaster_click | staging | 1 |
| quiz_completed | staging | 1 |
| quiz_started | staging | 1 |

All seven event types were visible in Studio's result table. The first query did not yet contain the outbound event; a later query included it without another click or code change. This was ingestion delay, not a demonstrated handler failure. The three filter events establish remote persistence despite WebKit reporting cancelled responses during form navigation. These are QA events, not audience demand or unique-user counts. Signup success means an accepted provider request, not confirmation or uniqueness.

The connector SQL wrapper reported an error for HTTP 200 because this endpoint returns a nonstandard result envelope; no result was inferred from that status. The evidence above comes from the actual Studio table in Safari.

## Separate Web Analytics limitation

The host-specific Cloudflare Web Analytics script is configured and rendered. This computer resolves `static.cloudflareinsights.com` to `0.0.0.0`; both browser loading and ordinary curl fail. The DNS filter remains intact. Script execution and traffic-beacon receipt require a separate check on a device/network that permits the service. Product events above use the first-party endpoint and are independently verified.

See [remote browser QA](p9-web-browser.md), [queue cycles](p9-queue-cycles.md), [14-source baselines](p9-qualified-baselines.md), and [acceptance matrix](../staging-acceptance.md).
