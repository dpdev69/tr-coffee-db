# Environment checklist

| Value/resource | Purpose | Current state |
|---|---|---|
| Node22.23.2 + npm lockfiles | supported build/runtime tooling | verified locally |
| Cloudflare account | staging Workers/D1/Queues | connected owner account |
| D1 DB | canonical catalog | staging5090f52d-546e-4ba6-bdcd-b4ee531a29a3 |
| CRAWL_QUEUE + DLQ | isolated source jobs/retries | staging resources created |
| CRAWLS_ENABLED | explicit scheduler gate | false until baseline acceptance |
| CRAWL_MODE | suppress bootstrap feed events | baseline |
| KIT_FORM_ID | Haftalık Drop form | 9918321 published, email only |
| KIT_API_KEY | server API | uploaded as staging Worker secret; local and deployed signup passed |
| NEXT_PUBLIC_SITE_URL | canonical metadata/UTM origin | staging canonical verified; final owned domain pending |
| public brand config | rename without code-wide edits | provisional KahveDrop |
| ANALYTICS | product event dataset | enabled; all seven event types persisted in staging Studio |
| Cloudflare Web Analytics token | traffic metrics | staging site8e122cb650b5451891d84327f7c98e1e created; host-specific beacon configured; local DNS filter blocks script, traffic receipt unverified |
| SUBSCRIBE_LIMITER/EVENT_LIMITER | platform abuse bounds | bindings configured |
| Supabase service/anon URL/keys | legacy export/rollback | existing files, never committed |
| DNS, sender domain, Kit sender address | public launch/deliverability | final owned domain and verified branded sender pending |

Use Cloudflare secrets for keys, not vars or public env. Existing .env.local and scrapers/.env untouched; .dev.vars ignored and mode0600. Avoid source/email response bodies in exception logs. Never print keys or pass them as command arguments. Confirm exact environment before any secret upload/deploy. No production domain assumed owned.
