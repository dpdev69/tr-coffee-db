# Personalization roadmap

Status: proposed future architecture, 2026-09-15. V2 ships discovery and an optional transient quiz. No account system, persistent taste profile, ratings, match percentages or journal is implemented. The existing comparison list stores only up to three coffee slugs locally.

## Evidence gate

Review at least four weekly editions, confirmed subscriber retention and email clicks, real outbound usage, and past-behavior interviews before proposing personalization. Subscriber milestones100/500/1,000 are operating targets, not automatic permission to build accounts. Look for repeat discovery, a demonstrated reason to provide feedback, and cases where better relevance would change the choice. Current evidence does not yet justify the feature.

## Boundaries already preserved

Canonical coffee and offer identities survive source changes. `coffees.raw_metadata_json` preserves current source facts; `coffee_feature_values` separately stores provenance, version, source reference and optional confidence. Legacy source records are archived. MANUAL reviewed features survive crawler refreshes, and crawl input cannot claim MANUAL provenance. Unknown features remain unknown. Future user data must reference coffee IDs without being mixed into source facts or inference records.

## Proposed entities, pending authentication choice

| Entity | Candidate fields | Constraint |
| --- | --- | --- |
| user_preferences | user_id, schema_version, dimensions, updated_at, consent context | Keep independent of newsletter membership; every preference optional. |
| user_coffee_interactions | user_id, coffee_id, status, sentiment, rating, brew_method, notes, created_at, updated_at | Distinguish wanting to try from actually tried; private by default; define ratings only after research. |
| brew_sessions | user_id, coffee_id, method, dose, water, ratio, temperature, grind, time, grinder, rating, notes | Defer until interactions and recommendation retention justify journaling. |

Candidate preference dimensions: fruity/chocolate/nutty/floral/sweet, fermented versus clean, acidity/body, roast, classic versus experimental process, brew method, espresso/filter, milk/black, budget and origins. None is mandatory, and unknown does not mean dislike. Candidate statuses: want_to_try and tried; candidate sentiments: loved, liked, okay, disliked. Avoid encoding sentiment solely in status so that tasting context can remain distinct.

## Deterministic first recommendation engine

A future pure `calculateCoffeeMatch(userProfile, coffeeFeatures)` receives versioned inputs and returns reasons, warnings, coverage and an internal score. It performs no database reads and has no UI dependency; fetching and presentation remain replaceable adapters. Start with transparent weighted rules, not generative scoring. Missing evidence reduces confidence/coverage rather than becoming an invented match. Do not display a percentage unless its meaning is calibrated and every contributing reason is explainable. Sponsorship and commercial access never enter organic scoring.

Evaluation should hold out genuinely tried coffees, compare against simple popularity/content baselines, report outcome counts and uncertainty, and avoid treating unclicked or untried coffees as disliked. The eventual north-star question is whether a recommended coffee is liked after trying it; outbound clicks alone cannot answer that.

## Later sequence

1. Validate a voluntary preference-and-feedback prototype with real discovery users.
2. Select authentication and privacy/deletion/export behavior; then specify migrations.
3. Test deterministic ranking with explained reasons and no public numerical claims.
4. Measure incremental retention and liked-after-trying outcomes.
5. Consider a journal and verified roaster profiles only if this improves actual use.

Future roaster claims, corrections and anonymous demand reports remain separate from organic ranking. Commercial access must not alter feature provenance or recommendation weights. No user interactions, roaster claims or acquisition messages were created by this roadmap.
