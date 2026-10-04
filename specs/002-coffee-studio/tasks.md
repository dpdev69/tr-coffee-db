# Tasks
- [x] T1 root: baseline/spec/accepted decisions (all requirements).
- [x] T2 catalog_repair: ingestion/read eligibility, recent additions, runtime data evidence (FR1–2).
- [x] T3 quiz_cleanup: quiz, price/provenance/score cleanup, tests (FR3–5).
- [x] T4 coffee_scene: 3D background scene, automatic motion preferences, fallback (FR6).
- [x] T5 root: home/header/filter workflow integration (FR3,6,7), depends on T2–4 contracts.
- [x] T6 root: browser end-to-end + checks, spec convergence + checkpoint (SC1–4), depends on T2–5.

## Added user checklist
- [x] T7 quiz_cleanup: custom404/loading, metadata/icon/OG/alt audit, verified image compression.
- [x] T8 root: consent-gated analytics with preference controls, form errors/thankyou route, sticky header CTA and mobile recovery checks.
- [x] T9 coffee_scene: replace cup with interactive bean-sack background; validate pointer/touch/motion/fallback.
- [x] T10 root: staging deployment and final validation, quota-dependent catalog follow-up clearly reported; contact address deferred by user.

## External follow-up
- [ ] T11: After the D1 daily quota resets, verify deployed catalog/new discoveries and the first qualified scheduled crawl. No remote repair was applied and no current live catalog success is claimed.
- Deferred by user: real public contact address.
- Traffic-beacon receipt remains unverified due local DNS blocking; provider form behavior in this revision was mocked.
