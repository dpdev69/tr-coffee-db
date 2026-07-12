# TR CoffeeDB

TR CoffeeDB is a Next.js and Supabase app for discovering specialty coffees from Turkish roasters. The product goal is simple: help buyers compare beans across roasters without opening a dozen separate storefronts.

## What Is In This Repo

- `src/app`: Next.js App Router pages for the catalog, quiz, roasters, and click tracking.
- `src/components`: shared UI, coffee cards, filters, and quiz flow.
- `src/lib`: Supabase clients, queries, constants, and shared types.
- `scrapers`: Node-based scraper pipeline and migration helper.
- `supabase/migrations`: schema, policies, indexes, functions, and seed data.

## Requirements

- Node.js 22
- npm 10+
- A Supabase project for app data and scraper writes

Use the checked-in [`.nvmrc`](.nvmrc) to align local and CI Node versions.

## Local Setup

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
   npm run dev
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
