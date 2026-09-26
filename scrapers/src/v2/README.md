# Safe source adapters

`crawlRoaster(config, options)` returns a bounded source snapshot without database access or executing source JavaScript. Failed and partial crawls never reconcile catalog state. Complete discovery requires every catalog page and variant; unknown values remain unknown.

Shopify, Woo Store API, Parsa, paginated IKAS, and the reviewed custom storefront paths are supported. The authoritative enabled-source list is `shared/v2/qualified-sources.ts`. Cho's identified crawler is still blocked with HTTP 403 and remains unqualified.

GitHub Actions runs daily at 03:00 Istanbul using the shared atomic D1 ingestion path. The old Cloudflare cron is disabled. See `docs/free-catalog-refresh.md` for evidence, quota limits, recovery and verification still required after reset.

Run `npm test` or `npx tsx --test tests/v2-adapters.test.ts` from the repository root. Fixtures prove format contracts; live source qualification additionally requires full snapshot review and successful ingestion replay.
