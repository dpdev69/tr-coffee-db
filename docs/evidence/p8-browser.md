# P8 browser telemetry verification

Checked 2026-09-14 21:44–21:48 UTC against the actual local vinext/Cloudflare runtime at `localhost:3001`, using the existing isolated WebKit `kahvedrop` session. No provider mocks, owner email submissions, purchases, or external outbound navigations occurred. Root stopped the runtime afterward for build verification.

| Actual interaction | Evidence | Result |
|---|---|---|
| Navigate from Guatemala La Colina to Guatemala Las Penas through its visible related-coffee link | Browser response 204; captured JSON below | Pass |
| Search `private-search-marker`, choose Guatemala, submit native catalog filter form | Request #375 body contains only filter names; server log line 93 reports POST 204 before filtered GET | Pass; WebKit reports cancelled response during navigation |
| Repeat filter submission after Beacon transport change | Browser request #189; server log line 112 reports POST 204 in 9 ms before filtered GET | Server receipt passes; WebKit cannot expose Beacon body or completed response |
| Select Espresso and French Press, advance all four quiz steps, show results | Exactly two API POSTs in this quiz page lifecycle, #162 and #167, both 204; completed UI lists both demleme filters | No duplicate start when selecting a second option or advancing steps |

Captured detail payload:

```json
{"event":"coffee_detail_view","page":"coffee","source":"detail","coffeeId":"coffee_a43c508c0d22fce357c7ed344ab2921e1c19d14e9ef90e594d79a4f04fe362fb"}
```

Captured filter payload before the transport update:

```json
{"event":"feed_filter_change","page":"catalog","source":"catalog","filterKeys":["search","origin","sort"]}
```

Neither payload contains the freeform search marker, filter values, personal identifiers, quiz answers, email, referrer, or a browser identifier. The coffee ID is an allowlisted public catalog identifier. The post-update Beacon request body is unavailable through this WebKit network API, so exact quiz/post-update payload privacy is supported by the implementation and schema tests rather than a readable browser body. Do not describe that portion as wire-payload inspection.

The initial browser-only observation of cancelled filter requests was misleading: both corresponding requests reached `/api/events` and returned 204 in server logs. The root changed the transport to `sendBeacon` with a JSON Blob and keepalive fallback during this check; the same native form flow was exercised again afterward. Event delivery must remain independent of navigation.

Artifacts under `output/playwright/`:

- `p8-payloads.json`: exact readable payloads and per-flow status summary.
- `p8-network.txt`: full current-page request inventory, including quiz 204s and post-update filter cancellation from WebKit.
- `p8-server-receipts.txt`: narrowly selected API/catalog/quiz lines corroborating server receipt, without secrets or subscriber data.
- `p8-quiz-complete.yml`: actual completed quiz and resulting catalog link.
- `p8-catalog-before.yml`: observed catalog form controls.

Limits: local 204 proves API acceptance, not Analytics Engine dataset persistence or Cloudflare Web Analytics receipt. CWA is intentionally disabled on localhost. Exact prefetch-versus-navigation deduplication, a second reset quiz attempt, newsletter submit instrumentation, and `/go` HEAD/real navigation were not exercised in this bounded flow; relevant server/parser tests and separate outbound/provider evidence must be reported separately. Early CLI listener attempts failed because its sandbox lacks a global `URL` constructor; these were test-harness errors, not application console errors. Final browser pages showed zero application console errors and two development warnings.
