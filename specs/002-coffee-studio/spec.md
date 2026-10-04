# Feature Specification: Coffee studio and discovery repair

**Created**: 2026-09-15
**Status**: Accepted user request; warm studio and retained roaster SCA confirmed in this task.
**Input**: Restore quiz, populate catalog/new coffees, exclude non-coffee items, remove normalized pricing and provenance section and own scores, redesign with Three.js coffee animation.

## User Scenarios & Testing
### User Story 1 — Find actual coffee (P1)
Browse catalog and recently added coffees, filter, open detail, select a roaster package.
Acceptance: real catalog returns coffee products; known Ying Yang ceramic and equipment do not appear in list, detail, counts, recommendations; prices/weights match observed roaster packages. Discovery feed includes imported entries sorted by internal catalog date, without exposing maintenance timestamps or manufacturing launch events.
### User Story 2 — Find my taste (P1)
Reach taste quiz from header and home, answer four questions, go back/restart, view matching catalog.
Acceptance: visible entry points on desktop/mobile; complete and skipped-answer paths work; filter handoff retains preferences; empty results offer recovery.
### User Story 3 — Coffee studio experience (P2)
See an interactive coffee-bean background and use a clearer discovery workflow.
Acceptance: real 3D rendered scene with mobile layout, reduced motion, no-WebGL fallback; catalog functions with animation unavailable.
### Edge Cases
Unavailable DB is explicit and retryable; zero results do not imply missing DB. Sparse product metadata never manufactures taste or SCA. Existing excluded identities and archives are retained. New feed is catalog additions, not release claims. No fake price drops/restocks.

## Requirements
- FR-001: Coffee-only ingestion and public query eligibility, preserve historic identities.
- FR-002: Reliable populated runtime and recent catalog additions with truthful dates.
- FR-003: Quiz accessible in primary navigation/home, complete end-to-end catalog handoff.
- FR-004: Show actual package price and weight; no normalized per-100g display or sorting.
- FR-005: Remove public provenance sections and own scoring/ranking; retain roaster-declared SCA facts.
- FR-006: Warm paper design and interactive coffee-bean sack background using user-requested Three.js, responsive and motion accessible.
- FR-007: Faster discovery path: home → quiz or catalog → detail → roaster, progressive advanced filters.

### Key Entities
Coffee identity; roaster package/observation; catalog addition date; quiz preferences (ephemeral); declared SCA fact.

## Success Criteria
- SC-001: Catalog, new feed, quiz and detail work in actual browser with real local catalog data.
- SC-002: Known non-coffee regression cases excluded; package price retained; forbidden displays absent.
- SC-003: Desktop and 390px mobile user story has no overflow and usable controls; automatic motion suspension/reduced/no-WebGL paths checked.
- SC-004: Relevant unit/integration tests, lint, types, scraper check and both builds pass or remaining limitations reported precisely.

## Assumptions
Existing Workers/D1 staging remains target, prior production cutover gate remains. Imported catalog entries may be shown as latest additions but never labelled as verified launches. User explicitly authorized implementation and selected visual direction; no further routine approval required.

## Accepted follow-up
2026-09-15: User wants catalog update/check timestamps visible only to team. Remove public freshness labels, first-seen dates and maintenance timestamps; preserve internal observations. Discovery labels describe exploration without claiming product release.

Superseded intermediate visual revision: no visible pause/resume; simplify Three.js to a subtle Japanese-inspired background animation, warm paper, restrained ceramic/steam composition. Automatic reduced-motion/offscreen behavior remains.

## Accepted launch checklist and final background revision
- User explicitly added custom 404; title/description on each page; above-fold CTA; branded favicon; robots/sitemap; OG image; image alt text; mobile breakpoints and sticky CTA; loading/form error states; thank-you page; privacy/terms; consent banner; analytics; compressed images. Existing sticky header quiz CTA meets mobile persistent-action requirement without another overlay.
- Public contact email/address explicitly deferred by user; retain existing GitHub Issues contact.
- Final animation supersedes cup/Japanese composition: interactive 3D coffee-bean background with beans rolling/displacing under pointer/touch like a coffee sack; no cup or playback controls. Keep content readable, touch scrolling, reduced-motion/offscreen behavior and fallback.
