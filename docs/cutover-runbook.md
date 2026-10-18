# Cutover and rollback runbook

Status: staging preparation; production cutover NOT approved or performed. Do not disable legacy schedulers or delete Supabase/Vercel resources yet.

## Evidence gates before approval
1. Export paginated source with table counts and checksums. Keep a protected full database backup separately; public catalog export excludes private reports and is not a transactional backup.
2. Apply D1 migrations to isolated staging; import snapshot idempotently twice. Reconcile all1030 source identities, current counts, metadata, aliases and one legacy observation per recoverable price. No fabricated discovery events/history.
3. Run safe source crawlers in baseline mode. Compare recorded identical source payloads with legacy parsers without any legacy writes/challenge execution. Review SKU/weight/currency/stock/identity differences.
4. Exercise canonical reads across home/catalog/roasters/API; missing weight no normalized price. Confirm failed/partial/retry tests and inspect crawler health.
5. Browser-test mobile/new/deals/catalog/details/offer redirect/newsletter plus empty/error/out-of-stock and retained utilities. Confirm canonical metadata and redirect legacy aliases.
6. Kit real opted-in test including email confirmation and form membership. Verify unsubscribe is not overridden. Verify no email in telemetry/logs and actual Analytics Engine outbound event is queryable.
7. Choose owned domain/brand, configure sender identity/delivery domain/privacy processor disclosures, and resolve owner/legal questions. Domain research is not registration.
8. Present staging URL, evidence matrix, migration report, known discrepancies and rollback steps for owner production approval.

## Approved production sequence
Record deployment IDs, source timestamp, DB/schema checksums and current Vercel hostname. Temporarily pause legacy writes only after explicit cutover approval; take full backup and final source export. Load a separate production D1 with reviewed final sync, repeat reconciliation; never replay a different snapshot blindly into a used database. Deploy production Worker against production bindings, initially baseline crawler mode, verify production reads/signup/redirects. Change DNS only for verified owned domain. Preserve prior DNS and Vercel routing values. Start six-hour Cron after inspecting sample job outputs. Observe at least3 successful scheduled cycles per launch roaster (18+hours) before calling stable. Verify no error/latency or unexpected source load. Turn on live event mode only after baseline review. Keep legacy system read-only for a defined rollback window (recommend7days minimum); retirement is a separate decision after evidence.

## Rollback
If source data corrupted, queue duplicate events, signup failure, unsafe redirect, unavailable pages or crawler coverage drops materially: stop new Cron enqueue (CRAWLS_ENABLED=false) and pause queue delivery. Keep evidence/logs and D1 snapshots. Restore prior DNS/routing to retained Vercel deployment and original Supabase read connection, then verify home/detail/purchase/utility paths. Re-enable the legacy scheduler only after confirming its last write state and no competing writers. Never delete new observations/events to conceal failure. Kit subscriber data remains in Kit and must not be rolled back with the catalog. New analytics remain separated by environment.

D1 backup restore: download the weekly `d1-backup` Actions artifact (30-day retention) and `gunzip` it.
Create a NEW empty database, then `python3 -I scripts/d1-import-order.py d1-backup.sql d1-import.sql` and `npx wrangler d1 execute <new-db> --remote --file d1-import.sql`; never execute it over a database already in use. The raw export fails to load with "FOREIGN KEY constraint failed" because a coffee can point at a later coffee.
Verify counts against the backup, then repoint the Workers' `database_id`; D1 Time Travel (`wrangler d1 time-travel`) also covers the last 7 days on Workers Free without a file.

Workers code rollback does not restore D1/Queues/resources. A database correction needs a separately reviewed forward repair or verified backup restore. Do not combine code rollback with destructive DB reset. No secret values belong in this runbook.

## Remaining cutover requirements
Review the completed staging evidence and its explicit limitations, resolve the separate CWA traffic receipt check, obtain production approval, verify sender/legal settings and select an owned domain. Real newsletter confirmation, all seven product event types and repeated rapid crawl cycles have passed. Full backup/final sync and at least three successful scheduled cycles per launch roaster remain part of the approved production sequence. Post-launch acquisition messages need explicit recipient/content authorization.
