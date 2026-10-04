# Implementation plan

Preserve existing Next 16.2.6 App Router and source parsers. Introduce pure shared V2 contracts, SQLite D1 schema, event planner and an atomic ingestion repository. Use vinext alongside Next only after compatibility/runtime verification; beta risk recorded. Crawler Worker is separate from web, Cron enqueues roaster jobs, D1 provides canonical catalog and health, Analytics Engine product telemetry, Kit email system.

## Phases and dependencies
P0 audit (done) → P1 canonical data integrity → P2 event engine → P3 Cloudflare configuration → P4 read-only export/backfill and safe crawler → P5 reconciliation → P6 UI → P7 Kit → P8 analytics/referrals → P9 approved deploy → P10 acquisition → P11 future validation decision.

Main agent owns specs/knowledge/integration, data agent owns shared/v2 + D1 schema and data tests; crawler agent owns safe adapter boundary after P1; brand agent researches independently. File ownership is assigned per milestone. Data fixtures, SQLite and workerd checks prove local invariants; staging export comparison proves migration; actual browser stories prove visible flows. Tests/typecheck/lint/build at milestones. User approval required only for production cutover, missing owner secrets and communications when necessary.

Data model is canonical in migrations/d1; contracts shared/v2. No fabricated legacy price timeline. Historical traceability preserved; private correction data excluded from public export. Unknown imported metadata carries legacy provenance.
