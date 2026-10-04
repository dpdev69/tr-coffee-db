# KahveDrop V2 specification

Status: implementation authorized by user brief, 2026-09-14. Canonical full requirements: [user brief](user-brief.md). No unanswered product questions block P1.

## User stories
US1: As a visitor I can distinguish new coffee, restocked offer and historically cheaper identical SKU, with accurate stock/price/weight and durable detail URLs.
US2: I can discover/filter a coffee and reach its known roaster offer in one click, measured without personal data.
US3: I can join Haftalık Drop with only email, safely through Kit, without quiz/account, preserving unsubscribe settings.
US4: As operator I can inspect per-roaster crawl health, reconcile a reversible D1 migration and retain rollback.
US5: Existing quiz, calculator and expert metadata remain usable, subordinate to discovery.

## Functional requirements
FR1 canonical roaster→coffee→offer→append-only observation; source IDs + URL aliases, unique active offers and stable slug.
FR2 separate raw source metadata from feature evidence (source/confidence/version). Legacy inference never source-declared.
FR3 complete/partial/failed crawl state; absence never explicit unavailability; atomic/idempotent reconciliation and safe retries.
FR4 NEW/PRICE_DROP/RESTOCKED/DEAL/OUT_OF_STOCK rules trace to confirmed same-offer observations. Imports/baselines suppress events. Verified deal needs >=2 prior successful price observations and >=10% decrease.
FR5 canonical queries/counts, provenance/freshness, data quality and crawl health reports.
FR6 Cloudflare staging, bounded per-roaster Queue jobs every six hours; no bypass, isolated failure.
FR7 Turkish discovery routes/card/offer detail; meaningful error/empty/mobile states; centralized provisional brand.
FR8 Kit server-only API, validation/idempotency/abuse controls/safe errors; no email analytics/logs.
FR9 DB-sourced host-validated /go redirect + safe UTMs, product events and Web Analytics.
FR10 sponsorship off by default and separated from organic ranking. Future taste graph documented only.

## Success criteria
All 20 staging acceptance criteria in user-brief are mandatory and tracked in tasks/evidence. Local checks are necessary, not proof of remote acceptance. First 6 final product questions must be yes before complete. 100/500/1000 subscribers are operating targets, not guarantees.

## Edge cases
Unknown weight/price/currency/stock; mismatched weights; product title/URL changes; duplicate source rows; blocked/empty/partial crawls; queue retries/concurrency; import replay; ambiguous legacy SKU; stale observations; unsubscribed subscriber; Kit outage; malicious destination/analytics payload; unavailable roaster; empty feed; mobile and retained utility paths.
