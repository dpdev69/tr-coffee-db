# Launch day

Written for the owner and whoever runs the launch. Nothing here has been run: no production resource exists yet. Each step says **who** does it (**Owner** in a dashboard, or **Command** to run in a terminal in this repository), **success** (what you should see) and **undo**.

Wherever a step depends on something still open, it says **Not yet decided** or **Not finished**. Do not guess; ask the owner.

Names used below (they are already written into `wrangler.production.jsonc` and `wrangler.crawler.production.jsonc`): web Worker `coffeedb-v2-web`, crawler Worker `coffeedb-v2-crawler`, database `coffeedb-v2`, queues `coffeedb-v2-crawls` and `coffeedb-v2-crawls-dlq`, analytics dataset `coffeedb_v2`. Later, "the placeholders" means every value starting `REPLACE_` in those two files.

## Launch state, decided by the owner

- Production goes live at **`https://kahve.hellobasalt.dev`**, a subdomain of the Basalt studio site (owner decision, 2026-10-17). No domain is bought; KahveDrop is a Basalt project and its footer says so.
- It launches with the **newsletter signup off**: no form anywhere, `/api/subscribe` refuses, and the privacy page does not describe newsletter collection. The reason is that the privacy page still shows a placeholder for the legal data controller. Everything else (catalog, quiz, saved list, issue pages) goes live as is.
- Sponsorships off. The crawler Worker stays disabled (no cron, `CRAWLS_ENABLED=false`) until a first baseline has been verified.

The signup switch is the Worker variable `SIGNUPS_ENABLED` (`"false"` in the production file; staging has `"true"`). Absent or anything other than `"true"` means off.

## Part A. Going live

### 0. Gates: do not start until all are true

1. **Database read allowance.** Not finished: another piece of work is reducing the database's daily reads on the free plan. The launch must not happen until that work is merged and its verdict is known. Not yet decided: whether the free plan is enough for production traffic or the paid plan is needed. Production adds the daily refresh and public visitors on top of the same limits.
2. **This branch** (`feat/launch-prep`) is reviewed and merged to `main`.
3. **Brand name.** Not yet decided: `KahveDrop` is provisional. The name appears in pages and emails; the address `kahve.hellobasalt.dev` does not depend on it. If it changes, build with `NEXT_PUBLIC_BRAND_NAME=...` (and the optional `NEXT_PUBLIC_EMAIL_SOURCE_NAME`, `NEXT_PUBLIC_ANALYTICS_SOURCE`, `NEXT_PUBLIC_BRAND_LOGO`) set in the shell when running step 10, since these are read at build time. Also check the issue name `Mektup` and the weekly `Haftalık Drop` in `src/lib/brand.ts`.
4. **Three roasters cannot be crawled today.** Cho Coffee answers the crawler with HTTP 403 from any network and is marked inactive. Coffeerem and Sezy refuse requests from GitHub's network, where the nightly job runs; a relay through our own Worker was also refused, and running the crawl from the owner's machine was ruled out. No access check is to be bypassed. Not yet decided: whether to mark Coffeerem and Sezy inactive until they allow the crawler. Until then the nightly job reports them as failing and their coffees drop off the site a week after their last successful crawl.
5. Wait for the data-quality state you are happy with. The catalog loaded in step 7 is whatever staging holds at that moment.

### 1. The address
- Decided: `https://kahve.hellobasalt.dev` (https, no trailing slash; the deploy refuses anything else). Nothing to buy. No `www`.

### 2. Confirm the hellobasalt.dev zone is in this Cloudflare account
- **Owner**, dashboard: the zone `hellobasalt.dev` must be listed under Websites in the same account as the Workers (`4c1a4493…`, the one that owns `hellobasalt.workers.dev`), because step 13 attaches the subdomain to the Worker as a custom domain. Also check that no DNS record named `kahve` exists yet; the custom domain creates its own. Success: the zone is **Active** in this account. If it lives in another account, move the Workers or the zone before step 13.

### 3. Create the production database
- **Command** (or **Owner** in Storage & Databases > D1 > Create): `npx wrangler d1 create coffeedb-v2`. Success: the output (or dashboard) shows a database ID. Undo: delete the database (it is empty).
- Put the ID in both files, replacing `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` in `wrangler.production.jsonc` **and** `wrangler.crawler.production.jsonc`. The ID is not a secret.
- Free plan, read replication, region: Not yet decided; follow the read-allowance verdict from gate 1.

### 4. Create the queues
- **Command**: `npx wrangler queues create coffeedb-v2-crawls` and `npx wrangler queues create coffeedb-v2-crawls-dlq`. Success: both appear under Queues in the dashboard. Nothing to copy: queues are referred to by name. Undo: delete both queues.

### 5. Analytics dataset and rate limits
- The Analytics Engine dataset `coffeedb_v2` is created by the first write once Analytics Engine is enabled for the account (it already is for staging). **Owner**: confirm in the dashboard. Nothing to copy. Success is checked in step 11.
- Rate-limit namespaces: the files use `2001` (signup) and `2002` (events) so they never share counters with staging (`1001`, `1002`). These are chosen numbers, not created resources. **Owner/Command**: confirm no other Worker in the account already uses 2001 or 2002.

### 6. Web Analytics for the new address
- **Owner**, dashboard: Web Analytics > Add a site for the new hostname. Copy the token (not a secret) into `wrangler.production.jsonc`, replacing `REPLACE_WITH_PRODUCTION_WEB_ANALYTICS_TOKEN`. The hostname `kahve.hellobasalt.dev` is already filled in.
- **Command**: `grep -n REPLACE_ wrangler.production.jsonc wrangler.crawler.production.jsonc`. Success: no output (only comment lines may match). Commit and merge these two files. Undo: restore the placeholders.

### 7. Back up staging and load the catalog into the new, empty database
Follow `docs/cutover-runbook.md`: **never replay anything into a database already in use**. Only load into the database you created in step 3 while it is still empty.
- **Owner**: GitHub > Actions > "Back Up D1 Catalog" > Run workflow (or **Command**: `npx wrangler d1 export coffeedb-v2-staging --remote --output d1-backup.sql`). Success: an artifact `d1-backup-<run>` (or the file) exists. This only reads staging. (The export is a one-off read of the whole database: count it against the read allowance from gate 1.)
- **Command**: download and `gunzip` the artifact, then `python3 -I scripts/d1-import-order.py d1-backup.sql d1-import.sql` and `npx wrangler d1 execute coffeedb-v2 --remote --file d1-import.sql --config wrangler.production.jsonc`. Loading the raw export fails with "FOREIGN KEY constraint failed" (a coffee can point at a later coffee; done this way on 2026-10-17).
- Success: row counts for coffees, offers and roasters match staging (run the same `SELECT COUNT(*)` on both with `npx wrangler d1 execute <name> --remote --command "..."`).
- Undo: delete the production database and repeat steps 3 and 7 with a fresh one. Do not try to repair a half-loaded database.
- Not yet decided: whether a last sync from the legacy Supabase source is still needed (the cutover runbook mentions one; the daily refresh now writes straight to staging, which makes staging the current copy). This plan assumes staging is the source. Not rehearsed on a scratch database; consider a rehearsal.

### 8. Apply migrations
- **Command**: `npm run db:migrate:production`. The export in step 7 carries the table definitions and the migration ledger, so expect it to report **nothing to apply**, or to apply only migrations newer than staging's. Check first with `npx wrangler d1 migrations list coffeedb-v2 --remote --config wrangler.production.jsonc`. Success: the list shows every file in `migrations/d1` as applied. This script refuses to run while a placeholder remains.
- Undo: migrations are forward only. If one went wrong, delete the database and redo from step 3.

### 9. Deploy the crawler Worker (disabled)
- **Command**: `npm run deploy:crawler:production`. Success: the Worker `coffeedb-v2-crawler` appears; `CRAWLS_ENABLED` is `false`, there is no cron. It stays disabled until a first baseline is verified: that is a separate later decision, not part of this launch. Undo: delete the Worker in the dashboard.
- It exists now mainly for the crawl relay used by the daily refresh (`docs/crawl-relay.md`).

### 10. Deploy the web Worker
- **Command**: `NEXT_PUBLIC_SITE_URL=https://kahve.hellobasalt.dev npm run deploy:production`. It checks for placeholders and the address, builds with the production file, checks the built output again, then deploys with the address as both a build-time and a runtime setting. Success: deploy output names `coffeedb-v2-web`; it shows the `workers.dev` address. If it prints "Production deploy refused", read the list it prints and fix those values; nothing was deployed.
- Undo: `npx wrangler rollback --config wrangler.production.jsonc` for a bad version; or delete the Worker.
- After launch, every merge to `main` deploys by itself: Workers Builds on `coffeedb-v2-web` runs `npm run ci:build` then `npm run ci:deploy` (the same guard, build, deploy and warm-up, with `NEXT_PUBLIC_SITE_URL` set as a build variable). A failed warm-up only prints a line; the deploy stands. Check a merge went live with `npx wrangler deployments list --name coffeedb-v2-web` or the build log in Workers & Pages > `coffeedb-v2-web` > Deployments. The hand command above still works for a redeploy without a merge.

### 11. Secrets
Never type or paste a secret value into this document, a ticket, a chat or a command argument. Each command below prompts for the value.
- **Command**, crawler: `npx wrangler secret put RELAY_TOKEN --config wrangler.crawler.production.jsonc` (the same shared value as the GitHub secret `CRAWL_RELAY_TOKEN`).
- The web Worker needs **no** secret while signups are off. `KIT_API_KEY` is added in Part B.
- GitHub repository secrets already used by the workflows (`CLOUDFLARE_D1_API_TOKEN`, `CRAWL_RELAY_TOKEN`, `KIT_API_KEY`): **Owner** confirms the API token covers the production database (same account, D1 Edit).
- Success: `npx wrangler secret list --config wrangler.crawler.production.jsonc` lists `RELAY_TOKEN` (names only). Undo: `npx wrangler secret delete`.

### 12. Verify on the Worker's own address (before the domain points anywhere)
- **Owner/Command**: open the `workers.dev` address printed in step 10 (call it `$BASE`). Success criteria, all of them:
  1. `/`, `/kahveler`, one `/kahve/<slug>` page, `/kavurucular`, one `/kavurucu/<slug>` page, `/yeni`, `/firsatlar`, `/quiz` (finish it to `/quiz/sonuc`), `/listem`, `/guide`, `/bulten`, `/privacy`, `/terms` all load with catalog data and no error banner.
  2. **No signup form anywhere**: no "Abone ol" button, no email field, no newsletter heading or empty gap, including the footer. `/tesekkurler` says signups are closed. `/privacy` has no "Bülten aboneliği" section.
  3. **Signup endpoint refuses**: `curl -s -X POST -H "Origin: $BASE" -H "Content-Type: application/json" -d '{"email":"a@b.test","consent":true}' $BASE/api/subscribe` answers HTTP 200 with `{"ok":false,"message":"Bülten kayıtları şu anda kapalı. ..."}`.
  4. **Purchase redirect**: click "buy" on a coffee (or `curl -sI $BASE/go/<offerId>`): a 3xx to the roaster's own shop.
  5. **Sitemap**: `curl -s $BASE/sitemap.xml` lists addresses beginning with your final domain (not `workers.dev`) and includes coffee pages.
  6. **Search engines allowed**: `curl -s $BASE/robots.txt` shows `Allow: /` (and `Disallow: /api/`, `/go/`, `/compare`) and a `Sitemap:` line; page source has no `noindex`. (Staging shows `Disallow: /` and `noindex`; production must not.)
  7. After a few visits, an event appears in the `coffeedb_v2` dataset (dashboard > Analytics Engine; this needs the visitor to accept analytics cookies).
- Undo: nothing public yet.
- Note: the `workers.dev` address is also open to search engines but its pages name your domain as canonical. Optional: disable it in the Worker's Domains & Routes settings once the domain works.

### 13. Point the domain at the Worker
- Done on 2026-10-17 with `wrangler deploy --domain kahve.hellobasalt.dev`. `npm run deploy:production` now passes the same flag on every deploy, so the domain stays attached; that deploy also leaves the `workers.dev` address off, since the config does not enable it. Undo: remove the custom domain in Workers & Pages > `coffeedb-v2-web` > Settings > Domains & Routes.

### 14. Permanent redirects from the old addresses
- **Old site** `tr-coffee-db.vercel.app`: **Owner**, in the Vercel project's Domains settings, redirect it to the new domain as a permanent (308) redirect (or add a catch-all permanent redirect in the old project's `vercel.json`). Success: `curl -sI https://tr-coffee-db.vercel.app/` shows 308 and `location:` on the new domain; old paths such as `/coffees` and `/roasters` reach working pages. Undo: remove the redirect in Vercel. Do this only after step 13 works.
- **Staging address** (`coffeedb-v2-web-staging.hellobasalt.workers.dev`): Not yet decided and not built. A `workers.dev` address cannot carry a Cloudflare redirect rule, so a permanent redirect would need a code change to the staging Worker, and it would end staging as a test site (which also keeps signups on). Staging already tells search engines to stay away. Decide: leave it as is (recommended), or add a redirect in code.

### 15. Switch the scheduled workflows to the production database
- **Owner**, GitHub > Settings > Secrets and variables > Actions > **Variables**. Each workflow reads these and falls back to staging when a variable is empty:

| Variable | Value | Used by |
|---|---|---|
| `CLOUDFLARE_D1_DATABASE_ID` | the ID from step 3 | nightly refresh, weekly digest, monthly issue |
| `D1_DATABASE_NAME` | `coffeedb-v2` | weekly backup |
| `CRAWL_RELAY_URL` | `https://coffeedb-v2-crawler.<your-workers-subdomain>.workers.dev/relay` | nightly refresh |
| `SITE_URL` | the exact address from step 1 | digest and monthly issue links (already an existing variable) |

- Note: from now on the nightly refresh writes to production, and staging stops being refreshed. Do this right after step 8 so production does not lag behind. Not yet decided: whether to point a scratch workflow at staging to keep it fresh.
- Success: run "Refresh D1 Coffee Catalog" once by hand (wait for the read-allowance verdict first) and confirm its summary is for production, then check the weekly backup run exports `coffeedb-v2`. Undo: delete the four variables; every workflow returns to staging.

### 16. Search Console
- **Owner**: if Search Console already has a domain property for `hellobasalt.dev`, it covers the subdomain; otherwise add a URL-prefix property for `https://kahve.hellobasalt.dev/` (or the domain property, DNS TXT in Cloudflare). Then submit `https://kahve.hellobasalt.dev/sitemap.xml`. Success: verified, and the sitemap shows "Success" with a discovered-pages count. Undo: remove the property. Bing Webmaster Tools is optional.

### 17. Same-day checks
Re-run step 12 on the real domain, view the site on a phone, and watch the dashboard for errors for the first day, including database rows read against the daily allowance.

## Part B. Turning the signup switch on (later, separate)

Do not start until **all** are true:

1. **Legal identity** is set in `src/lib/legal.ts` (done 2026-10-18: Basalt, support@hellobasalt.dev; update `LEGAL_UPDATED` when the wording changes). The open KVKK/İYS/transfer questions in `docs/kit-setup.md` are answered by the owner and their advisers. This file is the owner's to edit.
2. **Two consent fields exist in the Kit account**: `consent_at` and `consent_version` (Kit dashboard > Subscribers > custom fields). Without them, every signup fails with the form's error message and the Worker logs `subscribe_provider_failure` (stage `create_subscriber`, status 400 or 422): the site never accepts a signup without proof of consent.
3. **Branded sender**: a verified sender address and sending domain in Kit (add Kit's DNS records in Cloudflare), and the confirmation email text uses the final brand. Not yet decided: the brand name and sender address.
4. **Secret on the web Worker**: **Command** `npx wrangler secret put KIT_API_KEY --config wrangler.production.jsonc` (prompts for the value; the form ID is already in the file).
5. **Privacy page reviewed** for the "on" wording (it then shows the "Bülten aboneliği" section).

Turn it on:
- **Command**: in `wrangler.production.jsonc` change `"SIGNUPS_ENABLED": "false"` to `"true"`, commit, merge, and run `NEXT_PUBLIC_SITE_URL=https://kahve.hellobasalt.dev npm run deploy:production` again. A deploy is needed: it is a deployment setting, never read from a cookie or header. Many pages are cached for up to about an hour, so the forms may take that long to appear everywhere (the endpoint answers immediately).
- **Test signup** with an address you own: submit the footer form; you land on the thank-you page; the confirmation email arrives from the branded sender; clicking it makes the subscriber active in Kit with `consent_at` and `consent_version` filled and membership in form 9918321; the unsubscribe link in a later email works. Do not repeat it with other people's addresses.
- Success: all of the above, and no error in the Worker logs. Undo: set the value back to `"false"` and deploy again; the endpoint refuses at once, cached pages lose the form within about an hour. Editing the variable in the dashboard instead is overwritten by the next deploy, so always change the file.

## Rollback

- **Site misbehaves after step 13**: remove the custom domain (step 13) and the Vercel redirect (step 14) first so visitors reach the old site again; fix with the Worker still reachable on `workers.dev`.
- **Bad code version**: `npx wrangler rollback --config wrangler.production.jsonc`. This does not restore the database or queues.
- **Workflows**: delete the repository variables from step 15; they return to staging.
- **Signups**: set `SIGNUPS_ENABLED` back to `"false"` and deploy. Kit subscribers stay in Kit; do not roll them back with the catalog.
- **Crawler**: stays disabled; if it was ever enabled, set `CRAWLS_ENABLED` to `"false"` and deploy.
- **Database**: never restore over a database in use, never delete new observations. Make a new empty database from the latest backup (`docs/cutover-runbook.md`), verify its counts, put its ID in the two production files and deploy; or use D1 Time Travel (`npx wrangler d1 time-travel`, last 7 days on the free plan).
