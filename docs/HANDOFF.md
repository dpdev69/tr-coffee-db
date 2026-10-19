# Handoff — 2026-10-05

Start here. This file is the current state. [launch-day.md](launch-day.md) is the production checklist, [read-budget.md](read-budget.md) explains the database read budget and its staging checks, [monthly-issue.md](monthly-issue.md) is the newsletter workflow, and [marketing-plan.md](marketing-plan.md) is the go-to-market plan. [v2-handoff.md](v2-handoff.md) is a 2026-09-15 snapshot and is stale.

## Where things are

- **Repo:** `dpdev69/tr-coffee-db` (private). Everything is on `main` (pull requests 15 to 36), CI green, 452 tests.
- **Staging:** https://coffeedb-v2-web-staging.hellobasalt.workers.dev runs `main`. It tells search engines not to index it. Signup is on there.
- **Production:** does not exist. Configuration is ready (`wrangler.production.jsonc`, `wrangler.crawler.production.jsonc`) with placeholders, and `npm run deploy:production` refuses to run until they are filled.
- **Catalog:** 42 qualified sources, about 490 listed coffees. The nightly refresh is GitHub Actions `scrape.yml`; GitHub starts it around 02:30 to 03:00 UTC, not at its scheduled midnight.
- **Stack:** Next 16 App Router through vinext on Cloudflare Workers, D1 on the **free plan**, Kit for email. The crawler Worker's cron and queue path stay off.
- **Legacy:** the old Vercel project `tr-coffee-db` is disconnected from GitHub but its last deployment is still online. `/Users/me/Documents/claude/projects/coffee` is an obsolete v1 copy; ignore it.

### State of the staging database at the time of writing

On 2026-10-05 the database exceeded the free plan's 5 million rows-read daily allowance (26.8 million in 24 hours) and Cloudflare refused reads until 00:00 UTC. The cause was the catalog page recounting all 28 landing pages on every view, with nothing cached, while agents tested against staging. The fix is merged (pull requests 35 and 36), but **three things could not be done while the database was cut off** and are the first items under "Next work".

## Owner decisions (do not reverse without asking)

- **No animation** and no three.js. Only plain hover colour changes.
- **No price per 100 g** anywhere in the interface. Tests forbid it.
- **Palette "İznik"** (porcelain, cobalt, coral) and Bricolage Grotesque for headings. Change colours only through the tokens at the top of `src/app/globals.css`.
- **Free database plan.** Do not propose the paid plan as a fix.
- **No scheduled work on the owner's Mac.**
- **Newsletter:** a monthly editorial issue ("KahveDrop Mektup") plus the automated weekly digest. Code only ever creates Kit drafts.
- **Production lives at `kahve.hellobasalt.dev`** under the Basalt studio (footer credit, `studio` in `src/lib/brand.ts`), and launches with **signup hidden** (`SIGNUPS_ENABLED`, default off).
- **Never disguise the crawler.** No spoofed browsers, proxies or rewritten client addresses. A block is solved by asking the roaster.
- **Agents must not load-test or crawl staging.** For realistic local data use the dump at `.local/backups/staging-pre-0007.sql` (git-ignored) with migrations 0007 and 0008 applied on top.
- The brand name **KahveDrop is provisional**; it lives in `src/lib/brand.ts`.

## What was built on 2026-10-04 and 2026-10-05

| Area | What |
|---|---|
| Data pipeline | Manual corrections that survive crawls (`data/corrections.json`), per-offer failure isolation, roasters synced from `configs.ts`, bag sizes grouped into one coffee, offers hidden after 7 days unconfirmed, attributes taken only where the roaster states them, IKAS tasting-note fields read |
| New arrivals | One definition of a genuine new arrival (`GENUINE_NEW` in `shared/v2/catalog.ts`, 30-day window) used by `/yeni`, the badge, home counts, both emails and issue pages |
| Sources | 42 qualified. Added and qualified: Caffe Di Toee, Coffee Sapiens, Lot Coffee, Mayard |
| Design | İznik palette, fluid layout from 320 to 2200 px, 21 visual flaws fixed, phone menu, desktop search, filter chips |
| Discovery | Ranked quiz with reasons (`shared/v2/quiz-rank.ts`, `/quiz/sonuc`), saved list (`/listem`), coffee of the day, since-last-visit counts; all device-local, no accounts |
| Newsletter | Signup with consent recorded, signup switch, weekly digest, monthly issue from `content/bulten/YYYY-MM.md` to `/bulten` pages and a Kit draft, sponsor slot built and off |
| Search engines | Descriptions from catalog facts, per-coffee share image, structured data, 27 origin and process landing pages, canonical rules, real 404s |
| Capacity | Six-hour edge cache with nightly purge, nightly shared results (migration 0008), lighter queries, canonical addresses, per-client limit on cache misses, optional global brake, warm-up after purge and deploy |
| Launch | Production configuration and guard, `docs/launch-day.md` |
| Marketing | `docs/marketing-plan.md`; competitors already track prices, so the site leads with taste and editorial |

## Owner to-do

1. **Set the cache purge token** (not set yet). It lets the nightly job clear cached pages so new prices show at once. Without it pages refresh on their own within six hours.
   ```bash
   T=$(openssl rand -hex 32); printf %s "$T" | gh secret set CACHE_PURGE_TOKEN --repo dpdev69/tr-coffee-db; cd ~/Documents/codex/coffeedb/coffee && printf %s "$T" | npx wrangler secret put CACHE_PURGE_TOKEN --config wrangler.jsonc; unset T
   ```
2. **Optional, recommended on the free plan: enable the read brake.** In the Cloudflare dashboard create an API token with "Account Analytics: Read", then store it as the Worker secret `D1_ANALYTICS_TOKEN` (`npx wrangler secret put D1_ANALYTICS_TOKEN --config wrangler.jsonc`). Above 3.5 million rows read in a day the site then stops spending rows on uncached catalog views and keeps the rest for the nightly refresh.
3. **Decide on Coffeerem and Sezy.** They refuse GitHub's network; the relay through our own Worker was refused too. Recommended: mark both inactive in `scrapers/src/roasters/configs.ts`, remove the relay code, and ask them by email. Until then the nightly job reports them as failing every night and their coffees drop off the site.
4. **Address decided (2026-10-17): `https://kahve.hellobasalt.dev`.** KahveDrop is a Basalt project; nothing to buy. Confirm the `hellobasalt.dev` zone is in the same Cloudflare account as the Workers, then follow `docs/launch-day.md`. The name KahveDrop is still provisional.
5. **Legal identity (set 2026-10-18):** `src/lib/legal.ts` names the data controller as "bağımsız yazılım stüdyosu Basalt (hellobasalt.dev)" with support@hellobasalt.dev as the contact, and the privacy and terms pages were rewritten against the code. Still open: the KVKK m.9 transfer mechanism for Cloudflare and Kit, and the İYS review before any sponsored send.
6. **Kit:** create custom fields `consent_at` and `consent_version`, and a branded sender. Then signup can be switched on (Part B of `docs/launch-day.md`). The full gate list, split into code and owner items, is `docs/signups-readiness.md`; signups stay off until the sole proprietorship is registered and it is done.
7. **November issue:** draft pull request 27 has three researched scene items. Write the picks, title and intro, re-check the World Barista Championship item after 25 October, then set `published: true`.
8. **Product calls still open:**
   - Blends and Turkish coffee are hidden by the specialty rule, inconsistently across roasters (Kronotrop "DARK Espresso" hidden, "DARK Filtre" shown).
   - Gourme "Honduras El Jardin (100GR)" is dropped because the shop files it under "Deneme Seti".
   - Share cards now show roasters' product photos; the marketing plan says to ask permission first.
   - The home hero shows live counts instead of the tagline "Türkiye'nin bağımsız kahve rehberi".
   - A coffee can show both "Geri geldi" and "Yeni".
   - `/compare` opened directly shows its empty state even with coffees selected.
   - Campaign tag in emails is the bare month (`2026-11`); `mektup-2026-11` is a one-line change.
   - Whether a sponsor's coffees may appear in that issue's picks (the marketing plan says no; not enforced).
9. **Marketing**, after the domain is live: the plan's week-by-week list. Message the Kahve Kulübü admin and the kahve.one owner privately before anything public. Your account Brokenchemex already has a thread there (12304).
10. **Old Vercel site:** decide whether to delete the project or redirect it to the new domain at launch.

## Next work (for whoever continues)

**First, after 00:00 UTC when the database is back**

1. Apply migration 0008 to staging from `coffee/`: `npm run db:migrate:staging`. It was refused on 2026-10-05 because the database was cut off. Code already deployed works without it but stores no shared results.
2. Run the staging checks under "Rollout" in `docs/read-budget.md`. The ones that matter most:
   - A page goes from uncached to cached: request `/kahveler` twice with `-H 'Accept: text/html'`; `cf-cache-status` should read MISS, then HIT.
   - **The purge works:** `POST /api/cache` with the token returns `{"purged":true}`. This is unproven; it never worked locally. If it fails, a quiet page can show a price about 30 hours old, and it must be fixed before launch.
   - The limit works: about 25 made-up searches in a row give 200s, then 429s. Run it once only; it costs about 140,000 rows.
3. Check the next nightly run's summary: about 80,000 rows read, the purge step, the warm-up listing all stored results.
4. Re-check staging pages on live data: `/yeni` should list about 12 to 15 coffees; home and `/firsatlar` should agree on price drops.

**Before launch**

5. Pull request 36 (the cache-miss guard and the new Worker entry `workers/web.ts`) was verified on staging only for what works without a database, and had **no independent review**. Review it.
6. Rehearse loading a full export into a fresh database and applying migrations. It has never been run (`docs/launch-day.md`, steps 7 and 8).
7. Staging acceptance checks never run in this work: a real Kit signup end to end, analytics events, and the weekly digest against real events.
8. `docs/launch-day.md` step 0 lists the launch gates; keep it in step with this file.

**Backlog**

- Vitus is configured but unqualified: the shop was entirely sold out. Re-check when stock returns.
- Roasters on platforms without an adapter: 3 Cores, Gordion, Eleonora, Old School (all Wix), Kava, ROR, Octagon, Manifesto. One Wix adapter unlocks four.
- Shopify currency is still assumed to be TRY (marked in `scrapers/src/v2/parsers.ts`).
- Data debris at the source: scraper text in some tasting notes, bag sizes and years inside names. The interface hides the worst; fixing the parsers is better.
- Dead Kronotrop images.
- An issue page for a past month can miss arrivals when more than 100 coffees arrived later (marked in the code).
- The Supabase packages and `supabase/` folder are kept only for rollback and the legacy `/compare` query.
- Leftover checkouts `../wt-fluid`, `../wt-visual` and `../wt-integration`, and the branches `fix/fluid-layout` and `fix/visual-pass`, can be removed. The first two were kept because the owner had local servers running from them (ports 3171 and 3151).

## How this codebase wants changes made

- Read `node_modules/next/dist/docs/` before writing Next code; this version differs from common knowledge, and vinext differs again (React's ViewTransition does nothing; a root `loading.tsx` turns 404s into 200s; pages with a query string need the cache header from `next.config.ts`).
- Every concern has one place: `coffeeOnlySql()` and `shared/v2/coffee-eligibility.ts` for what is a coffee, `hydrate()` and the views `public_catalog_coffees` and `current_offers` for what is listed, `truthfulMetadata()` for attributes, the parser's `coffee()` builder for ingestion.
- "Unknown beats wrong": never guess an attribute. Price observations are immutable.
- CI runs Node 22 and `npm run check`, which includes a legacy `next build` stricter than the Cloudflare build: server files must not import client-only modules. Run `npm run check`, `npm test`, `npm run build:cloudflare` and `npm run build:crawler` before a pull request, and **read the CI result before merging**. A failed font download in the legacy build is transient; re-run it.
- D1 refuses LIKE patterns over 50 bytes and rows over 2 MB.
- Wrangler reports an exhausted read allowance as error 7500, and sometimes as 7403 "not authorized".
- Remote steps on staging (migrations, deploys, workflow runs) are pre-approved. Production, anything public, and anything that sends email stop for the owner.
- Deploy staging from `coffee/`: `npm run build:cloudflare && npm run deploy:vinext`, and `npx wrangler deploy --config wrangler.crawler.jsonc` for the crawler. Database backups are in `.local/backups/`.
