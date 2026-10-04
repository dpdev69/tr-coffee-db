# P9 deployed browser verification

Checked 2026-09-14 21:59–22:04 UTC on [staging](https://coffeedb-v2-web-staging.hellobasalt.workers.dev), deployment `651be3b2-9e3d-4dad-8974-05e662d5d390`. Actual WebKit browser, 390 × 844 viewport, actual remote Worker and D1. No source changes, email submissions, email lookups, external purchase navigation, network mocks, or analytics-blocker bypasses occurred in this check.

| User story | Actual result | Evidence |
|---|---|---|
| Open home | 481 available coffees, 38 roasters, 1,170 available packages | `output/playwright/p9-home.yml` |
| Inspect both newsletter placements | Two native forms; distinct email input IDs `_R_9bi_-email` and `_R_mbi_-email`; exactly one `#haftalik-drop` anchor | Browser DOM inspection; home snapshot |
| Open advanced controls, enter altitude 1800, submit | 17 coffees; submitted URL includes `altitude=1800`; entered value remains visible | `p9-altitude.txt` |
| Clear altitude, choose archived traceability available | 481 coffees | `p9-traceability-available.txt` |
| Choose archived traceability missing | 0 coffees and explicit empty state | `p9-traceability-missing.txt` |
| Open Guatemala Las Penas detail | 30 source packages; 250 g options 870 TL / 348 TL per 100 g; Guatemala, Bourbon, source tasting notes; absent fields explicitly unknown | `p9-detail.txt` |
| Expand detail provenance | Inferred feature values labeled as derived with unmeasured confidence; source link and archived source panel present | `p9-detail-provenance.txt` |
| Complete quiz using Espresso and French Press | Two real product-event POSTs, both 204; one start and one completion despite two option selections and four steps | `p9-quiz-network.txt`, `p9-quiz-payloads.txt` |
| Mobile layout | Document scroll width equals viewport width (390 px) on home, advanced empty state, expanded detail, and completed quiz | Browser DOM measurements; reviewed `p9-home-mobile.png`, `p9-quiz-mobile.png` |

The 481/0 traceability split is the current data result, not a fabricated demonstration set: every visible coffee has a linked public archive source. The UI states that archive presence is neither a quality score nor independent verification. Altitude is a source-text search, not numeric range conversion.

## Product analytics

Remote detail navigation produced `/api/events` 204 (request 21 in `p9-detail-network.txt`). Quiz requests 24 and 46 returned 204. To read the Blob payloads unavailable through WebKit's request-body API, a temporary browser observer copied the Blob text and immediately called the unchanged native `navigator.sendBeacon`. It did not alter requests, responses, UI actions, or server behavior. Navigation afterward discarded this page-local observer. Captured payloads were exactly:

```json
[
  {"event":"quiz_started","page":"quiz","source":"quiz"},
  {"event":"quiz_completed","page":"quiz","source":"quiz"}
]
```

There are no quiz answers, emails, personal identifiers, referrers, or arbitrary text in these events. Three native advanced-filter form submissions dispatched event requests but WebKit marked their responses cancelled during document navigation, as it did in the local check where server logs established receipt. Remote filter receipt therefore requires the independent Analytics Engine query; this browser evidence alone does not establish it. The root owns that query and records its result separately. A 204 response itself establishes API acceptance, not dataset persistence.

## Cloudflare Web Analytics limitation

The deployed page requests `https://static.cloudflareinsights.com/beacon.min.js`; the browser cannot connect. Independent local `curl` also fails in milliseconds. Read-only system resolution returns only `0.0.0.0`, captured in `p9-dns.json`. This is a local DNS filter, not evidence of a deployed CSP or application error. No filter was disabled or bypassed. CWA script loading and beacon receipt remain unverified in this environment. Its failed script request is the only observed console error on these pages; no application JavaScript exception was observed.

Browser artifacts are in `output/playwright/` with the `p9-` prefix. Raw network inventories are restricted to this QA session and contain no signup traffic. Provider state/confirmation, actual `/go` navigation, Analytics Engine SQL receipts, desktop layout, and full performance/accessibility audits are separate checks, not claimed by this report.

## Independent receipt follow-up

Root subsequently queried the actual Analytics Engine Studio table: all three filter events persisted, along with detail, quiz, signup and outbound events. See [P9 integration](p9-integration.md). This resolves product-event persistence; the separate CWA DNS limitation remains.
