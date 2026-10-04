# Crawl relay for shops that refuse GitHub's network

Coffeerem and Sezy return HTTP 403 to the scheduled GitHub job but answer Cloudflare's network normally, and their robots.txt allows crawling. They are marked `runsFrom: 'relay'` in `scrapers/src/roasters/configs.ts`. For those sources the refresh sends each request to `/relay` on the crawler Worker, which fetches the page and hands it back. Parsing and database writes still happen in the GitHub job, so the Worker stays within the free plan.

The relay (`shared/v2/relay.ts`) is deliberately narrow:

- it fetches only the hosts of sources marked `runsFrom: 'relay'`, over https, with GET;
- it requires the shared token;
- it always sends the crawler's own identity (`CRAWLER_HEADERS`) and passes back only the status, content type, redirect location and retry-after.

## Setup

One shared token, set on both sides (generate it once; it is never stored in the repo):

- GitHub secret `CRAWL_RELAY_TOKEN`
- Worker secret `RELAY_TOKEN` on `coffeedb-v2-crawler-staging`

Without the token the refresh fetches those shops directly, which fails from GitHub and works from a home connection.

## Moving a source back

Remove `runsFrom: 'relay'` from its config once the shop accepts requests from GitHub again.
