# TODOS

## Infrastructure

### Add catalog freshness dashboard or scrape summary artifact

**What:** Show fresh, stale, failed, skipped, and restored roaster counts after every scheduled scrape.

**Why:** Freshness is now the product promise. A green GitHub Action is not enough if users are seeing stale or partial catalog data.

**Context:** The 2026-05-21 catalog freshness checkpoint found 71 restored stale active coffees and seven zero-product WooCommerce adapters. The scraper now fails zero-product runs correctly, but operators still need one place to see catalog health after each run. Start with a GitHub Actions summary artifact before building a full dashboard.

**Effort:** M
**Priority:** P1
**Depends on:** Existing scrape log writes

### Tune metadata audit before making it a release gate

**What:** Reduce false positives in `npm run audit:metadata` and then decide whether high-confidence issues should fail CI.

**Why:** The audit can catch public catalog trust issues, but false positives would create alert fatigue and block good releases.

**Context:** A 20-row audit on 2026-05-22 flagged six Nok Coffee roast-level misses from generic "Light Medium Dark" scale text. That may be template copy rather than product-specific metadata. Tighten evidence rules before treating audit output as authoritative.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Scrapers

### Fix zero-product WooCommerce adapters

**What:** Repair the latest WooCommerce adapters that returned zero products and confirm whether their restored stale products are still purchasable.

**Why:** Restored stale coffees should become genuinely fresh or correctly unavailable. Keeping them active indefinitely weakens trust.

**Context:** Latest failed zero-product roasters from the freshness checkpoint: `baristocrat`, `coffeemamma`, `daphne`, `old-java`, `ordinarius`, `poka`, and `williams`. Start with the highest active-product count or strongest buyer value.

**Effort:** M
**Priority:** P1
**Depends on:** Catalog freshness audit data

### Add missing active-roaster scraper coverage

**What:** Add scraper configs or adapters for active roasters that do not currently have scrape logs.

**Why:** The public catalog should make supported coverage honest. Active roasters without coverage create freshness blind spots.

**Context:** Active roasters without scraper coverage/logs from the freshness checkpoint: `caffe-di-toee`, `gourme`, `grizzly`, `hound`, `kernel`, `kronotrop`, `probador`, and `ultra`. Some may now have configs, so verify current logs before implementing.

**Effort:** M
**Priority:** P2
**Depends on:** Freshness dashboard or manual scrape-log review

### Defer bespoke custom-platform adapters beyond selector-compatible roasters

**What:** Build bespoke custom adapters only after the supported launch cohort proves demand or freshness value.

**Why:** Custom storefronts can consume a lot of maintenance time without improving the core buyer loop.

**Context:** `PLAN.md` intentionally keeps selector-compatible coverage in scope and defers broad custom adapter work. Treat each bespoke adapter as its own value decision, not an automatic obligation.

**Effort:** L
**Priority:** P3
**Depends on:** Evidence that the specific roaster matters to users

## Product

### Explore editorial curation or featured picks

**What:** Test a lightweight editorial layer for notable coffees, value picks, or fresh arrivals.

**Why:** Curation may create a repeat-visit hook after the core catalog trust loop is solid.

**Context:** This was deferred from the CEO plan because freshness and truthful comparison are load-bearing for MVP. Revisit only after catalog health and usage data show users need more guidance than filters and quiz results provide.

**Effort:** M
**Priority:** P3
**Depends on:** Stable freshness health and early usage signals

## Platform

### Revisit external data API or partner feed surface

**What:** Define whether TR CoffeeDB should expose partner feeds, a public API, or internal data exports.

**Why:** The long-term platform thesis depends on reusable structured roaster data, but API productization is premature before trust and demand are proven.

**Context:** `PLAN.md` frames TR CoffeeDB as a roaster data platform with buyer discovery as the first wedge. This item should start with partner/user interviews and concrete use cases, not an endpoint-first build.

**Effort:** XL
**Priority:** P4
**Depends on:** Proven buyer wedge and clearer monetization signal

## Completed
