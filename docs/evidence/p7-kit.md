# P7 native Kit signup evidence

Verified 2026-09-14 21:33 UTC. No owner address, credential or provider response body is retained in this report.

## Actual integration

The owner-authorized address was entered in the native local WebKit form. After correcting the runtime issue below, the actual POST `/api/subscribe` returned **200 in 962 ms at 21:33:08 UTC**, and the generic confirmation instruction appeared. Root's browser evidence is `.playwright-cli/page-2026-09-14T21-33-08-379Z.yml`; treat local browser artifacts as private because form inputs may contain the authorized address.

Read-only Kit checks after success:

| Check | Result |
|---|---|
| Exact authorized subscriber lookup | HTTP 200; one matching record |
| Subscriber state | inactive |
| Membership in form 9918321 | present |
| State on form membership | inactive |
| Additional signup POSTs during diagnosis | none |
| Email/credential written to project evidence | none |

The inactive state is expected: confirmation is enabled and auto-confirm is off. At this initial checkpoint inbox delivery and confirmation were still pending; the later confirmed-completion section below supersedes that status. Production-domain delivery remains unverified. No broadcast was sent.

## Runtime defect and repair

The initial form attempt returned 502 in about 390 ms; a second controlled attempt failed in 81 ms. Safe diagnostic fields identified `create_subscriber`, no HTTP status, and `network`. A temporary localhost-only diagnostic performed **GET forms**, not a subscriber write, from the actual Worker runtime. It produced a TypeError stating that Workers supports redirect values `follow` and `manual`, and does not implement `error`. Thus the failing request did not reach Kit.

The provider now uses manual redirects and an explicit status allowlist; 3xx responses are rejected without following Location or forwarding the API key. The same native read-only request then returned 200. The temporary GET handler was removed and verified to return 405. A source scan found no remaining `redirect: error` in new V2 frontend/server/shared/crawler code.

During diagnosis, official Kit documentation also showed a valid **202 create-subscriber response** that the original implementation rejected. The implementation now accepts 202 only when the returned subscriber ID and state are valid; incomplete or malformed responses fail safely before form association. This was a compatibility correction, not the proven cause of the observed network failure.

## Automated checks

`node --import tsx --test tests/v2-subscribe.test.ts`: **10 tests passed**. Tests use fabricated addresses and an injected provider; no real emails are sent. Covered behavior:

- New inactive creation without first-name overwrite, then exact form association.
- Existing active/inactive states and idempotent repeated association.
- Cancelled/bounced/complained suppression with generic public response.
- Valid 202 handling and rejection of malformed subscriber identity/state.
- Worker-compatible redirect handling across 301/302/303/307/308.
- Exact same-origin requests, JSON MIME, byte-bounded bodies and valid email syntax.
- Fail-closed configuration/limiter, rate response, honeypot and minimal safe referrers.
- Provider errors, timeout and diagnostic fields without email/key/body leakage.

Targeted ESLint and standalone TypeScript checks passed. No build or type generation was run while the local dev server was active.

The runtime error diagnostic is limited to stage, numeric HTTP status or null, and an enumerated category. Public responses never expose that diagnostic or provider state. Requests retain no local email record.


## P8 signup-success hook

The server's accepted branch now emits through `shared/v2/analytics.ts`. Only `newsletter_signup_success`, a whitelisted page and a whitelisted placement source are provided. Repeated accepted requests count as repeated accepted requests; confirmation and unique-subscriber counts must come from separate provider evidence. Suppressed/honeypot/provider-error outcomes do not emit. The tenth mocked test proves sensitive input/referrer data does not reach telemetry and a throwing analytics writer leaves signup successful. No additional real subscriber request was made for this hook.

## Confirmed completion

The owner subsequently reported receiving the confirmation email and clicking its confirmation button. A targeted read-only Kit subscriber GET returned HTTP 200 and state active. No additional signup POST or programmatic activation was performed. This completes local browser→Kit→email→ownerconfirmation→active-state evidence. The subsequent deployed staging form and persisted signup events also passed; see [P9 integration evidence](p9-integration.md).
