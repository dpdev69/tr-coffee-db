# Tasks and evidence

- [x] T00 P0 audit and baseline — root + auditors. Evidence docs/v2-audit.md and docs/evidence/baseline*. US1–5.
- [x] T01 P1 SQLite canonical schema, identity, canonical URLs, unknown-safe units, feature provenance — data agent. Depends T00; AC2,5,19. Tests real SQLite constraints and pure model.
- [x] T02 P2 deterministic observation/event planner, retry/concurrency/partial guards — data agent + root. Depends T01; AC3,4. Tests all event/identity states.
- [x] T03 P3 Workers framework build/config, D1/Queues/Cron types — root. Depends T02; AC10. workerd build/runtime.
- [x] T04 P4 source export, replay-safe backfill, safe adapter coverage — crawler/data agents. Depends T03; AC6,7,8,9,18. Source counts, import replay and crawler comparison.
- [x] T05 P5 reconciliation and data quality — root. Depends T04; AC1,2,5,6,7,8,9,19. SQL queries/sample audit/report.
- [x] T06 P6 discovery routes/UI and retained utilities — assigned after T05; AC1,15,16,17,20. Browser mobile and empty/error journeys.
- [x] T07 P7 Kit signup — assigned after T06; AC11,12. Handler tests plus real opted-in signup with owner-provided credentials/address.
- [ ] T08 P8 safe referral + analytics — safe redirects and all seven persisted product events verified; separate CWA traffic-beacon receipt remains unverified due local DNS filter. See docs/evidence/p9-integration.md.
- [ ] T09 P9 staging checklist/cutover/runbooks — root; depends T08; all AC1–20. Approval gate for production; multiple crawl cycles.
- [ ] T10 P10 growth/research/privacy roadmap — root; after launch, no messages without explicit authorization. Subscriber goals measured externally.
- [ ] T11 P11 personalization recommendation — root; after evidence review, do not implement prematurely.
- [x] T12 brand/domain research — independent subagent per user request; evidence live Cloudflare prices/availability or explicit limitations. No purchase.

An unchecked task remains incomplete; unavailable remote checks must remain explicit blockers. Full acceptance definitions in user-brief.md.

2026-09-14T21:05Z gate note: P4/P5 validates remote seed/archive and local captured-source baselines. Remote Queue delivery is blocked by Cloudflare incident s4x7n3nfqnyy and remains P9 acceptance blocker. Wider14-source visibility changes need review before expanded live rollout.

2026-09-14T21:40Z: P6 browser+runtime checks passed, including profile-only refresh. P7 actual browser signup200, Kit inactive subscriber/form association verified; owner inbox/confirmation pending. P8 implemented, browser telemetry and remote receipts underway. Remote D1 confirms original three queued baselines succeeded at21:15–21:16 with1265observations/0events/0errors despite ongoingproviderincident. Repeated fresh cycles now being verified on profile-fixed crawler92c0f8c0-18eb-44c4-b47a-98184f7bc553.

2026-09-15 final staging checkpoint: web deployed, owner-confirmed Kit state active, remote signup succeeded, all seven AE event types persisted, all14 qualified source baselines passed, repeated three-source cycles passed. 284 tests plus lint/typechecks/Next/Workers builds passed. Earlier queue-blocked and signup-pending notes above are superseded. T08 remains open only for separate CWA traffic verification; T09 remains open for production approval/cutover and scheduled stability. T10/T11 plans prepared; acquisition execution and personalization deliberately deferred. See docs/staging-acceptance.md.
