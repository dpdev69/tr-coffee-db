# Kit setup

Current evidence: 2026-09-14 21:33 UTC (September 15 in Türkiye). The owner-created Kit account has published inline form **Haftalık Drop**, ID **9918321**, with Turkish copy and only an email field. Confirmation is enabled and auto-confirm is disabled. The original Kit confirmation link and unsubscribe footer were retained. The owner received and confirmed the test email; targeted read-only Kit GET subsequently returned active. Final sender identity/domain remains an owner setup item before public launch.

The V4 key is stored in ignored mode0600 `.dev.vars` and the staging Worker secret; no key or owner email is recorded here. `KIT_FORM_ID=9918321` is public configuration. Never place the key in `NEXT_PUBLIC` variables, client bundles, analytics, git or logs. The native endpoint requires the Kit configuration and `SUBSCRIBE_LIMITER` binding; missing configuration or limiter fails closed.

The server creates/upserts a subscriber with `state: inactive`, omitting first name and custom fields, then associates the returned subscriber ID with the confirmation-enabled form. Existing cancelled, bounced or complained subscribers are not attached or reactivated. Active/inactive submissions use the provider's idempotent form association. The public success message is the same for accepted, suppressed and honeypot requests, so it does not reveal membership. No email is stored in D1.

The provider integration uses an eight-second total deadline and `redirect: manual`, rejecting every redirect response before reading its body or forwarding credentials. Cloudflare's native runtime does not support `redirect: error`; this caused the initial local failures before a request left the runtime. Read-only GET verification from the actual Worker passed after the change. The temporary diagnostic GET route was removed and returns 405. Ongoing error diagnostics contain only a fixed stage, HTTP status and enumerated error category, never provider bodies, addresses or credentials.

## Verification

The owner authorized one signup address. Two initial browser attempts failed before provider HTTP due to the redirect-mode incompatibility. After the fix, the actual local WebKit form returned HTTP 200 in 962 ms at **21:33:08 UTC**. Read-only verification found the authorized subscriber exactly once, state **inactive**, with membership in form 9918321 also **inactive**. This verifies browser → native endpoint → Kit subscriber/form association and preserves the confirmation requirement. The owner subsequently reported inbox arrival and clicking confirmation; targeted read-only Kit GET returned HTTP 200 and active. Unsubscribe delivery and a production deployment remain unverified. No broadcast was sent.

Ten focused mocked-provider tests pass, as do ESLint and standalone TypeScript. The tests cover new/existing/suppressed states, repeated association, documented 202 create responses, manual redirect rejection, origin/JSON/body limits, rate limiting, honeypots, referrer minimization, failures and safe diagnostics. Real cancelled-address and repeated-submission behavior was not tested with additional contacts.

See [P7 evidence](evidence/p7-kit.md). The owner reported confirmation and the subsequent targeted read-only GET returned HTTP 200 with state active; do not submit more addresses or reactivate an inactive subscriber programmatically to manufacture that evidence.

## Provider references

- [Create subscriber](https://developers.kit.com/api-reference/subscribers/create-a-subscriber): upsert leaves existing state unchanged; successful create responses include 200/201/202.
- [Add subscriber to form](https://developers.kit.com/api-reference/forms/add-subscriber-to-form): existing subscribers are attached by ID; an existing association returns 200.
- [Eventual consistency](https://developers.kit.com/api-reference/eventual-consistency): list views may lag writes; ID lookups are strongly consistent.


## Weekly draft digest

`.github/workflows/digest.yml` runs Mondays at 06:00 Istanbul (`0 3 * * 1` UTC) or manually. `scripts/v2-digest.mts` reads D1 over the REST API with the same `listCatalog` 7-day event feeds as the home page (price drops and verified deals, new coffees, restocks; at most 8 each) and builds Turkish HTML and plain-text content linking to `/kahve/<slug>` with `utm_source=kit&utm_medium=email&utm_campaign=haftalik-drop-YYYY-MM-DD`. Every run uploads `digest-preview.html` as a 30-day workflow artifact. With fewer than 3 items it stops without contacting Kit.

Otherwise it creates **one draft** through [Create a broadcast](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast): `send_at: null` (draft), `public: false`, 8 s deadline, `redirect: manual`. It never schedules or sends, and logs only the broadcast ID or HTTP status. The Classic email template adds Kit's unsubscribe link and address footer. The API filters recipients by segment or tag only, not by form, so no `subscriber_filter` is sent: **before sending, the owner opens the draft in Kit, picks the Haftalık Drop recipients (form 9918321 subscribers), reviews the content and sends it manually.**

Repository settings needed (Settings → Secrets and variables → Actions):

- Secret `KIT_API_KEY`: the Kit V4 API key. Without it the workflow builds the preview only.
- Variable `SITE_URL`: the public site origin used in links (falls back to the provisional brand domain).
- The existing `CLOUDFLARE_D1_API_TOKEN` secret is reused; the digest only reads.

Local preview: `npm run digest` with the same `CLOUDFLARE_*` variables writes `.local/v2/digest-preview.html`; it creates nothing in Kit without `--create-draft`.

## Signup telemetry

The server emits `newsletter_signup_success` only after Kit accepts the form association. This counts accepted requests, not confirmed subscribers or unique new subscribers. Suppressed addresses, honeypots and provider failures emit no success event. Only a whitelisted page and placement source are passed to the shared analytics helper; email, referrer, subscriber ID and provider state are excluded. A missing or failing analytics binding cannot fail a successful signup. The telemetry branch passed mocked tests and the later deployed staging form test using the same already-confirmed address. Actual signup-submit and signup-success events persisted in Analytics Engine; see [P9 integration](evidence/p9-integration.md).

## Owner/legal review before public email acquisition

These are unresolved review questions, not a claim of KVKK or commercial-email compliance:

- Does the intended newsletter and any future sponsorship count as commercial electronic communication, and what İYS/consent records and opt-out process are required for its recipients?
- Is the Turkish collection notice complete for the actual data controller, purposes, retention, rights/contact channel and processors?
- What lawful basis and transfer mechanism apply to processing subscriber data in Kit and infrastructure data in Cloudflare outside Türkiye?
- What retention/deletion process should apply to inactive, unsubscribed and suppression records without accidentally resubscribing someone?
- Are the sender identity, postal/contact details, confirmation text and unsubscribe handling correct for the final owned brand/domain?

Resolve with the owner and appropriate legal advice before public campaigns. The implemented confirmation control is technical evidence only; it does not answer these legal questions.
