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

## The site route: nightly purge and warm-up

Bot Fight Mode on the hellobasalt.dev zone answers GitHub's runners 403 on kahve.hellobasalt.dev (free plan: it cannot be skipped per path), and a zone-level purge does not reach Workers Cache, which belongs to the Worker. So the nightly job's purge and warm-up (`scrape.yml`, `scripts/warm-cache.mts`) go to `/site/<path>` on the crawler Worker (repository variable `SITE_VIA`, default the staging crawler, which is the relay the production refresh uses), and the crawler hands them to the web Worker over the `SITE` service binding (`shared/v2/relay.ts`, `siteRequest`):

- it requires the same shared token as the relay;
- GET and HEAD carry only `Accept` and `RSC`, so no `Authorization` or cookie changes what Workers Cache stores; Workers Cache is keyed by path, not host, so a page stored this way is the page visitors get;
- the only POST is `/api/cache`; the purge token travels as `X-Cache-Purge-Token`, and the web Worker checks it;
- requests name `SITE_ORIGIN`, the site's public address, so nothing the site builds from the request URL names another host.

## Moving a source back

Remove `runsFrom: 'relay'` from its config once the shop accepts requests from GitHub again.
