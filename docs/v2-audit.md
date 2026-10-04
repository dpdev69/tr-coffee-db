# V2 repository audit

Audited 2026-09-14, baseline `099a81c` (clean before work). Scope: repository inspection, existing tests and build; live catalog counts are a separate verification gate.

## 1. Current architecture
Next.js 16.2.6 App Router, React 19.2.4, Tailwind 4, TypeScript 5.9.3 installed; npm root and scraper lockfiles. Node 22.x required; audit shell Node 26.8.2. Supabase JS 2.110.2 / SSR 0.9.0, no ORM. No implemented authentication, payments or subscriber system. `src/lib/supabase/server.ts` uses request cookies and anon access; server intake/crawlers use service credentials.

## 2. Current data flow
Roaster adapter → RawProduct → heuristic normalization and specialty classification → overwrite one coffee row in Supabase → mark absent rows unavailable → scrape_logs. Server queries render catalog/details; detail buy link sends best-effort POST /api/click while navigating directly to roaster. No persisted variant or price history survives normalization.

## 3. Current crawler architecture
39 configured roasters: 11 Shopify, 10 WooCommerce, 10 IKAS, 8 custom. `scrapers/src/adapters` contains reusable Shopify, WooCommerce, HTML/structured-data and Parsa parsers. `base-scraper.ts` handles writes, metadata preservation, classification and failures. Existing package parsing and trusted-host policies are reusable. Shopify extracts variant IDs but writer discards them; WooCommerce reduces variants to selected retail package. Some HTML identities use mutable slugs. Crawl completeness is implicit. WooCommerce and Probador HTML adapter include node:vm challenge execution: V2 must never call those bypass paths. Do not delete legacy infrastructure before replacement passes gates.

## 4. Current schema
23 migration files in `supabase/migrations`: roasters, coffees, scrape_logs; specialty controls/overrides; redirect events and correction reports; supply_chain_organizations, coffee_lots, lot_organizations, trace_sources, coffee_claims, trace_events, coffee_assessments, coffee_certifications. Coffee uniqueness `(roaster_id, external_id)`; mutable nonunique slugs. Trace events are supply-chain evidence, not discovery events. No offers, observations, compare-at history or discovery events. Normalized and inferred data are mixed into coffees. Private correction reports contain email and must not enter catalog migration/analytics.

## 5. Current deployment path
Vercel references in site/layout/docs and existing .vercel linkage. GitHub `ci.yml` runs Postgres migrations/trigger check, web lint/typecheck/build, scraper typecheck and tests. `scrape.yml` runs every two days at 03:00 UTC, bounded retries and broad 90% health threshold. Production Supabase and Actions remain operational rollback infrastructure. No existing Workers/D1/Queues config.

## 6. Major data-quality risks
- Selected package changes masquerade as price changes; cannot reconstruct historical SKU prices.
- Raw descriptions/variants/rawData lost. Legacy fields cannot be relabeled source-declared.
- Currency forced TRY; negative prices can yield negative normalized price. Reproduced EUR -25/250g → TRY -10 per 100g.
- Gesha keyword maps origin to Panama; filter/espresso taxonomy infers roast. Preserve only as inference or unknown.
- Nonempty partial crawl can mark absent products unavailable; attempted/failed/partial/absent/explicit stock not distinct.
- Counts disagree: coffee catalog adds name exclusions, roaster counts/sitemap do not; SQL RPC requires active roaster, TS visibility does not. Unpaginated scans can truncate.
- Public detail queries remove unavailable or >3-day-stale coffee, breaking durable event/history URLs.
- Slug regenerated from title; collisions/renames can break details and saved comparisons.
- Price history does not exist. Import one labeled legacy snapshot, suppress import NEW/deal events.
- URL validation exists but tracking stripping/canonical identity does not.

## 7. Technical debt affecting V2
`src/lib/queries` couples reads to Postgres RPCs. Rate limiter is unbounded process-local Map. /api/click reports success on DB errors. Roaster query returns null on DB errors (false 404). Detail labels all currencies TL. Brand hardcoded in layout/header/footer/OG/legal/UTMs despite site.ts. next/font/google, next/og and SSR runtime need Workers tests. Vinext check is 83%: ESM package missing; CJS warning in migration script is false positive (it defines __dirname from import.meta.url); font/CDN and image partials. Images already unoptimized. Legacy runner reexecutes migrations without ledger/checksum. No browser E2E runner. Unused browser Supabase client/price helpers/starter SVG need not be removed.

## 8. Features worth retaining
Turkish search and filter URL contracts, package parsing, host allow-lists, missing-weight handling, freshness notices, specialty overrides, source/claim traceability, deterministic similarity, quiz-to-filter mapping, cited brew calculator, local comparison, privacy/terms/correction flow. Quiz is anonymous and does not pretend to personalize. Traceability score describes completeness, not quality.

## 9. Features to de-emphasize
Rankings, quiz primary CTA, expert traceability and advanced filters. Preserve utility routes under secondary navigation. No new accounts, billing, AI scoring or brew journal.

## 10. Recommended migration sequence
P1 pure canonical product/offer model + SQLite constraints and provenance → P2 observation/event rules with deterministic tests → P3 Workers/D1/Queues architecture preserving Next routes via verified vinext compatibility → P4 read-only Supabase export and idempotent staging backfill, safe adapters → P5 counts/history/sample/crawler reconciliation → P6 discovery UI → P7 Kit → P8 outbound/analytics → P9 staging then approved production cutover → P10 acquisition → P11 only after measured validation personalization.

Baseline evidence: `docs/evidence/baseline-tests.log` (170/170), `baseline-build.log` (Next build passes); typecheck and lint pass. Parser subaudit 84/84, frontend subaudit 69/69 overlap baseline. No remote Workers, Kit or browser acceptance has yet passed. Current framework reference: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ (vinext beta, compatibility check required).
