# Product analytics and outbound referrals

Implemented P8 contract, 2026-09-15. Cloudflare Web Analytics handles normal site traffic separately. Workers Analytics Engine receives the constrained events below. Current staging dataset binding: `ANALYTICS` → `coffeedb_v2_staging`; root manages deployment configuration and the production dataset.

## Events and meaning

| Event | Producer | Meaning |
| --- | --- | --- |
| `coffee_detail_view` | Client → `/api/events` | A visible coffee detail was viewed; server resolves its known public coffee ID. |
| `feed_filter_change` | Client → `/api/events` | A filter selection changed; only filter names/count are recorded, never search text or selected values. |
| `newsletter_signup_submit` | Client → `/api/events` | A subscription submission was attempted. |
| `newsletter_signup_success` | Subscribe server | Kit accepted the request and the form association succeeded. Suppressed/honeypot/provider-failure outcomes do not emit it. |
| `outbound_roaster_click` | `/go/[offerId]` server | A permitted navigation request resolved to a known roaster offer. |
| `quiz_started` | Client → `/api/events` | The retained optional quiz was started. |
| `quiz_completed` | Client → `/api/events` | The four-step quiz reached its summary. No answers are recorded. |

These are event counts, not unique people, confirmed purchases, confirmed email subscribers, or exact-once accounting. Repeated accepted newsletter requests may belong to an existing subscriber; use Kit for confirmed subscriber growth. Client events can be fabricated or blocked by browsers. Redirect requests can be retried. Bot heuristics reduce noise without proving every recorded request was human. No future preference/save/like event is enabled by this contract.

## Client HTTP contract

`POST /api/events`, same-origin `application/json`, maximum 4,096 bytes including chunked bodies:

```json
{
  "event": "feed_filter_change",
  "page": "catalog",
  "source": "catalog",
  "filterKeys": ["origin", "taste"],
  "feedType": "NEW"
}
```

Allowed fields are exactly `event`, `page`, `source`, optional `coffeeId`, `filterKeys`, `feedType`. Unknown fields are rejected, rather than silently persisted. `coffee_detail_view` requires a known visible `coffeeId`; `feed_filter_change` requires a `filterKeys` array, which may be empty for a clear action. Client attempts to send `newsletter_signup_success` or `outbound_roaster_click` are rejected.

- Pages: `home`, `new`, `deals`, `catalog`, `coffee`, `roasters`, `roaster`, `quiz`, `guide`, `compare`, `other`.
- Sources: `home`, `home-hero`, `home-bottom`, `feed`, `catalog`, `detail`, `similar`, `roaster`, `compare`, `quiz`, `guide`, `navigation`, `unknown`.
- Filter keys: `origin`, `process`, `taste`, `roaster`, `priceMin`, `priceMax`, `search`, `farm`, `producer`, `variety`, `altitude`, `traceability`, `roast`, `brewMethod`, `sort`.
- Feed types: `NEW`, `PRICE_DROP`, `RESTOCKED`, `DEAL`.

Public responses have empty bodies and `Cache-Control: no-store`: 204 accepted or intentionally suppressed; 400 invalid schema/JSON; 403 wrong origin; 404 unknown/hidden coffee; 405 wrong method; 413 oversized body; 415 unsupported content type; 429 limited with `Retry-After: 60`; 503 unavailable binding/database. No submitted value is reflected in an error. No CORS permission is granted to another origin.

## Dataset schema v1

`emitProductEvent(env, event)` in `shared/v2/analytics.ts` validates a second time, constructs only these fixed columns, and catches sink exceptions. It never serializes a raw request or event object.

| Column | Value |
| --- | --- |
| `blob1` | `v1` |
| `blob2` | Event name |
| `blob3` | `production`, `staging`, or `local` |
| `blob4` | Page enum |
| `blob5` | Placement/source enum |
| `blob6` | Known roaster ID or empty |
| `blob7` | Known coffee ID or empty |
| `blob8` | Known offer ID or empty |
| `blob9` | Sorted unique filter names joined by `\|`, or empty |
| `blob10` | Feed enum or empty |
| `double1` | `1` (event count) |
| `double2` | Number of distinct filter names |
| `index1` | Roaster ID, otherwise event name; never a visitor identifier |

Cloudflare supplies the event timestamp. Its `writeDataPoint()` returns immediately and the runtime performs the write in the background; it is not awaited. Dataset positions must remain stable. [Official write API](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)

Current documented limits are 20 blobs, 20 doubles and one index per point, with a 96-byte index limit and three-month retention. This schema remains well below those limits. [Official limits and retention](https://developers.cloudflare.com/analytics/analytics-engine/limits/)

## Privacy boundary

No email, subscriber ID, session ID, cookie ID, IP address, user agent, fingerprint, free-text search, quiz answer, full URL, URL query, or raw referrer is written to Analytics Engine. Product IDs identify catalog records, not people. No client-generated persistent analytics identifier or cookie is introduced.

Request headers are used transiently for same-origin validation, prefetch/bot detection, and rate limiting. A same-origin outbound referrer's pathname may map `/yeni` to `new` or `/firsatlar` to `deals`; the URL and query are discarded. Server subscription telemetry receives only enum placement/page after provider success, never email or referral metadata. Application-level analytics errors do not log request bodies.

Cloudflare infrastructure still processes normal HTTP metadata; this application contract does not claim otherwise. Root owns public privacy disclosure, Web Analytics configuration, and observability settings.

## Trusted outbound route

All V2 purchase CTAs use `/go/<known offer ID>?source=<enum>`. Optional `event=<feed enum>` supplies a bounded feed context when a same-origin page referrer is absent. Client parameters named `url`, `next`, `redirect`, or `utm_*` never determine the destination or referral tags.

The route joins offers → coffees → roasters and requires a current, non-retired offer, public coffee and active roaster. It deliberately does **not** use the stock-filtered catalog view: a current offer on a durable out-of-stock coffee page remains navigable. Unknown stock is also navigable. Hidden coffees, retired offers and inactive roasters return 404.

The destination comes only from the stored purchase URL and must be HTTPS, without embedded credentials or non-default ports, on an exact hostname in the roaster's `trusted_hosts_json`. Subdomain suffix matching and inference from the apex domain are prohibited. The implementation retains explicitly migrated shop/www hosts. Read-only local audit at P8 preparation covered 1,265 stored offers: all HTTPS, zero custom ports, zero allowlist mismatches; alternate purchase hosts were `www.kronotrop.com.tr` and `shop.kimmacoffee.com`.

SKU/variant/option query parameters are preserved. Previous tracking parameters and fragments are stripped. Server configuration supplies `utm_source` (default `kahvedrop`), `utm_medium=referral`, and enum `utm_content` when known. Incoming arbitrary UTM values are ignored. The response is an immediate 302 with `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`; no store checkout, purchase, or form submission is performed.

Analytics binding failure, write exceptions, missing limiter or rate suppression cannot block an otherwise valid redirect. Database failure returns 503 rather than guessing a destination. Root owns retirement of the old unused BuyButton/direct-beacon implementation and legacy `/api/click` writes.

## Abuse and prefetch handling

`EVENT_LIMITER` is configured for 60 calls per 60 seconds, with separate `events:` and `outbound:` key prefixes. Only Cloudflare's boundary-supplied `CF-Connecting-IP` is used for transient limiting; `X-Forwarded-For` is ignored. Missing/invalid local IP values share an `unknown` bucket. Shared addresses can share a budget; this is a conservative abuse control, not a person counter.

The binding's counters are local to a Cloudflare location and eventually consistent. It is not a globally exact quota. Event intake fails closed when the limiter is unavailable; outbound navigation continues but skips recording. [Official rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

HEAD requests never record. Prefetch/prerender headers, Next prefetch headers, known bot user-agent patterns, and available Cloudflare verified-bot/very-low-score signals suppress recording. Outbound fetch probes with a non-navigation `Sec-Fetch-Mode` also skip recording. Valid destination requests still receive the redirect. Ordinary `<a>` purchase CTAs do not cause framework link-prefetch clicks.

## Queries and verification

Example sampled event totals; use the dataset for the intended deployment stage:

```sql
SELECT blob2 AS event, SUM(_sample_interval * double1) AS events
FROM coffeedb_v2_staging
WHERE timestamp >= NOW() - INTERVAL '7' DAY AND blob3 = 'staging'
GROUP BY event
ORDER BY events DESC
```

```sql
SELECT blob6 AS roaster_id, blob7 AS coffee_id,
       SUM(_sample_interval * double1) AS outbound_clicks
FROM coffeedb_v2_staging
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob2 = 'outbound_roaster_click' AND blob3 = 'staging'
GROUP BY roaster_id, coffee_id
ORDER BY outbound_clicks DESC
```

The weighting accounts for Analytics Engine sampling; an unweighted row count may undercount. [Official sampling query example](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)

Local implementation checks: `tests/v2-analytics.test.ts` and `tests/v2-outbound.test.ts` execute actual SQL against SQLite and cover fixed dimensions, known public IDs including out-of-stock records, forged server events, free-text/PII rejection, origin/body limits, limiter/sink failure, bot/prefetch/HEAD suppression, malicious destinations, exact migrated host variants, SKU preservation, fixed UTMs, and valid navigation during analytics failures. These use injected Analytics Engine and limiter bindings; successful local HTTP responses do not prove remote dataset ingestion. Root coordinates actual browser wiring and remote dataset verification before claiming those integrations verified.
