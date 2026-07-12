<!-- /autoplan restore point: /Users/me/Documents/codex/coffeedb/coffee/.gstack/autoplan/main-autoplan-restore-initial.md -->

# TR CoffeeDB Completion Plan

## Approval Status
Approved as-is on 2026-04-04 after `/autoplan` review.

This file preserves the approved implementation plan and its review history. For current operational priorities, use `TODOS.md`; for shipped changes, use `CHANGELOG.md`.

## Plan Summary
TR CoffeeDB already has a real product skeleton: a Next.js catalog UI, Supabase schema and queries, click tracking, a quiz entry point, and scraper infrastructure for Shopify and WooCommerce roasters. The missing work is not "build the app." It is "finish the app so it can ship without embarrassing itself."

This plan turns the current codebase into a launchable **quality-first roaster data platform**. The first user-facing wedge is still buyer discovery, but the durable asset is canonical, structured, fresh roaster data. The focus is now three things: make the browse and recommendation surface truthful, bring a smaller high-trust roaster set to launch quality, and add the minimum ops, docs, and test coverage needed to trust the platform.

## User And Job To Be Done
The user is a coffee buyer in Turkey who wants to discover beans across multiple local roasters without checking twenty storefronts one by one.

They need:
- Cross-roaster discovery
- Fair comparison on normalized pricing
- Fast filtering by origin, process, roast, flavor, brew method, and budget
- Trust that links, freshness, and availability are not stale

Secondary platform users arrive later:
- Roasters who want their catalog represented correctly
- Partners or internal tooling that need structured, current roaster data

## Product Goal
Ship a useful buyer-facing surface for a trustworthy roaster data platform, not a content demo.

At MVP launch, a user should be able to:
- Browse a materially useful, high-trust catalog of Turkish roasters
- Filter and search without broken or ignored controls
- Use the quiz to land on meaningful results
- Click through to roaster product pages with working attribution
- Trust that the catalog refreshes on a predictable cadence

## Product Identity
- **What it is:** a roaster data platform with a buyer-facing discovery experience as the first wedge
- **What the user sees first:** a clean discovery and comparison surface
- **What compounds over time:** structured roaster coverage, freshness processes, normalization quality, and reusable catalog data

## GTM And Monetization Hypothesis
- **Initial wedge:** specialty coffee buyers in Turkey who currently browse multiple roaster sites manually
- **Initial acquisition:** SEO on roaster and coffee pages, specialty coffee communities, and direct sharing from roaster pages/results
- **Near-term monetization hypothesis:** referral / click-out value from trusted discovery
- **Longer-term platform monetization hypothesis:** premium data distribution, partner feeds, or paid visibility only after data trust is earned

## What Already Exists
### Frontend
- Homepage, coffee index, coffee detail, roaster index, roaster detail, and quiz routes exist in `src/app/**`.
- Shared layout, header, footer, coffee cards, pagination, search, tags, and filter sidebar exist in `src/components/**`.
- Production build succeeds, and lint only reports two unused-variable warnings in scraper code.

### Data layer
- Supabase schema, RLS, indexes, RPCs, and roaster seed migrations exist in `supabase/migrations/**`.
- Query layer for coffees, roasters, featured coffees, stats, and similar coffees exists in `src/lib/queries/**`.
- Public click tracking route exists in `src/app/api/click/route.ts`.

### Scraping pipeline
- Shopify and WooCommerce adapters are implemented.
- HTML scraping support exists, but seeded non-Shopify/WooCommerce roasters are not yet configured in `scrapers/src/roasters/configs.ts`.
- Orchestration, normalization, stale-product handling, and scrape logging exist in `scrapers/src/**`.

## Core Premises
1. The right first move is a buyer-facing wedge for a roaster data platform, not a full marketplace, social product, or subscription business.
2. Quality of roaster coverage matters more than raw breadth at launch.
3. Comparison UX matters because users will bounce if filters lie, quiz answers get ignored, or search drops active context.
4. Freshness matters because stale availability is worse than missing data.
5. This can ship as a mostly server-rendered Next.js app backed by Supabase without adding auth, payments, or a heavy admin panel.
6. The long-term moat comes from trusted structured roaster data, not from the quiz itself.

## Current Gaps
### Browse and search gaps
- The quiz writes `priceMin` and `priceMax`, but `src/app/coffees/page.tsx` never parses those values into `CoffeeFilters`, so budget answers are currently ignored.
- The sidebar supports origin, process, roast, flavor, and roaster, but not budget, decaf, or brew method even though the query layer supports them.
- `SearchInput` replaces the current URL with `/coffees?search=...`, which drops active filters and breaks continuity.
- The app handles missing Supabase by silently falling back to empty states, but there is no explicit user-facing error or setup messaging beyond generic empty content.

### Data coverage gaps
- Seed data includes roasters on ikas, ticimax, and custom platforms, but `scrapers/src/roasters/configs.ts` only includes the Shopify and WooCommerce set.
- HTML scraping exists in theory but lacks selector configs for the non-covered seeded roasters.
- Normalization is largely regex-based and likely under-extracts detail-page data such as farm, altitude, producer, and brew guidance.
- The plan does not yet distinguish clearly between launch-quality supported roasters and long-tail deferred roasters.

### Ship-readiness gaps
- There are no tests.
- The README is still the default Next.js template and does not explain setup, migrations, scraping, or deployment.
- There is no documented bootstrap path for local setup, env variables, or the initial database/scrape sequence.

## In Scope
### 1. Complete the browse experience
- Parse and apply `priceMin` and `priceMax` from URL params.
- Add filter UI for brew method, budget or price range, and decaf where the data model already supports it.
- Preserve active filters when performing search or changing sort.
- Add visible active-filter state so users can see why the result set changed.
- Tighten empty, loading, and "data source unavailable" states so the app feels intentional rather than half-configured.

### 2. Make the quiz produce trustworthy outcomes
- Ensure every quiz answer maps to a filter the browse page actually respects.
- Add a results summary on the transition from quiz to coffees so users understand why they were sent there.
- Make the quiz bias toward useful recommendations instead of arbitrary sorting-only behavior.

### 3. Expand seeded roaster coverage to the intended MVP set
### 3. Launch a quality-first supported roaster set
- Define a launch-quality cohort of roughly 15-25 roasters with strong freshness and metadata confidence.
- Add configs and selectors for the already-seeded ikas and ticimax roasters that can meet that bar.
- Decide which custom-platform roasters are realistically in-MVP versus deferred because they need bespoke adapters.
- Improve extraction quality enough that detail pages consistently show meaningful metadata for the supported launch cohort.

### 4. Add minimum launch-grade reliability
- Document setup, migration, scrape, and deploy workflows in README.
- Add at least a smoke-level CI path for lint and build.
- Add targeted automated tests around URL filter parsing, quiz-to-filter mapping, and scraper normalization helpers.
- Ensure the scrape workflow and migration script are explained well enough that another person can run them without archaeology.

## Not In Scope
- User accounts, favorites, or saved searches
- Checkout, cart, or payments
- Native mobile apps
- Full ranking or recommendation ML
- Custom admin CMS
- Broad scraper coverage for every future custom roaster if it requires brand-new platform adapters
- Full platform API / partner productization in MVP

## Proposed Implementation Phases
### Phase 1. Close the broken user loops
- Fix URL parsing gaps on the coffees page.
- Upgrade search and filter interactions so quiz and browse flows agree with each other.
- Add explicit user-facing handling for empty and unavailable states.

### Phase 2. Finish MVP data coverage
- Add non-Shopify/WooCommerce configs where HTML selectors are enough for the supported launch cohort.
- Validate scrape output quality and stale-product behavior.
- Defer truly bespoke custom adapters to `TODOS.md` instead of pretending they are nearly done.

### Phase 3. Ship-readiness
- Add README, env/bootstrap docs, and a clear local runbook.
- Add tests for the riskiest filter and normalization logic.
- Add CI for lint and build.

## Success Criteria
- Quiz answers change the result set in ways the user can see and trust.
- Coffee filters no longer ignore supported params.
- The live dataset covers a clearly defined high-trust launch cohort, not a vague "as many seeded roasters as possible" target.
- Another developer can clone the repo and understand how to run the app, migrations, and scrapers.
- The repo has at least a small automated safety net around the most failure-prone logic.
- The plan states how the buyer-facing wedge supports the longer-term roaster data platform thesis.

## Constraints And Risks
- Remote images and Google font fetching depend on external hosts, so local build and runtime behavior need clear fallbacks or documented expectations.
- HTML selector maintenance will drift as roaster storefronts change.
- Regex-only normalization can get a demo over the line, but it will create data-quality debt if not bounded by tests and explicit deferred work.

## Open Questions
- What exact launch-quality bar qualifies a roaster for MVP support: freshness SLA, metadata completeness, or both?
- Which later platform surface matters most after MVP: partner feeds, internal tooling, or public data APIs?
- What evidence should invalidate the buyer-discovery wedge if repeat usage is weak?

## CEO Review

### Step 0. Nuclear Scope Challenge + Mode Selection

#### 0A. Premise Challenge
**Is this the right problem to solve?**

Yes, with one important reframing. The real problem is not "build a coffee database." It is "help a buyer reach a confident bean choice faster than opening a dozen roaster tabs." The current plan is directionally right because it improves discovery, comparison, and freshness. If it drifts into catalog completion for its own sake, it becomes busywork.

**Actual user outcome**

The user outcome is faster, more confident purchase decisions. The product outcome is repeat visit behavior driven by trust: users believe the catalog is broad enough, fresh enough, and honest enough to start here first. That means broken filters, ignored quiz answers, or obviously stale coverage are not small bugs. They directly attack the only thing this MVP sells, trust.

**What if we did nothing?**

Nothing catastrophic happens. Coffee buyers keep doing the current hacky workflow: Instagram, WhatsApp groups, bookmarked roasters, too many tabs. So the pain is real but not existential. That means the MVP only matters if it feels materially better than manual browsing, not just tidier.

**Premise verdict**
- Premise 1 is valid after reframing: buyer discovery is the first wedge, but the product identity is the roaster data platform.
- Premise 2 is now explicit: launch quality beats launch breadth.
- Premise 3 is strongly valid: comparison UX is the product.
- Premise 4 is strongly valid: stale data is worse than missing data.
- Premise 5 is valid: the stack is enough for MVP without auth or payments.
- Premise 6 is valid: the quiz is a helper, not the moat.

#### 0B. Existing Code Leverage

| Sub-problem | Existing code | Reuse decision |
|---|---|---|
| Coffee catalog pages | `src/app/coffees/page.tsx`, `src/components/coffee/coffee-grid.tsx`, `src/components/coffee/sidebar-filters.tsx` | Reuse, extend filters and URL parsing instead of rebuilding discovery UI |
| Coffee detail and roaster detail | `src/app/coffees/[slug]/page.tsx`, `src/app/roasters/[slug]/page.tsx` | Reuse, add freshness and metadata quality only if data supports it |
| Search flow | `src/components/ui/search-input.tsx` | Reuse, fix URL preservation instead of replacing search |
| Quiz entry point | `src/components/quiz/quiz-container.tsx` | Reuse, align outputs with real filters rather than building a new recommender backend |
| Query/filter backend | `src/lib/queries/coffees.ts`, `src/lib/queries/roasters.ts` | Reuse, keep logic in query layer and avoid parallel filtering code |
| Filter option source | `supabase/migrations/004_functions.sql` (`get_filter_options`) | Prefer leveraging this instead of scattering filter queries further |
| Scraper orchestration | `scrapers/src/index.ts`, `scrapers/src/base-scraper.ts` | Reuse, extend config coverage before inventing new pipeline layers |
| HTML scraping path | `scrapers/src/adapters/html-adapter.ts` | Reuse for selector-compatible roasters, do not over-promise bespoke adapters |
| Database bootstrap | `supabase/migrations/**`, `scrapers/run-migrations.mjs` | Reuse, document and harden bootstrap sequence |

No meaningful part of this plan should rebuild the app from scratch. The codebase already contains the correct skeleton. The work is finishing loops, not replacing architecture.

#### 0C. Dream State Mapping

```
  CURRENT STATE                             THIS PLAN                              12-MONTH IDEAL
  Incomplete but real catalog app           Quality-first buyer wedge               Trusted canonical roaster data platform
  20 implemented scraper configs            High-trust launch cohort                Broad, monitored roaster network with freshness visibility
  Quiz + filters disagree on budget         Quiz and browse flows align             Personalized discovery, richer ranking, shareable recommendations
  Default README, no tests, light ops       Basic trust layer: docs/tests/CI        Durable platform with clear ops, quality signals, and reusable data products
```

This plan moves toward the ideal if it stays focused on trust and usefulness. It moves away from the ideal if it spends weeks chasing every custom scraper edge case before the core discovery loop feels solid.

#### 0C-bis. Implementation Alternatives

**APPROACH A: Minimal Polish**
  Summary: Fix the broken quiz and filter loops, update docs, and ship with the currently implemented 20-roaster scraper set.
  Effort:  M
  Risk:    Low
  Pros:
  - Small diff, fastest path to a cleaner demo
  - Lowest scraper complexity
  - Reuses almost everything as-is
  Cons:
  - Leaves seed-vs-live coverage mismatch in place
  - Users may perceive the catalog as incomplete and stop trusting it
  - Weakens the product's discovery promise
  Reuses: existing pages, query layer, quiz, current scraper configs

**APPROACH B: Launchable Discovery Engine**
  Summary: Fix browse/quiz trust gaps, extend coverage only to a high-trust supported cohort, and add the minimum docs/tests/CI needed to ship confidently.
  Effort:  L
  Risk:    Medium
  Pros:
  - Directly improves the product the user experiences
  - Resolves the most visible trust breaks without boiling the ocean
  - Fits a quality-first data-platform wedge better than breadth-first scraping
  - Matches the current architecture and data model well
  Cons:
  - Still leaves bespoke custom-platform scraping as deferred work
  - Requires touching frontend, scraper configs, and operational docs together
  - Needs explicit rollout sequencing to avoid half-configured launch states
  Reuses: existing Next.js routes, Supabase schema, current adapters, query layer, scrape workflow

**APPROACH C: Data Platform First**
  Summary: Treat the current UI as secondary and invest first in scraper breadth, normalization quality, observability, and data freshness infrastructure.
  Effort:  XL
  Risk:    High
  Pros:
  - Best long-term data foundation
  - Strongest future moat if fully executed
  - Makes later product surfaces easier to trust
  Cons:
  - Delays the user-visible payoff
  - Expands scope into platform work, monitoring, and possible new adapters
  - Easy to spend weeks on backend elegance while the product still feels unfinished
  Reuses: existing scraper base classes and schema, but demands more new infrastructure

**Recommendation:** Choose **Approach B** because it fixes the real user trust loop with the least strategic waste.

#### 0D. Mode-Specific Analysis

Mode selected by `/autoplan`: **SELECTIVE EXPANSION**

**Complexity check**

This is already beyond an 8-file change. That is okay because the work is spread across three real blast zones: discovery UI, scraper coverage, and ship-readiness. The guardrail is not "make it tiny." The guardrail is "do not add a second architecture while finishing the first one."

**Minimum set of changes that achieves the stated goal**
- Make every existing browse and quiz control truthful
- Bring only launch-quality supported roasters into live coverage
- Add setup docs, smoke CI, and tests around the brittle logic

**Expansion scan**
- Add freshness messaging on catalog/detail pages so users know the data is recent
- Add a quiz result summary before the user lands on the coffees grid
- Add richer filter affordances such as active chips and "why these results" context
- Add scrape quality monitoring and product-count change alerts
- Add manual editorial curation or "featured picks"

**Cherry-pick decisions**
- Accepted into scope: freshness messaging, quiz result summary, active-filter visibility
- Deferred to `TODOS.md`: scrape quality dashboards, editorial curation
- Skipped: any new personalization backend or marketplace flow

#### 0E. Temporal Interrogation

```
  HOUR 1 (foundations):
    The implementer needs a single source of truth for filter params and a clear bootstrap order for Supabase + scrape setup.

  HOUR 2-3 (core logic):
    They will hit ambiguity around which roasters qualify for selector-only support versus bespoke adapter work, and whether to use existing RPCs or more ad hoc Supabase queries.

  HOUR 4-5 (integration):
    The surprise will be partial data quality. UI improvements look easy until empty, inconsistent, or stale fields show up across detail pages.

  HOUR 6+ (polish/tests):
    They will wish the plan had already specified regression tests for quiz-to-filter mapping, URL preservation, and normalization edge cases.
```

#### 0F. Mode Selection Confirmation

Approach **B** under **SELECTIVE EXPANSION** is the right fit. It preserves the product goal, avoids a rewrite, and cherry-picks the small expansions that make the experience feel deliberate rather than half-finished.

### Vision

#### 10x Check
The 10x version of this product is not "more rows in a database." It is the place Turkish specialty coffee buyers start every purchase because it answers, fast, "what should I buy right now, from whom, and why?" That future includes freshness signals, better matching, trend or popularity signals, and eventually a real moat around data quality.

#### Platonic Ideal
The ideal experience feels like a sharp buyer's guide, not a dumping ground of scraped SKUs. The user lands, narrows quickly, sees why a coffee matches their taste, trusts the metadata, and clicks out with confidence.

### Scope Decisions

| # | Proposal | Effort | Decision | Reasoning |
|---|---|---|---|---|
| 1 | Fix quiz and browse param mismatch | S | ACCEPTED | Core trust loop is broken today |
| 2 | Add brew method, budget, decaf, and active-filter visibility to browse UX | M | ACCEPTED | Existing data model already supports it |
| 3 | Extend live scraper coverage to seeded selector-compatible roasters | M | ACCEPTED | Coverage is part of trust, and existing HTML adapter lowers cost |
| 4 | Build bespoke custom-platform adapters for all seeded custom roasters | L | DEFERRED | Not all "custom" sites will fit the existing adapter; launch should not block on that |
| 5 | Add freshness/last-updated messaging | S | ACCEPTED | Small trust gain in direct blast radius |
| 6 | Build editorial curation / picks system | M | DEFERRED | Nice, not load-bearing for MVP usefulness |
| 7 | Add auth, favorites, or saved searches | L | SKIPPED | Wrong wedge for current product stage |

### Accepted Scope
- Truthful filter parsing and preservation across quiz, search, sort, and browse
- Launch-quality supported roaster coverage expansion
- Explicit freshness and empty/unavailable state handling
- Launch-grade docs, smoke CI, and targeted tests
- Lightweight GTM / monetization framing consistent with a roaster data platform

### Deferred To TODOS.md
- Bespoke custom-platform adapters beyond selector-compatible roasters
- Scrape quality dashboards and alerting
- Editorial curation or featured picks
- Full external platform API / partner distribution surface

### Section 1. Architecture Review
The strongest part of this plan is that it keeps the architecture boring. That is a compliment. The existing Next.js route structure, Supabase query layer, and scraper base classes are enough. A good version of this plan makes those loops truthful and complete instead of introducing a recommendation service, admin backend, or another abstraction tier nobody asked for.

The main architectural risk is hiding two different problems inside "expand scraper coverage." Some roasters are selector-compatible and can ride the existing `HtmlAdapter`. Others may need bespoke work. The plan now makes that split explicit so we do not accidentally promise uniform support through a single adapter that cannot actually deliver it.

```
  USER
    │
    ├──▶ Next.js App Routes (`src/app/**`)
    │       ├──▶ Query Layer (`src/lib/queries/**`)
    │       │       └──▶ Supabase tables / RPCs
    │       └──▶ Client UI state (`sidebar-filters`, `quiz`, `search-input`)
    │
    └──▶ Buy click
            └──▶ `/api/click`
                    └──▶ `increment_click()` RPC

  SCRAPE WORKFLOW
    GitHub Action / manual run
      └──▶ `scrapers/src/index.ts`
              ├──▶ Shopify / WooCommerce / HTML adapters
              ├──▶ normalization pipeline
              └──▶ Supabase upsert + scrape logs
```

**Architecture verdict:** sound for MVP, provided the plan explicitly keeps frontend filter logic centralized and treats custom scrapers as a separate class of work.

### Section 2. Error & Rescue Map

| Method / Codepath | What Can Go Wrong | Exception Class |
|---|---|---|
| `CoffeesPage` param parsing | invalid numeric query params | `NaNError` / invalid input |
| `SearchInput` URL rewrite | drops active filters | logic regression |
| `QuizContainer.buildFilterUrl()` | emits unsupported params | contract mismatch |
| `getCoffees()` | Supabase query error | Supabase/PostgREST error |
| `POST /api/click` | missing `coffee_id` | validation error |
| `POST /api/click` | anon RPC fails or env missing | runtime / RPC error |
| `BaseScraper.run()` | adapter fetch fails | network / parse error |
| `HtmlAdapter.fetchProducts()` | selector drift or malformed HTML | parse error |
| `run-migrations.mjs` | DB connection fails | connection/auth error |

| Exception Class | Rescued? | Rescue Action | User Sees |
|---|---|---|---|
| invalid filter input | N, GAP | normalize or ignore invalid params explicitly | consistent result set instead of broken paging/filter state |
| logic regression in URL composition | N, GAP | regression tests around search/filter preservation | truthful filters |
| Supabase query error | Y, partial | explicit unavailable-data state, log context | "catalog temporarily unavailable" instead of misleading emptiness |
| missing `coffee_id` | Y | 400 response | no visible UI break |
| click RPC/env failure | Y | non-blocking fallback, structured server log | redirect still works |
| scraper fetch/parse failure | Y, partial | log failure per roaster, keep prior data, mark scrape log clearly | stale data risk unless surfaced |
| migration connection failure | Y, partial | fail loudly with runbook | operator sees setup failure |

The plan needed this written down because the current app often collapses infrastructure failure into "empty state." That is polite, but wrong. Silent failure is how trust dies.

### Section 3. Security & Threat Model
The product is mostly public read traffic, so the highest-probability security mistakes are not auth bugs. They are overly broad public surfaces and sloppy input handling. The current code already exposes a public click-tracking route and permissive remote image configuration in `next.config.ts`.

Threat review:
- Public click endpoint abuse. Likelihood medium, impact low-to-medium. Mitigation: validate input shape, consider lightweight abuse guard, log failures with context.
- Overly broad remote image host allowlist. Likelihood medium, impact medium. Mitigation: replace wildcard host patterns with the actual roaster/CDN domains required for launch.
- Scraper secrets handling. Likelihood low, impact high. Mitigation: keep service-role credentials isolated to scraper workflow and document env boundaries clearly.

**Security verdict:** manageable, but the plan now explicitly includes hardening the image allowlist and validating public click inputs instead of pretending public read-only means "no security review needed."

### Section 4. Data Flow & Interaction Edge Cases

```
  QUIZ ANSWER
    └──▶ URL params
            ├── happy: params supported by `CoffeeFilters`
            ├── nil: unanswered quiz step omitted
            ├── empty: empty arrays / no flavor selection
            └── error: unsupported params ignored or mishandled

  SEARCH / FILTER INTERACTION
    └──▶ URLSearchParams
            ├──▶ `src/app/coffees/page.tsx`
            │       ├── happy: parsed into filters
            │       ├── nil: optional params absent
            │       ├── empty: zero-result state shown
            │       └── error: invalid values normalized
            └──▶ Supabase query
                    ├── happy: filtered result set
                    ├── empty: zero coffees
                    └── error: unavailable-data state
```

Edge cases this plan must cover:
- Search must not wipe active filters
- Invalid page or price params must not poison result rendering
- Empty result sets need explicit helpful messaging, not generic dead air
- Partial metadata on coffee detail pages must degrade cleanly
- Scrape failure for one roaster must not imply full-catalog freshness

This section matters because the product's worst version "works" on happy-path demos while quietly lying everywhere else.

### Section 5. Code Quality Review
The plan now leans into existing modules instead of inventing new ones. Good. The biggest code-quality danger is still accidental duplication: separate URL parsing rules in the quiz, search input, sidebar filters, and coffees page. That becomes a bug factory fast.

The plan should therefore consolidate filter semantics into a shared shape rather than letting each component improvise. That is the difference between "one bug fix" and "we fixed it in one place and broke it in two others."

### Section 6. Test Review
There is no meaningful test harness in the repo today. That means every user-facing trust loop called out in this plan needs to be specified as a required test, not a nice-to-have. The minimum must include URL filter parsing, quiz-to-filter mapping, search preserving filters, and normalization helpers for messy scraper inputs.

A hostile QA engineer would immediately try:
- budget quiz answers that produce no price filtering
- search after setting multiple filters
- invalid query params in the coffees URL
- HTML selector drift causing partial scrape output

If those are not covered, the product will regress the moment someone "cleans up" a component.

### Section 7. Performance Review
This plan is not performance-scary yet. The data size is modest, and the product is mostly read-heavy. The biggest near-term performance concern is redundant filter-option querying and any avoidable client-side state churn in the browse UI.

The best performance move is reuse, not cleverness: prefer server-side query filtering, prefer existing RPCs where they simplify aggregate reads, and avoid building a second recommendation or search layer before the first one is stressed.

### Section 8. Observability & Debuggability Review
Right now the app can fail politely but opaquely. The plan therefore needs basic instrumentation for:
- scrape success/failure by roaster
- product count deltas after scrape runs
- user-facing catalog unavailable states
- click tracking failures
- freshness timestamps shown to users

Nothing fancy. Just enough to answer, "did the scrape fail, or did the UI lie?"

### Section 9. Deployment & Rollout Review
This repo has no commit history and no documented release sequence yet. The plan must specify launch order clearly:
1. provision env vars
2. run migrations
3. seed roasters
4. run initial scrape
5. deploy app
6. enable scrape workflow / cron

Without that sequence, you get the worst launch pattern in software: an app that technically deploys but looks empty or stale because the data bootstrap never happened.

### Section 10. Long-Term Trajectory Review
The main long-term risk is becoming a static SKU index with no reason to return. The plan is stronger now because it names the real compounding asset, trusted roaster data, but it still needs proof that the buyer-facing wedge creates repeat use. That is acceptable for MVP. It is not acceptable forever.

Reversibility is good, roughly **4/5**. Most of this plan is additive and can be rolled back without irreversible schema churn, provided scraper coverage work is kept adapter-compatible and custom-platform ambition stays out of the MVP path.

### Section 11. Design & UX Review
The product clearly has UI scope, and the current plan was still too backend-shaped in parts. It described truthful filters and recommendation loops, but not enough about what the user sees when results are empty, data is stale, or the quiz hands them off to the catalog. That gap will be handled in the design phase, but it is already flagged here because otherwise implementation defaults to generic placeholder UX.

### NOT In Scope
- Bespoke scraper adapters for every custom roaster, because launch should not wait on the hardest integration tail
- User accounts, favorites, saved searches, because they do not strengthen the first-use discovery loop
- Editorial picks system, because it adds curation operations before the core dataset is trustworthy
- Marketplace checkout, because the product's wedge is discovery, not transaction handling
- Native apps, because the web product is the correct proving ground
- Full partner/API platform surface, because the first job is proving the data asset through a high-trust launch wedge

### Dream State Delta
This plan gets the product from "promising but easy to distrust" to "useful enough to recommend and coherent as a roaster data platform wedge." It does not yet get to differentiated habit-forming or partner-grade platform territory. Missing pieces after this plan ships will still include richer freshness intelligence, stronger data-quality monitoring, repeat-visit hooks, and real external data product surfaces.

### Error & Rescue Registry
The primary rescue rule for this product is simple: infra failure must never masquerade as product truth. If the catalog is unavailable, say so. If a scrape fails, log it and avoid overclaiming freshness. If a click track fails, do not block the outbound purchase path.

### Failure Modes Registry

| Codepath | Failure Mode | Rescued? | Test? | User Sees? | Logged? |
|---|---|---|---|---|---|
| quiz → coffees redirect | unsupported budget params ignored | N | N | misleading results | N |
| search input | active filters dropped | N | N | confusing result change | N |
| coffees query | Supabase unavailable | partial | N | currently generic empty state | N |
| click tracking | RPC failure | Y | N | redirect still works | partial |
| HTML scrape | selector drift | partial | N | stale or missing products later | Y |
| migration bootstrap | bad DB credentials | Y | N | operator-visible failure | Y |

Any row where the app quietly lies to the user is treated as a critical trust gap, even if it is not a crash.

### Completion Summary
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | Step 0               | Approach B selected, trust loop clarified   |
  | Section 1  (Arch)    | 1 key issue, custom vs selector scrape split|
  | Section 2  (Errors)  | 9 paths mapped, 4 trust gaps               |
  | Section 3  (Security)| 2 medium-risk surfaces flagged             |
  | Section 4  (Data/UX) | core edge cases mapped, 4 unhandled        |
  | Section 5  (Quality) | 1 centralization issue flagged             |
  | Section 6  (Tests)   | major gaps, no current test harness        |
  | Section 7  (Perf)    | no blocking issues, reuse preferred        |
  | Section 8  (Observ)  | basic scrape/freshness metrics missing     |
  | Section 9  (Deploy)  | rollout sequencing required                |
  | Section 10 (Future)  | Reversibility 4/5, moat still future work  |
  | Section 11 (Design)  | UI scope confirmed, design pass required   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written                                     |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| written                                     |
  | Failure modes        | written                                     |
  | TODOS.md updates     | pending later phases                        |
  | Scope proposals      | 5 reviewed, 3 accepted                      |
  | CEO plan             | persisted in this plan file                 |
  | Outside voice        | subagent-only, codex unavailable            |
  | Diagrams produced    | architecture, dream-state, data flow        |
  | Unresolved decisions | premise confirmation pending                |
  +====================================================================+
```

## Design Review

### Step 0. Design Scope Assessment

#### 0A. Initial Design Rating
This plan is a **6/10** on design completeness.

Why it is not higher:
- It knows the product must feel trustworthy, but not yet exactly how trust appears on the screen.
- It specifies filter truth and freshness as product outcomes, but not enough of the user-visible hierarchy, states, and responsive behavior.
- It names the quiz as a helper, but not what the user sees between quiz completion and catalog results.

A **10/10** version of this plan would define:
- what the user sees first, second, and third on each core screen
- explicit loading, empty, error, success, and partial states
- a clear responsive plan for filters, search, and quiz handoff
- a more specific brand/message hierarchy for the buyer-facing wedge of the roaster data platform

#### 0B. DESIGN.md Status
No `DESIGN.md` exists in the repo. Proceeding with universal design principles and existing product patterns.

#### 0C. Existing Design Leverage
- Stone + amber visual language already exists across `header`, `footer`, `coffee-card`, and quiz UI
- The product already uses restrained surfaces and readable catalog cards, which is a better fit than loud SaaS-dashboard styling
- `CoffeeGrid`, `Tag`, the quiz progress bar, and the current detail page spec table are all good patterns to reuse
- The existing browse layout already implies a desktop sidebar + content area structure that should be refined, not replaced

#### 0D. Focus Areas
The biggest design gaps are:
- information hierarchy for trust signals
- state coverage for missing/stale/unavailable data
- responsive behavior for filter-heavy browse UX

### Pass 1. Information Architecture
**Score:** 6/10 -> 9/10 after fixes

The current plan said "quality-first roaster data platform," but it still risked presenting the buyer surface like a normal coffee catalog. The information architecture needs to make the trust story legible immediately: this is not just beans, it is structured, freshness-aware roaster data presented for decision-making.

Updated hierarchy for core screens:

```
  HOME
    1. Value proposition: trusted Turkish roaster data, made useful for buying
    2. Primary action: explore supported coffees
    3. Secondary action: guided quiz / fit helper
    4. Proof: supported roasters, coverage count, freshness promise
    5. Latest additions / featured supported coffees

  COFFEES INDEX
    1. Result context: what set am I looking at and why?
    2. Active filters / quiz summary / freshness cue
    3. Catalog grid
    4. Sidebar or mobile filter sheet

  COFFEE DETAIL
    1. Coffee identity + roaster
    2. price / normalized price / buy action
    3. freshness and data confidence cue
    4. origin / process / roast / flavor details
    5. similar coffees

  QUIZ HANDOFF
    1. "Here is what you asked for"
    2. Why these results match
    3. Route into filtered catalog
```

### Pass 2. Interaction State Coverage
**Score:** 4/10 -> 9/10 after fixes

The plan was too abstract about what the user sees when data is empty, stale, or partially available. For a data platform wedge, these are not edge cases. They are the product.

```
  FEATURE              | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
  ---------------------|---------|-------|-------|---------|--------
  Homepage featured    | skeleton cards | hide section, keep proof stats text honest | inline "catalog unavailable" note | featured coffees shown | stats available, featured unavailable
  Coffees grid         | card skeletons | "No coffees match these filters" + clear filters action | "Catalog temporarily unavailable" banner | results + count + paging | results shown with missing fields gracefully muted
  Filter controls      | disabled placeholders | still render controls if possible | inline note if dynamic options unavailable | interactive filters | fallback to static/common options if dynamic fetch fails
  Quiz completion      | brief transition state | n/a | "Could not build matches" + retry | summary + CTA to filtered results | summary shown even if some filters unsupported
  Coffee detail        | page skeleton | "Coffee not found" | "Details unavailable right now" | full spec and buy action | missing metadata omitted, freshness notice remains
  Roaster detail       | grid skeleton | "No supported coffees yet" | "Roaster data unavailable" | list of supported coffees | roaster shown, catalog partial
```

Design rule: unavailable data must look intentional and honest, never like "nothing exists."

### Pass 3. User Journey & Emotional Arc
**Score:** 5/10 -> 8/10 after fixes

The emotional arc was underdefined. A good version of this product should move the user from overload to clarity, not from overload to another spreadsheet.

```
  STEP | USER DOES                 | USER FEELS                  | PLAN RESPONSE
  -----|---------------------------|-----------------------------|----------------------------
  1    | Lands on home             | Curious, skeptical          | clear trust-led value prop and proof
  2    | Starts browse or quiz     | Hopeful, exploratory        | simple entry into search/filter or guided flow
  3    | Sees filtered results     | Oriented, narrowing choices | active filter context + why this set
  4    | Opens a coffee detail     | Evaluating confidence       | normalized price + data freshness + specs
  5    | Clicks out to roaster     | Ready to buy               | frictionless buy action with trust preserved
```

The break point today is step 3. Without active context and honest state handling, filtered results can feel arbitrary.

### Pass 4. AI Slop Risk
**Score:** 6/10 -> 8/10 after fixes

The existing UI is calmer than generic SaaS sludge, but the plan still leaves too much room for vague implementation like:
- generic "platform unavailable" banners
- generic quiz success screens
- generic freshness copy

Specific direction added to the plan:
- Homepage messaging should emphasize trusted Turkish roaster data, not just "discover coffee"
- Freshness cues should be compact and factual, not decorative badges everywhere
- Active-filter and quiz summaries should explain the result set in plain language
- The quiz stays lightweight and supporting, not a theatrical centerpiece

### Pass 5. Design System Alignment
**Score:** 6/10 -> 8/10 after fixes

There is no formal design system file, so the plan should align to what already works in code:
- restrained neutral surfaces
- amber as the primary accent
- minimal card chrome
- readable data-first typography

The plan should not introduce:
- dashboard-card mosaics
- loud gradients or startup-poster styling on functional catalog pages
- a second visual language for the "platform" concept

The buyer-facing wedge should still feel like one product with one voice.

### Pass 6. Responsive & Accessibility
**Score:** 4/10 -> 9/10 after fixes

The plan previously said very little about mobile behavior, and this product is filter-heavy. That is dangerous.

Responsive and a11y decisions now fixed in the plan:
- Desktop keeps the sidebar filter layout
- Mobile replaces the sidebar with a filter drawer or sheet triggered above results
- Active filters remain visible as removable chips on mobile and desktop
- Search, filter toggles, quiz options, and pagination controls must meet 44px minimum touch target guidance
- Landmark structure: header, main, filter region, results region
- Dynamic result-count changes and unavailable-data banners should be screen-reader announced
- Quiz progression should remain keyboard-operable and not rely on pointer-only controls

### Pass 7. Unresolved Design Decisions
**Score:** 3 decisions resolved, 2 deferred

```
  DECISION NEEDED                           | IF DEFERRED, WHAT HAPPENS
  ------------------------------------------|---------------------------
  Freshness cue placement                    | Users miss the trust signal
  Quiz handoff summary format                | Results feel arbitrary
  Mobile filter interaction pattern          | Browse UX collapses on phones
  Supported-roaster / quality-cohort copy    | "Why these roasters?" remains vague
  Data confidence wording on detail pages    | Missing fields feel like bugs
```

Auto-decided in the plan:
- Freshness appears near result context and on detail pages, not as noisy badges on every card
- Quiz handoff uses a compact summary block above results
- Mobile filter interaction becomes a drawer/sheet, not a permanently collapsed sidebar

Deferred but noted for implementation polish:
- exact wording for "supported roaster" cohort messaging
- exact copy for data-confidence notes on detail pages

### Design Appendix: Screen Specs And Trust UI Contract

#### Screen Spec 1. Homepage
- **Above the fold order:** headline, search/explore CTA, quiz CTA, trust strip
- **Primary CTA:** explore supported coffees
- **Secondary CTA:** find your fit
- **Trust strip content:** supported roaster count, freshness claim, normalized pricing claim
- **Rule:** trust proof appears before any marketing fluff

#### Screen Spec 2. Coffees Index
- **Top module:** page title + result explanation
- **Immediately below:** active filter chips and optional quiz summary chips
- **Trust row:** supported cohort note, freshness note, sort explanation
- **Main body:** results grid with filters alongside on desktop or in a drawer on mobile
- **Rule:** users should always know what set they are seeing and why

#### Screen Spec 3. Quiz -> Results Handoff
- **Header:** "Based on your answers"
- **Chips:** brew, flavor, roast, budget, adventure if relevant
- **Result summary:** visible count and default sort explanation
- **Recovery path:** edit answers / clear one chip / open filters
- **Rule:** the handoff must feel adjustable, not like a black box verdict

#### Screen Spec 4. Coffee Detail
- **Top block:** roaster, coffee name, price, normalized price, buy action
- **Trust block:** last checked timestamp, supported-roaster note, metadata confidence when partial
- **Specs block:** origin, process, roast, variety, score, brew guidance when present
- **Rule:** missing data must be disclosed as incomplete, not silently absent in a way that feels broken

#### Screen Spec 5. Roaster Detail
- **Top block:** roaster identity + coverage context
- **Trust block:** whether this roaster is in the supported launch cohort and when data was last refreshed
- **Body:** supported coffees grid
- **Rule:** if a roaster has thin coverage, the UI must frame that as current support scope, not accidental emptiness

#### Trust UI Contract
Trust is a first-class surface, not a footer note. The plan now requires these user-visible states:

| Signal | Placement | Meaning |
|---|---|---|
| `Supported roaster` | roaster detail, result context | this source is in the launch-quality cohort |
| `Last checked` | result context, coffee detail, roaster detail | when the source was last refreshed |
| `Likely stale` | result context or detail warning | known scrape lag or uncertain freshness |
| `Metadata incomplete` | coffee detail trust block | some origin/process/spec fields are missing |
| `Catalog temporarily unavailable` | banner above results | data source failure, not zero inventory |

#### Ranking And Result Explanation
- Default browse sort: `newest` unless the user arrives from the quiz
- Quiz handoff default: `popular` for classic answers, `newest` for surprise answers, but the reason must be shown above results
- Result explanation label examples:
  - `Showing coffees that match: filter, fruity, medium roast`
  - `Sorted by newest because you chose Surprise Me`
  - `Showing supported-roaster results only`

#### Coverage Messaging
Because the launch cohort is intentionally smaller, the plan now requires explicit framing:
- Home and browse surfaces should use "supported roasters" language, not imply universal market coverage
- Roaster pages outside the quality bar should not be presented as fully supported
- Copy should make expansion feel intentional: quality-first now, broader coverage later

### Design Outside Voices

#### CLAUDE SUBAGENT (Design, independent)
- **Critical:** homepage and coffees index hierarchy were still too implicit
- **Critical:** trust signals were not yet designed as UI elements
- **High:** mobile filter interaction was under-specified
- **High:** quiz-to-results reassurance flow was too vague
- **Medium:** ranking explanations and launch-cohort messaging needed clearer user-facing wording

#### CODEX SAYS (Design, UX challenge)
Unavailable. The external Codex review path was already unstable during Phase 1, so Phase 2 proceeds in `[subagent-only]` mode for the outside voice.

### Design Litmus Scorecard

```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex   Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy right?     No       N/A     N/A
  2. Missing states covered?          No       N/A     N/A
  3. User journey coherent?           Partial  N/A     N/A
  4. Specific UI vs generic patterns? No       N/A     N/A
  5. Trust signals specified?         No       N/A     N/A
  6. Responsive strategy intentional? No       N/A     N/A
  7. Ambiguities likely to haunt build? Yes    N/A     N/A
═══════════════════════════════════════════════════════════════
```

### Design Completion Summary
```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | No DESIGN.md, clear UI scope                |
  | Step 0               | 6/10 initial, trust + states were weak      |
  | Pass 1  (Info Arch)  | 6/10 -> 9/10                                |
  | Pass 2  (States)     | 4/10 -> 9/10                                |
  | Pass 3  (Journey)    | 5/10 -> 8/10                                |
  | Pass 4  (AI Slop)    | 6/10 -> 8/10                                |
  | Pass 5  (Design Sys) | 6/10 -> 8/10                                |
  | Pass 6  (Responsive) | 4/10 -> 9/10                                |
  | Pass 7  (Decisions)  | 3 resolved, 2 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | inherited from plan                         |
  | What already exists  | written                                     |
  | TODOS.md updates     | pending later phases                        |
  | Approved Mockups     | skipped, text-only review                   |
  | Decisions made       | hierarchy, trust contract, mobile behavior  |
  | Decisions deferred   | copy-level trust wording                    |
  | Outside voice        | subagent-only                               |
  | Overall design score | 6/10 -> 9/10                                |
  +====================================================================+
```

## Engineering Review

### Step 0. Scope Challenge

#### What already exists
- URL-driven browse surface already exists in `src/app/coffees/page.tsx`
- Filter UI and labels already exist across `sidebar-filters.tsx`, `search-input.tsx`, and `filter-options.ts`
- Quiz already produces URL params in `quiz-container.tsx`
- Query layer already supports most needed filters in `getCoffees()`
- Scraper orchestration, adapters, and normalized writes already exist in `scrapers/src/**`
- GitHub Actions already runs scrape jobs, so CI conventions exist in `.github/workflows/scrape.yml`

#### Minimum set of changes
- One shared filter contract for URL parsing and composition
- One explicit supported-cohort source of truth
- One trust/freshness presentation path on browse and detail views
- Selector configs for supported non-Shopify/WooCommerce roasters
- README, smoke CI, and real tests

#### Complexity check
This plan definitely touches more than 8 files, but it does **not** need new services. The safe version stays inside the existing app, query layer, scraper configs, and docs/CI. If implementation starts inventing a recommendation service, cohort service, or admin layer, it has drifted.

#### Search check
No novel architecture is needed. Use built-in Next.js URL state, existing Supabase query patterns, and GitHub Actions. Search for new infra only if a change cannot be expressed through the current stack.

#### Completeness check
This is a classic place teams shortcut:
- skip shared filter parsing
- skip tests because "the diff is obvious"
- skip a structured supported-cohort source of truth and hardcode copy

That would be fake speed. The complete version is still small enough to do now.

### 1. Architecture Review
The architecture is sound if the implementation keeps two truths explicit:
1. the buyer-facing wedge is just one surface over the data platform
2. "supported launch cohort" is data, not copy

Without that second point, the plan becomes fragile fast. If "supported roaster" lives only in prose or in scattered component conditionals, the UI, scrapers, and documentation will drift.

```
  PRODUCT SURFACES
    ├── Homepage / Browse / Quiz / Detail routes
    │       └── Shared filter + trust contract
    │               ├── URL parsing / composition
    │               ├── ranking explanation
    │               └── freshness / support-tier presentation
    │
    └── Query layer
            ├── coffees query
            ├── roasters query
            └── support-tier / freshness derivation

  DATA PLATFORM
    ├── roasters table + support-tier source
    ├── coffees table + freshness fields
    ├── scrape logs
    └── scraper configs / adapters / normalization
```

**Primary architectural findings**
- The plan needs a single source of truth for support tier / launch cohort. Best fit: a structured field or config mapping that both UI and scraper/reporting logic can read.
- The plan needs a single filter contract module. Right now quiz, search, and browse each speak URL params slightly differently.
- The plan needs scrape health to propagate as structured status, not hidden logs. A failed roaster scrape cannot resolve as "success" at the orchestration layer.
- The plan needs a real freshness model: launch freshness thresholds, `freshness_status`, and degraded-mode behavior.

### 2. Code Quality Review
The repo already has the raw pieces. The quality risk is duplication, not missing abstractions.

Things to prevent explicitly:
- duplicating param parsing in page components and client components
- duplicating trust-copy rules in homepage, coffees page, detail pages, and roaster pages
- adding scrape logic conditionals in multiple adapters instead of a clean config boundary

Existing accuracy smells worth carrying into the plan:
- `src/app/coffees/page.tsx` already parses some filters but not price inputs
- `quiz-container.tsx` already emits params the page does not honor
- `search-input.tsx` already composes URLs differently from the sidebar
- `BaseScraper.run()` currently absorbs failures in a way that can keep the top-level scrape loop looking healthier than it is
- `HtmlAdapter` currently behaves like list-only ingestion, not launch-quality detail enrichment

That trio is the exact kind of "small inconsistency" that turns into repeated regressions.

### 3. Test Review

#### Test Framework Detection
- `CLAUDE.md` does not define a testing framework
- No test directories or config files currently exist
- Runtime is Node / Next.js from `package.json`

Recommended testing stack for this plan:
- `vitest` for unit and integration logic
- `@testing-library/react` for client component behavior where needed
- one lightweight `playwright` smoke flow for the browse/quiz handoff if budget allows

#### New UX flows
- Browse with budget, brew, decaf, and active filters
- Search while preserving existing filters
- Quiz completion -> result summary -> filtered catalog
- Supported-cohort / freshness messaging on browse and detail surfaces
- Unavailable-data and partial-metadata handling

#### New data flows
- URL params -> shared filter contract -> `CoffeeFilters`
- support-tier source -> trust UI contract
- scraper freshness / metadata completeness -> user-visible trust cues

#### New codepaths
- invalid numeric filter normalization
- quiz result explanation / default ranking explanation
- supported-roaster messaging branch
- partial metadata branch on detail pages
- unavailable-data banner branch

#### New integrations / external calls
- existing Supabase queries with expanded params
- existing scraper adapters with additional selector configs
- existing GitHub Actions with added CI checks

#### Coverage Diagram

```
CODE PATH COVERAGE
===========================
[+] URL filter contract
    ├── [GAP] priceMin / priceMax parsing
    ├── [GAP] invalid page / price input normalization
    ├── [GAP] search preserves existing params
    └── [GAP] quiz params map to same contract as browse

[+] Supported cohort + trust contract
    ├── [GAP] supported-roaster state rendering
    ├── [GAP] freshness label rendering
    ├── [GAP] metadata incomplete branch
    └── [GAP] unavailable-data banner path

[+] Scraper support expansion
    ├── [GAP] selector config parses expected products
    ├── [GAP] stale-product handling after scrape
    └── [GAP] partial scrape failure keeps platform honest

USER FLOW COVERAGE
===========================
[+] Browse flow
    ├── [GAP] apply multiple filters and clear one
    ├── [GAP] search after filtering
    └── [GAP] no-results-with-filters state

[+] Quiz flow
    ├── [GAP] complete quiz and land on explained results
    ├── [GAP] edit filters after quiz
    └── [GAP] stale / partial result explanation

[+] Detail trust flow
    ├── [GAP] complete metadata case
    ├── [GAP] partial metadata case
    └── [GAP] freshness / supported-cohort messaging

─────────────────────────────────
COVERAGE: 0/14 paths tested (0%)
GAPS: 14 paths need tests
RECOMMEND: vitest for contract + parser + normalization logic,
           react testing library for client interaction edges,
           playwright for one browse/quiz smoke path.
─────────────────────────────────
```

#### Test requirements to add to the plan
- Unit tests for filter parsing, invalid param normalization, and URL composition
- Unit tests for quiz-to-filter mapping
- Unit tests for support-tier / trust-label derivation
- Unit tests for search sanitization / escaping behavior
- Unit tests for normalization helpers on messy price and weight cases
- Integration or component tests for search preserving active filters
- Integration tests for scraper run contracts, stale marking, and suspicious zero-product runs
- Integration tests for Supabase unavailable / misconfigured states
- Validation tests for click endpoint payload abuse cases
- One smoke E2E for quiz -> results -> coffee detail -> click-out intent

#### Test Plan Artifact
Written to:
`/Users/me/.gstack/projects/coffee/me-main-eng-review-test-plan-20260403-205200.md`

### 4. Performance Review
No existential performance issue is hiding here, but there are two likely slow/drifty spots:
- `FiltersLoader()` currently issues raw queries for countries and roasters; as the dataset grows, this should prefer a single aggregate path such as the existing RPC or a cached query
- search currently uses `or(...ilike...)`; acceptable now, but if the supported cohort grows materially, the plan should prefer the existing full-text search function or a more index-friendly path

Everything else is read-heavy and modest scale for MVP. The plan should optimize clarity before micro-optimizing.

### Engineering Outside Voices

#### CLAUDE SUBAGENT (Engineering, independent)
- **Critical:** scraper failures are masked as success at the current orchestration boundary
- **High:** filter state needs one canonical module, not four drifting implementations
- **High:** freshness is promised without a proper model or SLA
- **High:** the public click endpoint is too easy to abuse
- **High:** HTML scraping capability is overstated relative to launch-quality metadata goals
- **Medium-high:** browse/search performance paths should use cached filter options and FTS sooner than later

#### CODEX SAYS (Engineering, architecture challenge)
Unavailable. The external Codex path was unstable in this environment, so Phase 3 proceeds in `[subagent-only]` mode for outside-voice coverage.

### ENG Dual Voices — Consensus Table

```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex   Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?              Partial  N/A     N/A
  2. Test coverage sufficient?        No       N/A     N/A
  3. Performance risks addressed?     Partial  N/A     N/A
  4. Security threats covered?        Partial  N/A     N/A
  5. Error paths handled?             No       N/A     N/A
  6. Deployment risk manageable?      Partial  N/A     N/A
═══════════════════════════════════════════════════════════════
```

### Failure Modes

| Codepath | Failure Mode | Test? | Error handling? | User impact |
|---|---|---|---|---|
| shared filter contract | invalid params produce wrong query | required | must normalize | misleading results |
| support-tier source | UI labels wrong roaster as supported | required | must centralize source | trust damage |
| freshness derivation | stale data shown as current | required | must expose uncertainty | trust damage |
| scrape run contract | roaster scrape fails but job stays green | required | must propagate failure status | silent trust decay |
| selector configs | scrape returns wrong products | required | existing logs partial | catalog quality drops |
| search preservation | search wipes active filters | required | none today | confusing browse UX |
| click endpoint | popularity manipulated by abuse | required | must validate and rate-limit | ranking poisoned |

Critical gap definition for this plan: any path that misstates support, freshness, or filter meaning is a platform-trust bug, not cosmetic debt.

### Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Shared filter contract + browse UX truthfulness | `src/app/`, `src/components/coffee/`, `src/components/ui/`, `src/lib/` | — |
| Supported cohort + scraper coverage | `scrapers/src/`, `src/lib/queries/`, possibly `supabase/` | — |
| Docs + CI bootstrap | `README.md`, `.github/workflows/`, root config | — |
| Tests | `test/` or `src/**/__tests__`, config files | shared filter contract + scraper decisions |

Parallel lanes:
- `Lane A`: shared filter contract -> buyer-facing browse/quiz updates
- `Lane B`: supported cohort + scraper config expansion
- `Lane C`: docs + CI setup
- `Lane D`: tests after A and B settle

Execution order:
- Launch `Lane A`, `Lane B`, and `Lane C` in parallel
- Merge A + B first because test assertions depend on their contracts
- Run `Lane D` after the interfaces stabilize

Conflict flags:
- `Lane A` and `Lane D` both touch `src/lib/` semantics, so tests should follow the contract merge
- `Lane B` may need shared support-tier decisions that affect `src/lib/queries/`, so define that source of truth before parallelizing too aggressively

### Engineering Completion Summary
```
  +====================================================================+
  |        ENGINEERING PLAN REVIEW — COMPLETION SUMMARY                |
  +====================================================================+
  | Step 0               | Scope accepted, no new services needed      |
  | Architecture Review  | 2 key findings                              |
  | Code Quality Review  | 1 major duplication risk                    |
  | Test Review          | diagram produced, 18 gaps identified        |
  | Performance Review   | 2 moderate risks, no blocker                |
  | NOT in scope         | inherited from plan                         |
  | What already exists  | written                                     |
  | TODOS.md updates     | pending final gate                          |
  | Failure modes        | trust-critical gaps listed                  |
  | Outside voice        | subagent-only                               |
  | Parallelization      | 4 lanes, 3 parallel + 1 follow-up           |
  +====================================================================+
```

### CEO Outside Voices

#### CLAUDE SUBAGENT (CEO, independent)
- **Critical:** The plan still optimizes for "finish the discovery engine" rather than proving the winning wedge.
- **Critical:** The premises are asserted without evidence, kill criteria, or validation plan.
- **High:** Breadth may be overvalued relative to data quality and freshness.
- **Critical:** The likely 6-month regret is a scraper graveyard with weak user pull.
- **Critical:** GTM, monetization, and competitive moat are not defined.

#### CODEX SAYS (CEO, strategy challenge)
Unavailable. The `codex exec` outside-voice run started, read the plan, and then stalled without producing a usable strategic verdict in this environment. Proceeding in `[subagent-only]` mode for the external voice portion of Phase 1.

### CEO Dual Voices — Consensus Table

```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex   Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                  No       N/A     N/A
  2. Right problem to solve?          Reframe  N/A     N/A
  3. Scope calibration correct?       No       N/A     N/A
  4. Alternatives sufficiently explored? No    N/A     N/A
  5. Competitive/market risks covered? No      N/A     N/A
  6. 6-month trajectory sound?        No       N/A     N/A
═══════════════════════════════════════════════════════════════
Single critical finding from the available outside voice is flagged even without a second completed voice.
```

### Outside-Voice User Challenge
The independent reviewer is not objecting to the code quality direction. It is objecting to the product wedge. The challenge is whether MVP should optimize for broad seeded coverage, or instead for a tighter quality-first wedge with explicit GTM and monetization hypotheses.

What the user said:
- Run `/autoplan` for the current directory because the work is incomplete.

What the outside voice recommends:
- Reframe the plan from "launch a discovery engine with the seeded MVP set" to "ship the highest-trust wedge first," likely a smaller roaster set with clearer evidence, GTM, and repeat-use strategy.

Why:
- A broader but shakier catalog is easy to distrust.
- A discovery-only surface without repeat-use hooks or monetization can become a polished dead end.
- The open question around "all seeded roasters" vs "best 20" is actually strategic, not operational.

What context we might be missing:
- Your intended business model may already be fixed.
- This may be a hobby or portfolio product where GTM depth is intentionally out of scope.
- You may already know that breadth matters more than retention for this phase.

If the outside voice is wrong, the cost is:
- We risk overcorrecting into strategy work and slowing down a perfectly good MVP launch.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Choose Approach B: launchable discovery engine | Mechanical | P1, P3 | Best path to trustworthy MVP without a rewrite | Minimal polish only, data-platform-first |
| 2 | CEO | Select `SELECTIVE_EXPANSION` mode | Mechanical | P1, P2 | Existing system enhancement with a few high-leverage improvements | Scope reduction, full expansion |
| 3 | CEO | Keep quiz and browse truthfulness in scope | Mechanical | P1 | Current product lies on budget/filter behavior | Defer to later polish |
| 4 | CEO | Keep seeded selector-compatible roaster coverage expansion in scope | Mechanical | P2 | In blast radius, existing HTML adapter makes this boilable | Freeze coverage at 20 |
| 5 | CEO | Defer bespoke custom-platform adapters to TODOs | Mechanical | P2, P3 | Outside the easy blast radius and likely bespoke per site | Force all custom roasters into MVP |
| 6 | CEO | Accept freshness messaging as an expansion | Taste | P1, P2 | Small trust gain in direct product flow | Skip freshness until later |
| 7 | CEO | Accept quiz result summary / active-filter visibility as expansions | Taste | P1, P5 | Makes the recommendation loop legible with low complexity | Keep handoff opaque |
| 8 | CEO | Defer editorial curation and monitoring dashboards | Mechanical | P3 | Valuable, but not core to the first useful launch | Build now |
| 9 | CEO | Reframe the product as a roaster data platform with a quality-first buyer wedge | User Challenge resolved by user | User sovereignty | User clarified the product identity directly | Keep discovery-engine framing |
| 10 | CEO | Prefer launch-quality cohort over maximal seeded breadth | User Challenge resolved by user | P1, P2 | User selected B after the outside voice challenge | Breadth-first launch |
| 11 | Design | Add explicit trust UI contract and screen specs | Mechanical | P1, P5 | Trust cannot stay as abstract copy in a data platform wedge | Generic trust language |
| 12 | Design | Use mobile filter drawer/sheet with visible active chips | Taste | P5 | Stronger mobile browse refinement with less clutter | Inline stacked mobile filters |
| 13 | Design | Keep freshness cues near context blocks, not on every card | Taste | P3, P5 | Preserves signal without noisy badge spam | Per-card freshness badges |
| 14 | Eng | Introduce one canonical `coffeeFilters` contract module | Mechanical | P4, P5 | Fixes root drift across quiz, search, and browse | Patch each component separately |
| 15 | Eng | Make scrape health propagate as structured failure status | Mechanical | P1 | Hidden scrape failures would silently poison freshness trust | Keep current swallow-and-log behavior |
| 16 | Eng | Add freshness-status modeling before implementation | Mechanical | P1, P2 | Freshness is a product promise, not an afterthought | Derive freshness ad hoc in UI |
| 17 | Eng | Expand test scope beyond parser/quiz helpers | Mechanical | P1 | Current failure surface is broader than the initial matrix | Minimal happy-path tests |
