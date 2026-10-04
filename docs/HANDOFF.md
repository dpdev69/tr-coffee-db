# Agent handoff — 2026-10-04

Start here. This file is the current state; [v2-handoff.md](v2-handoff.md) is the 2026-09-15 staging handoff and is partly stale (see "Doc drift").

## Where things are

- **Repo:** `dpdev69/tr-coffee-db` (private). Work branch **`001-kahvedrop-v2`**, pushed, 5 commits ahead of `main`, CI green on the last two pushes. **No PR opened yet.** `backup/v2-pre-rebase` is a local-only safety branch from before the rebase onto main #13/#14; delete it once the PR merges.
- **Staging:** https://coffeedb-v2-web-staging.hellobasalt.workers.dev (noindex). It runs code from 2026-09-15; **nothing from this session is deployed.**
- **Stack:** Next 16 App Router through vinext on Cloudflare Workers, D1 catalog, crawler Worker + Queues (Cloudflare cron is **off**, `crons: []`), Kit newsletter (form `9918321`). The daily catalog refresh runs from GitHub Actions `scrape.yml` → `scripts/v2-refresh.mts` → D1 REST API.
- **Other folders:** `../free-catalog-refresh` is a worktree already squash-merged as main #14 (safe to `git worktree remove`). `/Users/me/Documents/claude/projects/coffee` is an obsolete v1 copy with no commits; ignore it.

## What this session shipped (oldest first)

| Commit | What |
| --- | --- |
| `ab9f910` | Snapshot of all previously uncommitted v2 work, rebased onto main #13/#14. Where main was newer (refresh/ingestion/d1-rest) main won; where local was newer (catalog, parsers, profile-truth) local won. |
| `e4882c1` | Catalog truthfulness: grind/roast variants at the same weight+price collapse into one package (`collapsePackages` + `PACKAGE_KEY` in `shared/v2/catalog.ts`), name-only exclusions for subscriptions/sets/drip bags/cases (`shared/v2/coffee-eligibility.ts`), read repair of glued storefront labels in origin/process/roast/altitude/farm/producer and HTML-entity/“YENİ –” name cleanup (`shared/v2/profile-truth.ts`), price sort+filter on the card's package (`PREFERRED_PRICE`), Turkish-folded search with gesha/geisha + TR/EN origin synonyms, last-page clamp, `/firsatlar` defaults to price drops. |
| `e24045e` | KVKK art. 10/11 notice on `/privacy`, required consent checkbox on the newsletter form, contact moved off private-repo GitHub Issues. **Controller and contact are `null` in `src/lib/legal.ts`** → pages show “henüz belirlenmedi”. |
| `ba12977` | Weekly digest: `scripts/v2-digest.mts` + `.github/workflows/digest.yml` (Mon 06:00 Istanbul). Reuses `listCatalog` event feeds, creates a Kit **draft** only (`send_at: null`, guarded), skips when <3 items. Never previewed with real events (local D1 has none). |
| `a455ac6` | Migration `0005_current_offers_freshness.sql` (coffee is current only if seen within 7 days of its roaster's last *successful* crawl), crawler `queue()` honors `CRAWLS_ENABLED`, DLQ name via `CRAWL_DLQ_QUEUE`, stage-driven cache namespace, production fails at startup without `NEXT_PUBLIC_SITE_URL`, unchanged features not rewritten per crawl, weekly `d1-backup.yml` (gzipped artifact, 30 days). |

Verification at handoff: `npm test` 344/344, `npm run lint`, `npm run typecheck`, `npm run scrapers:typecheck`, `npm run build:cloudflare`, `npm run build:crawler` all pass on Node 26 locally; CI (Node 22) green.

## Blocked on the owner (do not invent these)

1. **Apply 0005 to staging:** `npm run db:migrate:staging`. Remote ledger was checked read-only: 0001–0004 applied, only 0005 pending. Needs owner OK — it changes the live staging DB.
2. **GitHub settings:** secret `KIT_API_KEY`, variable `SITE_URL`. Run `d1-backup.yml` once manually: Cloudflare doesn't document the export permission; the existing `CLOUDFLARE_D1_API_TOKEN` (D1 Edit) should work, a read-only token may not.
3. **Legal identity:** set `DATA_CONTROLLER` and `CONTACT_EMAIL` in `src/lib/legal.ts`. The open KVKK/İYS/transfer-abroad questions are in [kit-setup.md](kit-setup.md); the notice text is not legal advice.
4. **Domain + branded sender** in Kit, then production Cloudflare resources (checklist in [cloudflare-deployment.md](cloudflare-deployment.md)) and cutover approval per [cutover-runbook.md](cutover-runbook.md).
5. **Kit recipients:** the API can't target a form, so the digest draft has no `subscriber_filter`; the owner picks recipients in Kit. If Kit rejects drafts without it, create a segment of form 9918321 and pass `{all:[{type:'segment',ids:[…]}]}`.

## Suggested next work (ranked)

1. **Open the PR** `001-kahvedrop-v2` → `main` (ask first). Then deploy to staging and re-run the live checks below.
2. **Newsletter surface:** form appears only at home-bottom — add to `/firsatlar` (incl. its empty state), `/yeni`, detail pages, footer. Fix `newsletter-form.tsx`: the success state is dead (navigates to `/tesekkurler` immediately) and the no-JS fallback posts form-encoded data that `/api/subscribe` rejects as JSON 400.
3. **`/yeni` default** lists the whole catalog sorted by first-seen, not genuine arrivals; decide with the owner whether it should default to NEW events (empty until live crawls produce them).
4. **Images:** 42 staging coffees (8%) have dead upstream images, mostly Coffeerem, Kronotrop, Ordinarius. Re-crawl images or fall back to the roaster name tile (already the null-image fallback).
5. **Caching/perf:** `src/app/layout.tsx` awaits `cookies()`, so every page is dynamic and staging sends `no-store`. Read consent client-side to let static pages cache. `getSimilarCoffees` scans up to 5,000 rows per detail view (`ponytail:` comment).
6. **Data polish:** cross-size twins (“KOYU” vs “KOYU 2.5KG”, “– Espresso” twins) are separate coffees; Old Java “Cold Brew” is listed (left in deliberately: name-only exclusion would hide cold-brew beans); 310 offers lack weight; English labels leak (“Filter / Pour Over”, `/compare` shows “Brazil”); tasting-note casing is inconsistent.
7. **Desktop search:** `header.tsx` renders `SearchInput` only in the mobile menu, and `src/lib/search-url.ts` targets legacy `/coffees`.
8. **Cleanup:** dead components (grep-confirm first: `sidebar-filters.tsx`, `coffee-card/grid`, `pagination`, `report-issue-form`, `lib/api/rate-limit`, `lib/supabase/client`), unused `@vercel/analytics`, “TR CoffeeDB” leftovers in `package.json`/`.gitleaks.toml`/`TODOS.md`, stale `codex/*` branches.

Enabling the Cloudflare cron needs all of these together: `crons` set, `CRAWLS_ENABLED="true"`, queue delivery resumed, **`scrape.yml` schedule disabled** (two writers duplicate observations), and Workers Paid (free-plan subrequest/CPU limits break the queue crawler).

## How this codebase wants changes made

- **Read [AGENTS.md](../AGENTS.md):** Next 16 has breaking changes; read `node_modules/next/dist/docs/` before using Next APIs. vinext is beta; check `npm run build:cloudflare` after UI changes.
- **One choke point per concern.** Every public query goes through `coffeeOnlySql()`; every coffee is built in `hydrate()`; source metadata is repaired at read time in `truthfulMetadata()`; every parser builds products in `coffee()` (`scrapers/src/v2/parsers.ts`). Fix there, not in components, so existing D1 rows are covered without a recrawl.
- **Unknown beats wrong.** Missing weight → no unit price; prose in a fact field → field dropped. Raw source data stays intact in `raw_metadata_json`; `price_observations` are immutable and DEAL detection depends on repeated same-price observations — don't dedupe them.
- **Test against real data.** A full staging catalog dump from 2026-10-04 is not in the repo; regenerate by paging `/api/catalog?perPage=100&page=N`. A local D1 copy (2026-09-14 data, no events) lives under `.wrangler/state/v3/d1/`; open it read-only with `node:sqlite`. Tests apply all migrations via `applyMigrations()` in `tests/helpers/v2-sqlite.ts`.
- **Remote is the owner's call.** No deploys, `--remote` wrangler writes, Kit calls or pushes without explicit approval. Read-only checks (`wrangler d1 migrations list --remote`, GET on staging) are fine.

## Doc drift (fix when touching these)

- `docs/v2-handoff.md` / `docs/staging-acceptance.md`: 284 tests (now 344), 14 qualified sources (code lists 38; only `cho-coffee` unqualified), “remote CI has not run” (it has), `/rankings` listed as a utility (it redirects to `/kahveler`), staging counts 481/38/1,170 (live API showed 511/39/3,400 offer rows before package collapse).
- `TODOS.md` predates v2: the zero-product WooCommerce adapters it lists are now qualified, and `ordinarius` was rewritten as IdeaSoft.
