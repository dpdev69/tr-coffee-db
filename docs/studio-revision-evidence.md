# Studio revision — 2026-09-15

Canonical scope: [spec](../specs/002-coffee-studio/spec.md). User chose warm studio, retained roaster-declared SCA, removed public catalog timestamps, then replaced cup/controls with interactive coffee-bean sack background. Contact email/address explicitly deferred.

## Current verified behavior
- Real local Workers catalog: 471 coffees / 38 roasters / 1,160 in-stock offers. 1,030 identities and 13,452 archives preserved. Exclusion tests cover ceramics/equipment/services; Ying Yang search returns zero.
- Source-backed profile corrections: KIRYAMA explicitly is not decaf; no invented Rum/Leather from substring matching. Correct 625 TL / 200 g and 2,575 TL / 1 kg in actual browser, exact 200gr Molecule purchase URL reached. No purchase.
- Full four-answer quiz handoff returns 9 actual matching coffees for filter + Fruity + washed + light. Back/edit retains choices; all-skipped completion leads to unfiltered catalog; restart clears selections.
- 390px catalog pagination, Burundi filter, reset, compare add/remove (2/1/0), and sticky header CTA exercised. Comparison table intentionally scrolls inside 390px page; page has no horizontal overflow.
- Public cards/details/API/sitemap omit internal checked/first-seen timestamps, normalized pricing and provenance. Roaster harvest/roast/SCA facts remain. Rankings route retired.
- Consent defaults to no measurement; essential-only blocks browser events and server intake returns204 before D1 access. Exact analytics consent permits quiz event in browser Beacon spy; revoke persists essential cookie and reloads. Cloudflare traffic-beacon network remains subject to previously recorded local DNS block.
- Form error and success → /tesekkurler checked with browser-intercepted provider responses. No email sent by this revision's form tests. Earlier actual Kit provider acceptance is historical evidence, not a new send.

## Runtime/query fixes
Default npm dev uses Workers/vinext on3001. Five-minute successful-read cache; no failure caching. Stable event-window keys, indexed bounded historical observations, balanced exclusion SQL proven in actual Workerd (D1 depth limit differs from Node SQLite).

## Evidence artifacts
- output/playwright/studio-quiz-filtered.txt
- output/playwright/studio-quiz-skipped-mobile.png
- output/playwright/studio-form-error-mobile.png
- output/playwright/studio-thankyou-mobile.png
- output/playwright/studio-consent-verified.png
- output/playwright/independent-kiryama-review.yml
- .local/v2/catalog-repair-applied.json; profile-truth-repair.json; independent-boundary-review.log (internal)

## Final verification
305 tests pass; lint, Next typecheck/build, scraper typecheck and Cloudflare build pass. Built release secret scan clean. Final bean interaction/lifecycle evidence: [scene verification](../output/playwright/studio-scene-verification.md). Per-route metadata: [audit](../output/playwright/studio-metadata-verification.json). Verified image dimensions/cache hits: [compression](../output/playwright/studio-image-verification.json), 125,736-byte JPEG→6,250-byte384AVIF (95% reduction), 23,148-byte640WebP (82% reduction).

Actual local production artifact: counts471/38/1160; HTTP404 recovery; robots/sitemap/favicon/OG200; detail HTML has none of firstSeenAt/lastSeenAt/sourceData/priceHistory/legacy_traceability or local filesystem path. Streaming loading markup observed. Physical mobile was not tested. Native Safari staging smoke later verified custom404, essential-consent selection, recovery link home, and visible bean background; full interaction instrumentation remains Chromium-only.

## Deployment
Web staging version `85588e40-81ed-477b-a577-6f6da69dc8e2`; crawler `49ba71c0-3400-4966-95ef-6af57ef36779`. Both deploy commands completed successfully. Crawler true/live, cron and queue producer/consumer confirmed. Staging browser confirms new hero/canvas, correct metadata, no overflow/playback controls, actual hero CTA→quiz. Live catalog correctly displays its unavailable recovery state while D1 is quota-blocked. Direct Python HTTP probes returned403 for all paths ([probe record](../output/playwright/studio-staging-http.json)); these do not establish application response statuses. Required Safari fallback opened the custom404 successfully, accepted essential-only consent, followed its home recovery link, and visually confirmed the bean scene and catalog-unavailable message. Local production HTTP statuses remain the verified status-code evidence.

## Spec convergence
FR001–007 and SC001–004 have local production/browser/test evidence above. Launch checklist has metadata/image/consent/form/mobile evidence. No contradictory active cup direction remains. Remote availability acceptance is external and open (T11), and the user deferred contact address. Do not mark full live acceptance complete.

## Live database limitation
Authenticated remote D1 returned error7500: daily free-tier read quota exceeded. Last successful read proved stored481/38/1170 before read-time coffee-only filtering; no remote data mutation was performed. Do not claim live catalog availability until reset/recheck. Scheduled qualified14 crawler is configured true/live for the next six-hour trigger (00:00 UTC /03:00 Istanbul), deployed with cron/queue verification. No billing plan change or production domain cutover.
