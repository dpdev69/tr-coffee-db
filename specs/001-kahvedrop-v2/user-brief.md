You are the lead engineer, data architect, product designer, and migration owner for an existing project currently called TR CoffeeDB.

Your task is to produce and implement V2 of the product.

Do not treat this as a cosmetic redesign.

We are rebuilding the product around three layers:

1. TRUSTWORTHY COFFEE DATA
2. CONTINUOUS DISCOVERY
3. A FUTURE PERSONALIZATION / TASTE GRAPH

The immediate V2 objective is to launch a reliable discovery product that generates email signups and measurable outbound traffic to specialty-coffee roasters.

The long-term objective is substantially more ambitious:

The product should eventually learn what each user likes and become the best place in Türkiye to answer:

"What coffee should I buy next?"

Think of the long-term product as a mixture of:

- a real-time coffee discovery feed
- Spotify-style recommendations
- Letterboxd-style taste history / interactions
- a trusted search and comparison database

However:

DO NOT build all of that in V2.

We need to validate distribution and recurring usage before building a large account/recommendation system.

==================================================
PRODUCT STRATEGY
==================================================

The database is infrastructure.

The immediate product is:

"What changed in Turkish specialty coffee since I last looked?"

The four most important catalog events are:

NEW
PRICE_DROP
RESTOCKED
DEAL

The initial user promise is approximately:

"Türkiye'deki nitelikli kahveleri takip ediyoruz. Yeni çıkan çekirdekleri, geri gelenleri, gerçekten düşen fiyatları ve keşfetmeye değer kahveleri tek yerde gör."

The initial retention mechanism is:

HAFTALIK DROP

A weekly email containing:

- notable new coffees
- genuine deals
- restocks worth knowing about
- editorial picks

Later, once we have usage and preference data, this evolves toward:

"Yeni kahveleri kaçırma. Sana uygun olanları da bil."

And eventually:

"We learn what you like and tell you what coffee to buy next."

These are stages of the same product, not competing strategies.

==================================================
BUSINESS MODEL
==================================================

Consumers browse for free.

Users always purchase directly from the roaster.

We do NOT:

- process coffee payments
- hold inventory
- handle fulfillment
- create marketplace checkout
- take over the roaster/customer relationship

The long-term paying customer can be the roaster.

Possible future revenue:

- clearly labeled Featured Roaster placement
- sponsored weekly newsletter placement
- sponsored genuine new-release placement
- exclusive tracked promotions
- referral/performance campaigns
- roaster analytics
- anonymized demand insights

Organic recommendation ranking must NEVER be purchasable.

Commercial relationships cannot secretly alter recommendation scores or organic rankings.

Normal roaster inclusion should remain free.

The business becomes valuable to roasters when we can demonstrate:

- qualified product views
- outbound store traffic
- interest in releases
- saves / want-to-try activity
- demand by taste profile
- eventually attributable purchases or promotion performance

Do not implement billing in V2.

==================================================
WORKING BRAND
==================================================

Current project:
TR CoffeeDB

Working V2 brand:
KahveDrop

Working domain candidate:
kahvedrop.com

Alternative names:

KahveAvı
kahveavi.com

ÇekirdekAvı
cekirdekavi.com

KahveTakip
kahvetakip.com

DO NOT assume any domain is available.

Do not hardcode the public brand throughout the codebase.

Create centralized brand configuration for:

- product name
- domain
- site title
- descriptions
- social metadata
- logo paths
- email source name
- analytics source identifiers

We may rename before public launch.

==================================================
NON-NEGOTIABLE EXECUTION ORDER
==================================================

Do not begin by redesigning the UI.

Work in this order:

P0 — inspect existing repository
P1 — fix data model / data integrity
P2 — create trustworthy event detection
P3 — prepare Cloudflare architecture
P4 — migrate database/crawlers safely
P5 — validate old vs new data
P6 — simplify product UI
P7 — add Kit newsletter capture
P8 — add referral and product analytics
P9 — deploy V2
P10 — acquire first subscribers
P11 — only after validation, begin personalization

Do not delete working infrastructure before replacement infrastructure has been validated.

==================================================
PHASE 0 — AUDIT EVERYTHING FIRST
==================================================

Before changing code, inspect the repository thoroughly.

Identify:

- framework
- exact framework version
- Next.js router type if relevant
- runtime
- package manager
- database client / ORM
- Supabase schema
- migrations
- current authentication if any
- crawlers / scrapers
- roaster adapters
- parsing strategies
- current scheduler
- GitHub Actions
- deployment configuration
- environment variables
- analytics integration
- taste quiz implementation
- brew calculator implementation
- traceability implementation
- filtering implementation
- price history logic
- inventory logic
- package / variant representation
- product identity logic
- deduplication logic
- tests
- stale/dead code
- functionality that should be preserved

DO NOT rebuild something merely because it already exists in an imperfect form.

First determine what can be reused.

Create:

docs/v2-audit.md

Include:

1. Current architecture
2. Current data flow
3. Current crawler architecture
4. Current schema
5. Current deployment path
6. Major data-quality risks
7. Technical debt affecting V2
8. Features worth retaining
9. Features to de-emphasize
10. Recommended migration sequence

Do not make destructive changes in this phase.

==================================================
THE CORE DATA PRINCIPLE
==================================================

Separate:

RAW / OBJECTIVE COFFEE DATA

from:

NORMALIZED / INFERRED COFFEE FEATURES

from:

USER TASTE DATA

from:

USER INTERACTIONS

This boundary is critical because the long-term product depends on recommendations.

Conceptually:

roasters
coffees
offers
price_observations
coffee_events

coffee_features

users / identities — future or existing
user_preferences — future
user_coffee_interactions — future
brew_sessions — future
recommendations — future / optional cache

Do not tightly combine these layers.

Scraped text should not silently become inferred truth.

For example:

coffees.process_raw

may contain:

"Anaerobic Thermal Shock Natural"

while:

coffee_features.process_family

may normalize it to:

"natural"

and:

coffee_features.experimental_process

may be true.

Preserve both.

==================================================
CORE V2 DATABASE
==================================================

Refactor toward this conceptual hierarchy:

Roaster
  -> Coffee
      -> Offer / SKU
          -> Price observations

Changes in those objects generate:

Coffee Events

Minimum concepts:

ROASTERS

- id
- source identifiers where available
- name
- slug
- website_url
- city if genuinely known
- platform / adapter
- active
- last_attempt_at
- last_success_at
- crawl health
- timestamps

COFFEES

- id
- roaster_id
- stable source_product_id
- canonical_url
- name
- slug

Objective metadata where supplied:

- country
- region
- producer
- farm
- altitude
- varieties
- raw process
- raw tasting notes
- roast information
- decaf

Lifecycle:

- first_seen_at
- last_seen_at
- discontinued_at
- timestamps

OFFERS

Represents a purchasable SKU / bag size / variant.

- id
- coffee_id
- source_variant_id
- variant label
- weight_g
- currency
- current_price_try
- compare_at_price_try
- in_stock
- purchase_url
- first_seen_at
- last_seen_at
- last_price_change_at
- timestamps

PRICE_OBSERVATIONS

- offer_id
- observed price
- observed compare-at price
- observed stock status
- observed_at
- crawl_run_id

COFFEE_EVENTS

- id
- coffee_id
- offer_id where relevant
- event type
- created_at
- before metadata
- after metadata
- idempotency key

Event types:

NEW
PRICE_DROP
RESTOCKED
DEAL
OUT_OF_STOCK

CRAWL_RUNS

- id
- roaster_id
- started_at
- completed_at
- success / failure state
- products_seen
- offers_seen
- parser version if useful
- diagnostics

CRAWL_ERRORS

- crawl_run_id
- roaster_id
- stage
- message
- safe diagnostic context
- timestamp

==================================================
COFFEE FEATURES
==================================================

Create a separate normalized layer that can later power recommendation scoring.

coffee_features should be able to represent concepts such as:

- flavor families
- fruity
- chocolatey
- floral
- nutty
- sweet
- funky / fermented
- clean / classic
- acidity estimate / classification
- body estimate / classification
- roast classification
- process family
- experimental_process
- brew compatibility
- espresso suitability
- filter suitability
- milk-drink suitability
- normalized origin
- normalized variety

IMPORTANT:

Do not fabricate these when insufficient source data exists.

Every inferred feature should ideally have:

- source
- confidence
- inference version

Example:

coffee_feature_values

coffee_id
feature
value
source_type
confidence
model_or_rule_version
created_at

Possible source types:

ROASTER_DECLARED
RULE_INFERRED
MANUAL
FUTURE_USER_CONSENSUS

The objective coffee table must remain distinct from inferred coffee_features.

This allows recommendations to improve later without corrupting raw catalog data.

==================================================
DATA CORRECTNESS RULES
==================================================

Data trust is the highest priority.

1. Never invent missing catalog information.

2. Unknown is a valid state.

3. If bag weight is unknown:
   - do not calculate price per 100g
   - do not infer bag size merely from price

4. Product identity must be deterministic.

Prefer stable source IDs from platforms such as:

- Shopify product IDs
- Shopify variant IDs
- WooCommerce product IDs
- WooCommerce variation IDs

Canonical URLs are fallback identifiers.

5. Canonicalize URLs.

Remove meaningless tracking parameters.

Preserve parameters only if required to identify the actual purchasable variant.

6. A crawler failure must NEVER mean:
   "all products are out of stock."

7. Distinguish:

- crawl attempted
- crawl failed
- crawl succeeded
- item absent from successful crawl
- item explicitly unavailable
- item discontinued

8. Never erase price history.

9. Price comparisons must compare the same offer.

Do not compare:

250g vs 1kg
100g vs 250g
different variants

and call that a price drop.

10. All site counts should come from canonical queries.

The homepage, roaster pages, API, and catalog cannot each maintain their own counts.

11. Prevent duplicate active products/offers.

12. Add parser fixtures for every supported roaster adapter.

13. Missing metadata must cause graceful UI degradation.

14. Track data freshness.

15. Produce a data-quality report.

Create:

docs/data-quality.md

Include:

- roaster count
- active coffee count
- active offer count
- products missing origin
- products missing process
- products missing weight
- products missing price
- duplicate candidates
- stale products
- stale roasters
- crawler success percentage
- adapter error percentage
- products with suspicious identity changes
- products with invalid normalized price
- products with questionable compare-at pricing

==================================================
EVENT ENGINE
==================================================

NEW

Create when a stable coffee/product identity is first observed.

Do not create NEW merely because:
- URL changed
- parser changed
- slug changed
- title changed slightly

RESTOCKED

Create when a previously confirmed unavailable offer becomes available again.

PRICE_DROP

Create when:

the same stable offer
has a lower confirmed current price
than its previous confirmed current price.

DEAL

Treat carefully.

Do not trust compare-at pricing blindly.

Distinguish if useful:

ROASTER_PROMO

The roaster claims an active promotion.

VERIFIED_DEAL

Our own historical observations show a real lower price for the same SKU.

For VERIFIED_DEAL, consider requiring:

- same stable offer
- same weight
- previous price seen on multiple successful crawls
- meaningful decrease threshold

Document the exact rules.

Create deterministic tests for every event.

==================================================
CRAWLER ARCHITECTURE
==================================================

Preserve working adapters whenever possible.

Normalize every adapter to an output resembling:

{
  sourceProductId,
  canonicalUrl,
  name,
  rawMetadata,
  offers: [
    {
      sourceVariantId,
      label,
      weightG,
      price,
      compareAtPrice,
      currency,
      inStock,
      purchaseUrl
    }
  ]
}

Each crawl:

1. create crawl run
2. fetch source
3. parse
4. validate
5. normalize
6. reconcile product identity
7. reconcile offers
8. store observations
9. derive events
10. update current state
11. mark run complete
12. emit crawl-health telemetry

One broken roaster cannot stop all other crawlers.

A failed parser must not destroy valid database state.

==================================================
CLOUDFLARE MIGRATION
==================================================

Move production away from:

- Vercel
- scheduled GitHub Actions
- Supabase as the production catalog DB

Target architecture:

Cloudflare Workers
Cloudflare D1
Cloudflare Queues
Cloudflare Cron Triggers
Cloudflare Workers Analytics Engine
Cloudflare Web Analytics
Cloudflare build/deployment integration

Use Workflows only if genuinely useful.

Do not introduce infrastructure simply because Cloudflare offers it.

==================================================
FRAMEWORK MIGRATION
==================================================

Inspect the actual frontend framework/version before choosing a migration strategy.

If Next.js is involved:

- determine Cloudflare's currently supported deployment approach
- run compatibility checks
- identify unsupported Node/runtime APIs
- do not blindly migrate framework internals

Preserve existing routing/components where sensible.

Avoid a frontend rewrite unless migration requirements make it necessary.

==================================================
D1 MIGRATION
==================================================

Remember:

D1 uses SQLite semantics.

Supabase/Postgres migrations cannot automatically be treated as D1 migrations.

Create an idempotent migration/backfill process.

Suggested process:

1. export current Supabase data
2. validate source
3. transform into V2 canonical model
4. preserve legacy IDs in mapping data where useful
5. load D1 staging
6. reconcile counts
7. reconcile sample products
8. reconcile historical prices
9. run new crawler
10. compare new vs old crawler
11. investigate discrepancies
12. only then prepare production cutover

Create:

docs/d1-migration-runbook.md

Do not remove Supabase immediately.

Keep it available as read-only rollback until production has proven stable.

==================================================
CLOUDFLARE SCHEDULING
==================================================

Initial crawl frequency target:

approximately every 6 hours

unless repository/roaster limitations justify something different.

Cron should enqueue per-roaster crawl jobs.

Queue consumers should:

- isolate roaster failures
- retry safely
- avoid duplicate event generation
- report failures

Do not crawl irresponsibly.

Respect reasonable site load.

Do not implement anti-bot bypass systems.

==================================================
INDEXES AND QUERY EFFICIENCY
==================================================

Add indexes based on actual access patterns.

Likely useful:

roasters.slug
coffees.roaster_id
coffees.first_seen_at
coffees.active/current state
offers.coffee_id
offers.in_stock
events.type + created_at
price_observations.offer_id + observed_at

Use query plans before blindly adding indexes.

Do not over-engineer search for a database of hundreds or low thousands of products.

==================================================
V2 PRODUCT EXPERIENCE
==================================================

The V2 UI should answer two questions extremely quickly:

1. What changed?
2. Is this coffee worth investigating?

Primary navigation:

Yeni
Fırsatlar
Kahveler
Kavurucular

Do not make every existing utility equally prominent.

Existing features such as:

- taste quiz
- brewing calculator
- traceability scoring
- advanced filters
- educational material

may remain available where useful.

But they should not dominate initial navigation.

Do not delete working functionality unless required.

==================================================
HOMEPAGE
==================================================

Working hero:

"Yeni kahveleri kaçırma."

Supporting copy:

"Türkiye'deki nitelikli kavurucuları takip ediyoruz. Yeni çıkan çekirdekleri, geri gelenleri ve gerçekten düşen fiyatları tek yerde gör."

Email input

CTA:

"Haftalık Drop'a katıl"

Then:

YENİ BU HAFTA

Then:

FİYATI DÜŞENLER

Then:

GERİ GELENLER

Then:

a second newsletter CTA

If an editorial recommendation section is useful:

"Radarımızdakiler"

This can contain 3–5 manually or deterministically selected coffees.

Do NOT pretend these are personalized until personalization actually exists.

==================================================
COFFEE CARDS
==================================================

The card must be scannable in approximately 3 seconds.

For anonymous V2 users prioritize:

event badge

roaster
coffee name

consumer-friendly taste shorthand

Examples:

Meyvemsi · Temiz · Parlak

Çikolatalı · Tatlı · Dengeli

Funky · Tropikal · Yoğun

Then:

origin
process

price
price per 100g where valid

CTA:

"Kavurucuda gör"

Do not expose 20 metadata fields on each card.

Expert information should remain available on details.

==================================================
FUTURE PERSONALIZED CARD
==================================================

Design components so we can later add:

92% eşleşme

with explanations such as:

- Meyvemsi kahveleri seviyorsun
- V60 tercihinle uyumlu
- Beğendiğin başka bir Etiyopya kahvesine benziyor

Never show unexplained fake precision.

The recommendation UI must not be implemented until the scoring engine has real preference inputs.

==================================================
FILTERS
==================================================

Initial consumer-visible filters:

Origin
Process
Taste
Price
Roaster

Advanced:

Farm
Producer
Variety
Altitude
Roast
Traceability
Brew method
other expert metadata

Preserve expert capability without overwhelming normal users.

==================================================
COFFEE DETAIL
==================================================

Show:

- coffee
- roaster
- consumer-friendly flavor profile
- event status
- current offers
- normalized price where valid
- origin
- region
- producer/farm
- process
- varieties
- full tasting notes
- roast information
- first seen date
- price history if trustworthy
- purchase CTA

Add:

"Benzer kahveler"

using deterministic catalog similarity if feasible.

Similarity can use:

- normalized flavor features
- origin
- process
- variety
- roast

This does not require user accounts.

Prefer currently available coffees.

Exclude the same coffee and obvious duplicates.

A future section can become:

"Bunu sevdiysen..."

==================================================
KIT EMAIL CAPTURE
==================================================

Kit is the subscriber/email system.

The V2 newsletter:

Haftalık Drop

Promise:

"Yeni çıkan kahveler ve gerçekten iyi fırsatlar, haftada bir."

Signup asks for:

EMAIL ONLY

No account creation.

No password.

No mandatory quiz.

No preference questionnaire before signup.

Build native frontend UI calling:

POST /api/subscribe

Server behavior:

- validate email
- use Kit API server-side
- no client-side API secret
- upsert subscriber idempotently
- attach subscriber to Haftalık Drop form
- preserve useful referral/UTM metadata
- return safe errors
- prevent obvious abuse
- avoid storing email in analytics
- honor Kit's unsubscribe / consent settings

Environment:

KIT_API_KEY
KIT_FORM_ID

Optionally after successful signup show a NON-BLOCKING message:

"İstersen damak zevkini 30 saniyede anlat."

That CTA may link to the existing taste quiz.

However:

Do not require it.

Do not block V2 launch on persistent Coffee DNA.

==================================================
OUTBOUND REFERRAL TRACKING
==================================================

Outbound traffic is a core commercial metric.

Purchase links should route through something like:

/go/:offerId

Flow:

1. validate the offer
2. load known purchase URL from our database
3. record anonymous click event
4. record useful context:
   - roaster
   - coffee
   - offer
   - page
   - event source
5. attach safe referral UTMs where appropriate
6. immediately redirect to roaster

Example:

utm_source=kahvedrop
utm_medium=referral

Prevent open redirects.

Never redirect to arbitrary user-supplied URLs.

All destination URLs must come from trusted canonical roaster/offer data.

==================================================
ANALYTICS
==================================================

Use:

Cloudflare Web Analytics

for normal site traffic.

Use:

Workers Analytics Engine

for custom product events.

Minimum V2 events:

coffee_detail_view
feed_filter_change
newsletter_signup_submit
newsletter_signup_success
outbound_roaster_click

If taste quiz remains active:

quiz_started
quiz_completed

Future events:

coffee_saved
coffee_tried
coffee_liked
coffee_disliked
recommendation_impression
recommendation_clicked
similar_coffee_clicked
brew_saved

Never store email addresses in analytics.

Create:

docs/analytics-events.md

==================================================
V2 SUCCESS METRICS
==================================================

Immediate metrics:

unique visitors
email subscribers
visitor -> subscriber conversion
weekly subscriber growth
outbound roaster clicks
outbound clicks per roaster
outbound clicks per coffee
return visits where privacy-safe
Kit email open rate
Kit email click rate

Early validation milestones:

100 subscribers
then 500
then 1,000

Treat these as operating targets, not guarantees.

The most important V2 question is:

"Will users repeatedly give us permission to help them discover coffee?"

==================================================
LONG-TERM PRODUCT METRIC
==================================================

Once personalization exists, the most important metric changes.

The north-star product question becomes:

"When we recommend a coffee, how often does that user ultimately like it?"

Architecture created now must not make that future difficult.

==================================================
PERSONALIZATION ROADMAP — DO NOT FULLY IMPLEMENT YET
==================================================

Prepare for, but do not block V2 on:

COFFEE DNA

Possible preference dimensions:

- fruity vs chocolatey
- floral
- nutty
- sweet
- funky/fermented
- clean/classic
- acidity
- body
- roast
- traditional vs experimental process
- brew method
- espresso vs filter
- milk vs black
- budget
- origin preferences

Design future table shape such as:

user_preferences

Do not force a final schema if authentication is not yet chosen.

==================================================
FUTURE USER INTERACTIONS
==================================================

Plan for a table similar to:

user_coffee_interactions

Possible fields:

user_id
coffee_id
status
sentiment
rating
brew_method
notes
created_at
updated_at

Possible statuses/interactions:

want_to_try
tried
loved
liked
okay
disliked

Do not implement the entire interaction system in V2 unless the project already has most of it and adding it is extremely low-risk.

This data will eventually be one of the strongest proprietary assets in the product.

==================================================
RECOMMENDATION ENGINE ARCHITECTURE
==================================================

Do not use generative AI for V1 recommendation scoring.

When implemented later, begin with deterministic weighted rules.

Design for a pure reusable boundary such as:

calculateCoffeeMatch(userProfile, coffeeFeatures)

returning approximately:

{
  score: 92,
  reasons: [
    "Meyvemsi kahve tercihinle uyumlu",
    "V60 için güçlü bir eşleşme",
    "Daha önce sevdiğin kahvelere benziyor"
  ],
  warnings: [
    "Normal tercihinden biraz daha asidik"
  ]
}

The recommendation engine must be independent of UI.

It must not contain database-fetching logic.

It must be replaceable later without rewriting frontend components.

Do not display a numerical match score if the system cannot explain it.

==================================================
BREWING / JOURNAL FUTURE
==================================================

The existing brew calculator can eventually evolve into a brew journal.

Future brew sessions may include:

coffee
brew method
dose
water
ratio
temperature
grind
time
grinder
rating
notes

Do not prioritize this for V2.

It becomes valuable AFTER:

- users have accounts
- coffee interactions exist
- personalization shows retention

==================================================
SEO / INDEXABLE DISCOVERY
==================================================

Create useful indexable routes:

/yeni
/firsatlar
/kahveler
/kavurucular

Individual:

/kahve/[slug]
/kavurucu/[slug]

Prepare for future:

/haftalik/YYYY-MM-DD

Potential later high-intent pages:

fruit-forward coffees
V60 coffees
Ethiopian coffees
washed coffees
natural coffees
coffee under specific price thresholds

Do NOT mass-generate thin SEO pages.

Every landing page should have real inventory and useful information.

==================================================
ROASTER COVERAGE
==================================================

Coverage matters, but is not the product itself.

Do not optimize for vanity database size.

Prioritize:

- active roasters
- trustworthy product identity
- accurate stock
- accurate price
- useful coffee metadata
- reliable crawl frequency

A smaller trustworthy catalog beats a large stale one.

The architecture should support eventually expanding toward approximately:

80+ quality Turkish roasters
800–1,000 active coffees

but this is NOT a V2 launch blocker.

==================================================
USER RESEARCH DOCUMENT
==================================================

Create:

docs/user-research.md

Include these hypotheses:

1. Enthusiasts check multiple roaster websites to discover coffee.
2. New releases are fragmented across roasters.
3. Good/limited coffees can sell quickly.
4. Deals are easy to miss.
5. Enthusiasts already rely on newsletters, communities, and manual site checking.
6. Origin/process/tasting notes affect buying decisions.
7. Too much metadata can increase decision overload.
8. A recurring discovery feed may be more useful than a passive database.
9. Personal recommendations could create significantly stronger retention once enough taste data exists.
10. Users may not be willing to pay a consumer subscription even if they spend heavily on coffee.

Interview script:

"Think about the last bag of coffee you bought. How did you discover it?"

"Which roaster websites or coffee communities do you check regularly?"

"Have you missed a release or deal you wish you had seen?"

"What are the first three things you look at when deciding whether a coffee interests you?"

"What makes you reject a coffee?"

"Do you regularly buy similar coffees or intentionally explore?"

"If one site knew your taste, what would it need to know to make recommendations you actually trust?"

"Would you rather receive every new coffee, or only new coffees likely to match you?"

"What would make a weekly coffee email useful enough to keep?"

"What would make you unsubscribe?"

Do not ask:

"Would you use our app?"

Focus on real past behavior.

==================================================
SPONSORSHIP-READY UI
==================================================

Prepare a reusable component:

SponsorCard

Feature flag OFF.

Requirements:

- clearly labeled "Sponsorlu"
- aesthetically consistent
- cannot affect organic ranking
- desktop side placement or sensible mobile inline placement
- no fake sponsors

Do not build billing.

==================================================
FUTURE ROASTER PLATFORM
==================================================

Do not build this now, but preserve architectural space for:

claimed roaster profiles

Possible future capabilities:

- verify profile
- correct metadata
- update coffees
- fix links
- submit stock information
- see product views
- see outbound clicks
- see saves
- see want-to-try counts
- see anonymous taste demand
- see popular brew methods
- see promotion performance

Commercial access must remain separate from recommendation ranking.

==================================================
PRIVACY / SECURITY
==================================================

Requirements:

- no secrets committed
- Cloudflare secrets for keys
- Kit key server-side only
- validate external URLs
- prevent open redirects
- no PII in Analytics Engine
- minimize personal data
- preserve/update privacy and terms pages
- document external processors
- clearly identify KVKK / commercial-email compliance questions that require owner/legal review
- do not falsely claim legal compliance

==================================================
TESTING
==================================================

Prioritize tests for trust-breaking failures.

Required coverage:

product identity
variant identity
canonical URLs
dedupe
unit price
missing weight
NEW event
PRICE_DROP event
RESTOCKED event
DEAL rules
failed crawl
partial crawl
crawler idempotency
Kit subscribe handler
outbound redirect allow-list
data migrations
major UI empty/error states

Add parser fixtures using representative source data where appropriate.

==================================================
STAGING ACCEPTANCE CRITERIA
==================================================

Do not call V2 ready until:

1. Canonical coffee/roaster counts agree everywhere.

2. Unknown weight never generates a fake normalized price.

3. Failed crawls cannot mass-mark products unavailable.

4. Price drops trace to historical observations of the same offer.

5. Duplicate active offers are prevented.

6. Crawl health is inspectable per roaster.

7. D1 staging reconciles against Supabase.

8. Old and new crawler outputs have been compared.

9. Significant crawler differences have been reviewed.

10. Cloudflare staging deployment works.

11. Kit signup works end to end.

12. Emails are not leaked into analytics/logs.

13. Outbound clicks are measurable.

14. /go cannot be used as an open redirect.

15. All purchase journeys end on the roaster's website.

16. Core mobile experience works.

17. Key routes have canonical metadata.

18. A rollback procedure exists.

19. coffee_features is separated cleanly enough from raw catalog data that future personalization will not require another database rewrite.

20. Existing taste/utility features that remain exposed still work after migration.

==================================================
CUTOVER STRATEGY
==================================================

Do not perform a big-bang destructive migration.

Sequence:

1. finish D1 staging
2. import Supabase data
3. run new crawlers
4. compare
5. resolve discrepancies
6. deploy Cloudflare staging
7. test signup / referral / analytics
8. prepare final sync
9. back up legacy DB
10. production migration
11. verify production reads
12. verify crawlers
13. verify Kit
14. verify outbound tracking
15. monitor several crawl cycles
16. retain legacy systems temporarily for rollback
17. remove old scheduled infrastructure only after stability is proven

Create:

docs/cutover-runbook.md

==================================================
WHAT NOT TO BUILD IN V2
==================================================

Unless already nearly complete and trivial to retain:

Do NOT build:

- mandatory user registration
- password/auth system from scratch
- full Coffee DNA accounts
- AI chatbot
- generative recommendation engine
- large social network
- comments
- follower system
- push notifications
- full brew journal
- public tasting-review network
- badges/gamification
- roaster self-service dashboard
- payments
- subscriptions
- marketplace checkout
- sponsorship billing
- mobile app
- complex notification preferences

Do not let the future vision prevent shipping the acquisition loop.

==================================================
V2 ACQUISITION LOOP
==================================================

The product loop we are trying to validate is:

Crawler finds change
      ↓
KahveDrop surfaces change
      ↓
User discovers coffee
      ↓
User clicks roaster
      ↓
User subscribes to Haftalık Drop
      ↓
Weekly Drop brings user back
      ↓
More discovery and outbound clicks

Later this becomes:

User creates Coffee DNA
      ↓
Recommendations become personalized
      ↓
User records liked/disliked/tried
      ↓
Taste model improves
      ↓
Recommendations improve
      ↓
Retention increases
      ↓
Taste dataset becomes defensible
      ↓
Roaster insights become more valuable

Design V2 so this second loop can be added cleanly.

==================================================
IMPLEMENTATION DISCIPLINE
==================================================

Work autonomously.

Do not ask the owner questions that the repository can answer.

When blocked by something only the owner can provide, such as:

- Cloudflare credentials
- Kit API credentials
- DNS/domain purchase
- account permissions
- production approval

state exactly what is required.

Then continue every non-blocked task.

Use small migrations.

Prefer understandable code.

Do not perform an unnecessary rewrite.

Reuse good existing parsers and components.

At each major milestone run:

tests
typecheck
lint if configured
build

Document failures and fixes.

==================================================
DELIVERABLES
==================================================

At the end provide:

1. Executive summary

2. Current architecture summary

3. Mermaid diagram of V2 architecture

4. Old -> new infrastructure mapping

5. Repository audit

6. Final D1 schema

7. Explanation of raw coffee data vs normalized coffee_features

8. Supabase -> D1 migration report

9. Data-quality report

10. Crawler-health report

11. Event-engine rules

12. Cloudflare deployment instructions

13. Kit setup instructions requiring owner action

14. Environment/secrets checklist

15. Final route map

16. Analytics event dictionary

17. User-research hypotheses

18. Remaining known issues

19. Rollback procedure

20. Recommended next 10 growth/product tasks ranked by impact

21. Explicit recommendation on whether the product is ready to begin the next personalization phase

==================================================
FINAL PRODUCT TEST
==================================================

Before completing the project, evaluate the V2 against these questions:

Can I trust the catalog?

Can I tell what is genuinely new?

Can I tell what genuinely became cheaper?

Can I discover an interesting coffee within seconds?

Can I reach the roaster in one click?

Can I subscribe to hear about the next interesting coffee?

Can we prove that we sent qualified traffic to a roaster?

Is the architecture ready to later learn:

- what coffees a person likes
- what flavor profiles they prefer
- what brewing methods they use
- what they have already tried
- which recommendations succeed

If the answer to any first six questions is no, V2 is not complete.

The objective is not:

"make TR CoffeeDB prettier."

The objective is:

Build a trustworthy Turkish specialty-coffee discovery engine that gets permission to contact users again, measures commercial intent, and creates the data foundation for a personalized coffee recommendation product.