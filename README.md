# KahveDrop

KahveDrop runs on Cloudflare Workers/D1 through vinext, with a Three.js coffee studio and a Turkish coffee discovery catalog. The public name is set in [`src/lib/brand.ts`](src/lib/brand.ts) and is provisional; the repository and some infrastructure names still use the earlier project name. The original Next/Supabase (v1) paths remain only for rollback and export. The product goal is simple: help buyers compare beans across roasters without opening a dozen separate storefronts.

## Choosing a coffee

- Search by coffee, roaster, origin or tasting note; narrow the catalog by brewing method, flavor, process, roast and decaf preference.
- Cards show the roaster’s actual package price and weight. Sort by package price or newest.
- Select up to three coffees to compare prices and published attributes side by side. The selection stays in this browser; comparison URLs can be shared and always load current public records.
- The coffee guide explains label terminology and includes adjustable starting recipes for filter, espresso, French press and AeroPress, with original sources. Espresso quantities describe beverage yield, not brewing water.
- Catalog checks and update timestamps are internal. Public views retain roaster-declared harvest, roast dates and SCA facts. Data-source errors are shown separately from empty results.

## What Is In This Repo

- `src/app`: Next.js App Router pages (catalog, coffee detail, roasters, quiz, guide, compare) and the `/go` outbound-link route.
- `src/components`: UI; the live catalog UI is in `components/v2`.
- `src/lib`: brand config, D1 catalog access, and legacy Supabase query helpers (still used by `/compare`).
- `shared/v2`: catalog, qualification, ingestion and profile logic shared by the web app, crawler and scripts.
- `scrapers`: source adapters and parsers (its own `package.json`).
- `workers`, `wrangler*.jsonc`: the web Worker and the crawler Worker (Cloudflare cron is currently off).
- `migrations`: D1 schema. `supabase/migrations`: legacy Postgres schema, kept for rollback and export.
- `scripts`: refresh, digest, export and audit scripts.

## Requirements

- Node.js 22
- npm 10+
- For the Workers runtime locally: `wrangler` (installed as a dev dependency); the local D1 database is created by `npm run db:migrate:local`.
- Remote work needs Cloudflare credentials (`CLOUDFLARE_D1_API_TOKEN` for refresh and migrations) and a Kit API key for the newsletter; see [`.env.example`](.env.example). Supabase credentials are needed only for the legacy rollback paths below.

Use the checked-in [`.nvmrc`](.nvmrc) to align local and CI Node versions.

## Current V2 local workflow

```bash
npm ci
npm --prefix scrapers ci
npm run db:migrate:local
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). `npm run dev` uses the Workers runtime so the D1 catalog binding is present. Schema migration alone does not import data; use the [migration runbook](docs/d1-migration-runbook.md). This workspace already has a repaired local catalog. `npm run dev:next` is retained for legacy compatibility and does not supply D1.

Three.js loads only on the home page after hydration. It pauses when offscreen/hidden and supports reduced motion and WebGL fallback.

Maintenance: `npx tsx scripts/v2-repair-local-catalog.ts --local-db <existing-project-.wrangler-database.sqlite>` (dry-run; add `--apply` after reviewing the report) checks saved qualified captures; internal repair reports live under `.local/v2`. Do not expose these reports in public routes.

## Legacy local setup (rollback only)

1. Install dependencies:

   ```bash
   npm ci
   npm --prefix scrapers ci
   ```

2. Create local env files:

   ```bash
   cp .env.example .env.local
   cp scrapers/.env.example scrapers/.env
   ```

3. Fill in the required variables:

   App runtime:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Scrapers and migrations:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DB_PASSWORD`
   - `SUPABASE_DB_SSL_CA_FILE` pointing to the Server root certificate from
     Supabase Database Settings when running migrations over the pooler

4. Run database migrations:

   ```bash
   npm run scrapers:migrate
   ```

5. Start the app:

   ```bash
   npm run dev:next
   ```

Open [http://localhost:3000](http://localhost:3000).

## Common Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run scrapers:migrate
npm run scrapers:scrape -- --roaster <slug>
```

Run `npm test && npm run check` before opening or updating a PR. The first command runs the automated tests; `npm run check` runs linting, TypeScript checks, the production build, and the scraper typecheck.

## Legacy Scraper Workflow

- Legacy (Supabase) only: use `npm run scrapers:migrate` to apply the SQL files in [`supabase/migrations`](supabase/migrations).
- Migration connections verify TLS certificates. If your pooler connection reports a
  self-signed certificate chain, download the Server root certificate from Supabase
  Database Settings and set `SUPABASE_DB_SSL_CA_FILE` to its absolute path.
- Use `npm run scrapers:scrape` to run all configured scrapers.
- Use `npm run scrapers:scrape -- --roaster <slug>` when you only want one roaster.
- The scheduled GitHub Actions refresh is described under Catalog refresh behavior; it writes to D1, not Supabase.

## Git Workflow

The contributor rules live in [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

1. Keep `main` protected and deployable.
2. Do work on short-lived branches.
3. Open a PR for every change, even small ones.
4. Require CI before merge.
5. Squash-merge to keep history readable.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the smoke checks we want required on pull requests:

- web lint
- web typecheck
- production build
- scraper typecheck
- automated tests
- PostgreSQL migration replay and service-role coffee INSERT/UPDATE checks

The database job replays the legacy Supabase migrations against PostgreSQL and is retained with them for rollback. The web job also builds the Cloudflare web Worker and validates the crawler Worker bundle.

## Catalog refresh behavior

The daily D1 refresh ([`scrape.yml`](.github/workflows/scrape.yml) running `scripts/v2-refresh.mts`) crawls every active qualified source once. There is no retry and no success-rate gate: the run exits non-zero if any requested source does not finish as `success`, and the refresh report is uploaded as an artifact. Dispatching with specific slugs refreshes only those sources.

The retry (`SCRAPE_MAX_ATTEMPTS`) and success-rate (`MIN_SCRAPE_SUCCESS_RATE`) policy in `scrapers/src/run-policy.ts` belongs to the legacy Supabase scraper (`npm run scrapers:scrape`) and is not used by the scheduled refresh.

## Next Steps From The Product Plan

The approved implementation plan is preserved in [PLAN.md](PLAN.md). Current deferred work and priorities live in [TODOS.md](TODOS.md), and shipped releases are recorded in [CHANGELOG.md](CHANGELOG.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and pull-request workflow.

## D1 catalog refresh

The daily catalog refresh runs on GitHub Actions at 03:00 Istanbul using the scoped `CLOUDFLARE_D1_API_TOKEN` secret. Cloudflare cron is disabled. See [the data pipeline runbook](docs/free-catalog-refresh.md) for source coverage, quota recovery and verification.
