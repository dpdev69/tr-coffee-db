# P9 — deployed HTTP verification

Verified 2026-09-15 against `https://coffeedb-v2-web-staging.hellobasalt.workers.dev`. These are actual deployed responses, not source inspection or mocked handler tests. No signup was submitted; outbound routes were requested with HEAD only, and redirects were not followed. No credentials, email addresses, cookies or visitor identifiers are retained here.

## Method

Initial Python `urllib.request` requests returned HTTP 403 with `error code: 1010` before the application response. Standard curl, with its default headers and no custom user agent, then reached the deployment successfully. The successful curl results below supersede that client-specific inability to inspect the application. No access-control configuration was changed.

Requests used these exact command forms, with each tested path substituted from the tables below:

```sh
curl --silent --show-error --max-time 40 --include 'https://coffeedb-v2-web-staging.hellobasalt.workers.dev/PATH'
curl --silent --show-error --max-time 35 --include --head 'https://coffeedb-v2-web-staging.hellobasalt.workers.dev/go/OFFER_AND_QUERY'
```

The robots request was initially captured with:

```sh
curl --silent --show-error --max-time 35 --dump-header /tmp/v2-audit-robots-headers.txt https://coffeedb-v2-web-staging.hellobasalt.workers.dev/robots.txt
```

Independent requests were orchestrated through Python `subprocess.check_output` and a bounded thread pool, still executing standard curl. No `--location`, custom user-agent, authorization or cookie option was supplied. Response parsing extracted the HTTP status, selected headers, canonical link and robots meta; sitemap counts were computed from `<loc>` elements.

## Pages and metadata

Every row below returned **HTTP/2 200** and `<meta name="robots" content="noindex, nofollow">`. Canonical values were absolute URLs on the staging origin.

| Request path | Canonical path |
|---|---|
| `/` | Staging origin, without trailing slash |
| `/kahveler` | `/kahveler` |
| `/yeni` | `/yeni` |
| `/firsatlar` | `/firsatlar` |
| `/kavurucular` | `/kavurucular` |
| `/kahve/vietnam-minh-duy-yikanmis-anaerobik-8d3c356e8d08` | Same path |
| `/kavurucu/petra` | Same path |

The two sampled detail responses also contained:

```text
Cache-Control: no-store, must-revalidate
Referrer-Policy: strict-origin-when-cross-origin
```

No `X-Robots-Tag` response header was present on these HTML pages; the observed indexing control was the HTML robots meta and the robots file below.

## Robots and sitemap

`GET /robots.txt` returned **HTTP/2 200** with:

```text
User-Agent: *
Disallow: /

Host: https://coffeedb-v2-web-staging.hellobasalt.workers.dev
Sitemap: https://coffeedb-v2-web-staging.hellobasalt.workers.dev/sitemap.xml
```

`GET /sitemap.xml` returned **HTTP/2 200**. Parsing its locations found:

- **789 total URLs**: 741 coffee detail routes, 39 roaster routes and 9 static routes.
- Exactly one hostname: `coffeedb-v2-web-staging.hellobasalt.workers.dev`.
- The **741 durable public coffee detail URLs** include coffees without currently available offers. They are not the current available catalog count of **481 coffees** recorded in the separate staging reconciliation.
- The **39 active roaster URLs** include active roasters without currently available catalog coffees. They are not the **38 roasters** represented in the current available catalog.

The sitemap implementation intentionally queries public coffee identities and active roasters rather than the stock-filtered catalog view. The 481/38 available counts are contextual reconciliation evidence supplied by the main staging checks, not counts independently derived by this HTTP metadata probe.

## Legacy redirects

All requests below returned **HTTP/2 308**, without following the response Location.

| Request | Exact Location |
|---|---|
| `/coffees?flavorCategory=Fruity&roastLevel=light&roaster=petra&roaster=parsa&brewMethod=filter` | `/kahveler?taste=Fruity&roast=light&roaster=petra&roaster=parsa&brewMethod=filter` |
| `/roasters` | `/kavurucular` |
| `/coffees/vietnam-minh-duy-yikanmis-anaerobik-8d3c356e8d08` | `/kahve/vietnam-minh-duy-yikanmis-anaerobik-8d3c356e8d08` |
| `/roasters/petra` | `/kavurucu/petra` |

The sampled detail redirects contained `Cache-Control: no-store, must-revalidate`. The catalog redirect preserved repeated roaster parameters and brew method while mapping the two legacy filter names.

## Outbound HEAD checks

1. `HEAD /go/not-a-known-offer?url=https%3A%2F%2Fevil.example` returned **HTTP/2 404**, no Location, and `X-Robots-Tag: noindex, nofollow`.
2. `HEAD /go/offer_0000000000000000000000000000000000000000000000000000000000000000` returned **HTTP/2 404**, no Location, `Cache-Control: no-store, must-revalidate`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`.
3. The following known-offer request returned **HTTP/2 302**:

```text
HEAD /go/offer_5516151419efa17105548f60290f28f4acadfd0f50e531ae53434e3def926798?source=catalog&url=https%3A%2F%2Fevil.example&redirect=https%3A%2F%2Fevil.example&utm_source=attacker&utm_medium=bad
```

Sanitized relevant response headers:

```text
Location: https://spadacoffee.com/vietnam-minh-duy-yikanmis-anaerobik?utm_source=kahvedrop&utm_medium=referral&utm_content=catalog
Cache-Control: no-store, must-revalidate
X-Robots-Tag: noindex, nofollow
Referrer-Policy: no-referrer
```

The arbitrary destination and UTM parameters did not control the redirect. The known offer was obtained from the actual `/kahveler` HTML. No external destination was requested or purchase attempted.

## Limits

These requests establish deployed HTTP behavior for the listed routes and cases. HEAD is explicitly excluded from product-event recording by the current handler; this probe does not establish Analytics Engine receipt or human click counts. Remote browser interaction, persisted analytics, confirmed Kit signup and crawl reconciliation have their own evidence. The sampled page canonicals do not constitute an exhaustive metadata audit of every detail URL.
