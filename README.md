# KahveDrop / TR CoffeeDB

KahveDrop runs on Cloudflare Workers/D1 through vinext, with a Three.js coffee studio and a Turkish coffee discovery catalog. The original Next/Supabase paths remain for rollback. The product goal is simple: help buyers compare beans across roasters without opening a dozen separate storefronts.

## Choosing a coffee

- Search by coffee, roaster, origin or tasting note; narrow the catalog by brewing method, flavor, process, roast and decaf preference.
- Cards show the roaster’s actual package price and weight. Sort by package price or newest.
- Select up to three coffees to compare prices and published attributes side by side. The selection stays in this browser; comparison URLs can be shared and always load current public records.
- The coffee guide explains label terminology and includes adjustable starting recipes for filter, espresso, French press and AeroPress, with original sources. Espresso quantities describe beverage yield, not brewing water.
- Catalog checks and update timestamps are internal. Public views retain roaster-declared harvest, roast dates and SCA facts. Data-source errors are shown separately from empty results.

## What Is In This Repo

- `src/app`: Next.js App Router pages for the catalog, coffee journeys, rankings, quiz, roasters, and click tracking.
- `src/components`: shared UI, coffee cards, journey evidence, filters, and quiz flow.
- `src/lib`: Supabase clients, lot-journey and ranking logic, queries, constants, and shared types.
- `scrapers`: Node-based scraper pipeline and migration helper.
- `supabase/migrations`: canonical coffee-lot and supply-chain schema, evidence policies, indexes, functions, and seed data.

## Requirements

- Node.js 22
- npm 10+
- A Supabase project for app data and scraper writes

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

## Scraper Workflow

- Use `npm run scrapers:migrate` to apply the SQL files in [`supabase/migrations`](supabase/migrations).
- Migration connections verify TLS certificates. If your pooler connection reports a
  self-signed certificate chain, download the Server root certificate from Supabase
  Database Settings and set `SUPABASE_DB_SSL_CA_FILE` to its absolute path.
- Use `npm run scrapers:scrape` to run all configured scrapers.
- Use `npm run scrapers:scrape -- --roaster <slug>` when you only want one roaster.
- GitHub Actions also runs [`.github/workflows/scrape.yml`](.github/workflows/scrape.yml) on a schedule or manual dispatch.
- Scheduled scrapes tolerate known external runner failures for roasters that
  preserve existing availability on failure. Dispatching a specific roaster slug
  remains a hard probe and should fail if that adapter is broken.

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

The database job installs `uuid-ossp` in Supabase's `extensions` schema before replaying every migration. It exercises the journey trigger as `service_role`, so a function search-path regression fails CI before reaching scheduled ingestion. The image-health audit also fails if there are no current coffees; an expired empty catalog is not healthy.

The web job persists `.next/cache` between runs so unchanged work can be reused by
subsequent Next.js builds.

Scheduled catalog refreshes use a health gate instead of requiring every external
storefront to respond perfectly in the same run:

- broad scheduled or manually dispatched refreshes retry a failed roaster once
- at least 90% of attempted roasters must succeed
- failed roasters are still emitted as GitHub warnings and listed in the run summary
- a manual dispatch for specific roaster slugs remains a strict probe and fails if any
  requested roaster fails
- the image-health audit still runs after a degraded scrape so the workflow reports both
  ingestion and public-catalog health

## Next Steps From The Product Plan

The approved implementation plan is preserved in [PLAN.md](PLAN.md). Current deferred work and priorities live in [TODOS.md](TODOS.md), and shipped releases are recorded in [CHANGELOG.md](CHANGELOG.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and pull-request workflow.

## D1 catalog refresh

The daily catalog refresh now runs on GitHub Actions at 03:00 Istanbul using the scoped `CLOUDFLARE_D1_API_TOKEN` secret. Cloudflare cron is disabled. See [the data pipeline runbook](docs/free-catalog-refresh.md) for source coverage, quota recovery and verification.
