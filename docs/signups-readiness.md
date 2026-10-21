# Signup readiness plan

Status on 2026-10-20: **signups stay off.** This is a plan, not a switch. Nothing here turns `SIGNUPS_ENABLED` on, sends mail or collects an address. It lists what must be true first, who does it and how to check it. The mechanics of the switch itself are in `docs/launch-day.md`, Part B. The legal parts are questions of fact for the owner and a lawyer, not legal advice.

**Hard rule.** No lead is collected and nothing is sent until the sole proprietorship (şahıs şirketi) is registered **and** every box below is ticked. Registration comes first because the data controller named on the privacy page, the sender identity in every email and the İYS and VERBİS answers all depend on it.

## What the code does today (checked 2026-10-20)

- **Switch.** `src/lib/signups.ts:5` returns true only for the exact string `"true"`. `wrangler.production.jsonc:55` is `"false"`. `.env.example:12` is `false`. Every form is wrapped in `signupsEnabled()` (home, footer, catalog, deals, new, quiz result, saved list, roaster, coffee, issue pages).
- **Endpoint refuses when off.** `src/lib/v2-subscribe.ts:156-160` answers "kayıtlar kapalı" before any validation, rate limit or Kit call.
- **Staging was different.** Until 2026-10-20 `wrangler.jsonc` had `SIGNUPS_ENABLED: "true"` with a live Kit key, so the staging form worked for anyone who found it (`noindex`, but public). It is now `"false"` (item C8).
- **Signup is not a broadcast.** The signup path creates a Kit subscriber as `inactive` (`v2-subscribe.ts:133`) and attaches it to form 9918321 (`:146`). Kit's own confirmation email goes out at that moment. That is the one email the code can cause, and only when signups are on.

## Code (Claude)

**C1. Consent fields are written, and a rejection fails the signup.** Done 2026-10-21. The create call sends `consent_at` (server time, ISO) and `consent_version` (`'2026-10-v1'`, `src/lib/brand.ts:61`) in `subscribeWithKit` (`src/lib/v2-subscribe.ts`). If Kit answers 400 or 422 (fields not created), the signup fails with the form's error message (502, `provider_error`) and the route logs `subscribe_provider_failure` with the stage and status; Kit is not asked again without the fields. Before this, the code retried without them and accepted the signup with no proof of consent. `tests/v2-subscribe.test.ts` pins the new behaviour for both statuses.
- Also decide: Kit's create call is an upsert. Check on a test address whether resubmitting overwrites `consent_at` of an already-active subscriber. If it does, send the fields only when the subscriber is new, or store the first consent time.
- Verify: with the owner's O1 done, a test signup shows both fields filled in Kit (see O1).

**C2. Consent wording matches what is stored.** The checkbox text is `newsletterConsent.text` (`brand.ts:62`), rendered at `src/components/v2/newsletter-form.tsx:36,80`; the stored version is `newsletterConsent.version`. Nothing forces the two to change together (comment at `brand.ts:59` is the only guard).
- Change needed: add a test that pins the text to its version (hash or literal), so edits to the sentence fail until the version is bumped.
- Change needed after O4/O5: the sentence must match the final purposes (monthly issue, weekly digest, any sponsor block) and, if the lawyer asks, name the transfer. Bump the version when it changes.
- Verify: test passes; the text on the form, the "Bülten aboneliği" section of `src/app/privacy/page.tsx:99-121` and the Kit custom field value all name the same two sends.

**C3. Legal identity after registration.** `src/lib/legal.ts` still names "bağımsız yazılım stüdyosu Basalt (hellobasalt.dev)". Once the proprietorship exists, `DATA_CONTROLLER`, `CONTACT_EMAIL` and `LEGAL_UPDATED` need the registered trade name and the contact the lawyer approves. Do not put the owner's personal name or home address in code, commits or PRs; if a postal address is required, the owner supplies a business one. Verify: privacy page and terms show the new name; `npm test`.

**C4. Transfer wording on the privacy page.** `privacy/page.tsx:156-159` says Cloudflare and Kit process data abroad under m.9 but names no mechanism. After O3 is decided, write the real one (standard contract signed with whom, or not), without claiming more than was done. Verify: owner and lawyer read the final text.

**C5. Code only creates drafts: confirmed.** The only Kit calls in the repo are `src/lib/v2-subscribe.ts:116` (subscribers, forms) and `scripts/v2-digest.mts:131` (broadcasts). Broadcasts are built only by `kitDraftRequest` (`v2-digest.mts:136-141`): `send_at: null`, `public: false`, and a guard that throws if `send_at` is not null (`:140`). Callers: weekly digest (`:229`, `.github/workflows/digest.yml:38`) and monthly issue (`createIssueDraft`, `:170-177`, `.github/workflows/monthly-issue.yml:68`). Test: `tests/v2-digest.test.ts:52`. No code path schedules or sends. Keep it that way: a review item for any PR touching these files is "does `send_at` stay null". Verify: `grep -rn "api.kit.com" src scripts workers shared` shows only the two files above.

**C6. Privacy page "on" state reviewed.** Render `/privacy`, `/terms`, `/tesekkurler`, `/bulten` with the switch on in a local run (not staging, not production) and read every changed sentence once. Verify: screenshots or text diff attached to the PR that flips the switch.

**C7. Second-order checks once on.** The success event `newsletter_signup_success` (`v2-subscribe.ts:202`) carries no email. Confirm that stays true. Verify: `tests/v2-analytics.test.ts` and the Worker logs show no address.

**C8. Staging.** Done 2026-10-20: staging `SIGNUPS_ENABLED` is `"false"` in `wrangler.jsonc` and on the deployed staging Worker, so no stranger's address reaches Kit. `tests/production-config.test.ts` pins it. Turn it on only for the owner's own end-to-end test (O5), then off again.

**C9. Flip the switch last.** One PR changes `wrangler.production.jsonc:55` to `"true"`, referencing this checklist with every box ticked; the owner merges and deploys (`launch-day.md`, Part B). Not before.

## Owner (Boss)

**O1. Kit custom fields.** In Kit: Subscribers, custom fields, create `consent_at` and `consent_version` (exact names). Verify: after C1, one signup with the owner's own address shows both fields filled on that subscriber; `subscribe_provider_failure` with stage `create_subscriber` does not appear in the Worker logs.

**O2. Branded sender and DNS.** Findings from `dig` on 2026-10-20:
- `hellobasalt.dev` TXT: `v=spf1 include:_spf.mx.cloudflare.net ~all` (Cloudflare Email Routing only, no Kit) and a Google site verification record.
- `_dmarc.hellobasalt.dev` TXT: `v=DMARC1; p=none; rua=mailto:hello@hellobasalt.dev; fo=1` (monitoring only, no enforcement).
- MX: `route1/2/3.mx.cloudflare.net` (Email Routing; receiving only).
- No Kit DKIM selector is documented in the repo, and none of the common selector names (`cka`, `k1`, `k2`, `default`, `google`, `selector1/2`, `mail`, `kit`) resolves under `_domainkey`. So Kit sending is not set up yet. No CAA records.
- To do: in Kit, add the sending domain and a branded address (for example a `newsletter@` or `mektup@` on hellobasalt.dev, owner's choice). Kit shows the exact DNS records; add them in Cloudflare DNS exactly as shown (do not guess selectors). Keep one SPF record: if Kit asks for an SPF include, merge it into the existing TXT, never add a second. Keep DMARC at `p=none` until the first sends pass, then the owner decides on `quarantine`.
- Note: Kit requires a postal address in every email footer. Use a business address, not a home address.
- Verify: Kit shows the domain verified; `dig +short CNAME <selector>._domainkey.hellobasalt.dev` returns Kit's value; a test confirmation email to the owner's own inbox shows "signed-by" and "mailed-by" as hellobasalt.dev and passes SPF, DKIM and DMARC in the message headers. Add the verified selector names to `docs/kit-setup.md`.

**O3. KVKK m.9 cross-border transfer (needs the owner and probably a lawyer to confirm).** Facts: Cloudflare processes every visitor's connection data now; Kit (ConvertKit LLC, USA, per `privacy/page.tsx:151`) would hold subscriber emails. Both are outside Türkiye. Summary of the law as the repo understands it, to be confirmed: KVKK m.9 was rewritten by Law 7499 (art. 34; in force 1 June 2024). A transfer abroad needs an adequacy decision (none to rely on for the USA that we know of) or one of the appropriate safeguards in m.9. The relevant safeguard for a small controller is the Board's **standard contract**, which must be signed and **notified to the Authority within five business days of signing** (m.9, fifth paragraph; the Authority has an online notification module). Explicit consent is no longer a general basis; it remains only for **occasional** (non-recurring) transfers when no safeguard exists. A weekly and monthly newsletter is recurring, so consent alone is likely not enough for Kit. Questions for the lawyer:
1. Does the proprietorship, as controller, have to sign the standard contract with Kit and with Cloudflare (as processors/recipients), and will they sign it? Check each vendor's data processing addendum (Kit: `https://kit.com/dpa`) for a Turkish clause.
2. If a vendor will not sign, what is the lawful route for subscribers' emails, and is the fallback explicit consent acceptable at all here?
3. Is VERBİS registration needed for a one-person business of this size, or is it exempt?
- Verify: signed contract(s) and the notification receipt filed; C4 wording matches.

**O4. İYS review (question for the owner and lawyer, not an answer).** Facts to hand over:
- The weekly digest lists price drops, new arrivals and restocks, each linking to the roaster's product page; KahveDrop sells nothing and takes no commission today.
- The monthly issue holds the owner's picks, scene news and events. A sponsor slot exists in code but is off (`NEXT_PUBLIC_SPONSORSHIPS_ENABLED`); the plan is to sell it from about 500 subscribers (`docs/marketing-plan.md`, section 7).
- Recipients opt in through a checkbox plus Kit's confirmation click; Kit stores the time and wording version (C1).
- The privacy text already says the newsletter "may count" as a commercial electronic message (`privacy/page.tsx:118-119`).
Questions: (a) Is an issue with no promotion at all a commercial electronic message under Law 6563 (m.6) and its regulation, or only once it carries a sponsor or promotes a roaster? (b) Does the price-drop digest, which points to third-party goods, count even without payment? (c) If yes: İYS registration before the first send, how consent is recorded there, and whether the Kit double opt-in record is accepted as proof. (d) What changes the day a sponsor block is added? Also ask what the sender identity and opt-out line in each email must contain.
- Verify: written answer from the lawyer saved by the owner (not in this public repo). If İYS applies, C2 and the privacy text change before launch.

**O5. Aydınlatma metni and double opt-in.** Owner reads the privacy page's "Bülten aboneliği" section with the final trade name and confirms it matches the checkbox (C2) and what Kit stores. Double opt-in is configured in Kit, not in code: form 9918321 must have confirmation on and auto-confirm off (`docs/kit-setup.md` line 3 says it was so on 2026-09-14). Verify in Kit's form settings, then with a test: submit the owner's own address, confirm that the subscriber is `inactive` until the emailed link is clicked, then `active`, with `consent_at` and `consent_version` set. The confirmation email text should be Turkish and carry the final brand and sender. Before any digest is sent, check the draft's recipients are confirmed subscribers only.

**O6. Registration and accounts.** Register the şahıs şirketi; give the final trade name and contact to C3; keep the Kit account under that identity (the marketing plan, "Portfolio note", suggests a neutral name). Verify: tax registration document in hand.

**O7. Secrets.** `KIT_API_KEY` as a Worker secret on production (`launch-day.md` step B4), never in git. Verify: `npx wrangler secret list --config wrangler.production.jsonc` shows the name.

## Order

1. O6 registration. 2. O3 and O4 with the lawyer (long lead time). 3. O1 and O2 in Kit and Cloudflare DNS. 4. C1, C2, C3, C4, C8 in code. 5. O5 end-to-end test with the owner's own address (staging, signups on for that test only). 6. C6 review, then C9 flip, with the owner's explicit go.

## Open until answered

The names of the legal entity and sender address; whether Kit and Cloudflare will sign the standard contract; the İYS answer; whether VERBİS applies. Do not guess any of these.
