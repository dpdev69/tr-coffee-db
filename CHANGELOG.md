# Changelog

All notable changes to TR CoffeeDB are documented here.

## [0.2.0.0] - 2026-07-13

### Added

- Every current catalog coffee now has a canonical lot record with source-backed claims, journey events, supply-chain roles, assessments, certifications, and explicit validation status.
- Coffee detail pages now show a journey-to-cup timeline, traceability score, quality dossier, certification state, and field-level evidence ledger without presenting scraped claims as independently verified.
- A new rankings page compares traceability, published quality evidence, accessible transparent pricing, and market interest as separate measures.

### Changed

- The homepage, catalog cards, navigation, footer, and sitemap now lead with the coffee journey and evidence model.
- Rankings now page through the full public catalog instead of silently stopping at the first 1,000 coffees.

### Fixed

- Public journey tables are read-only under row-level security, and all new source and organization foreign keys used by the journey graph are indexed.
- Future scraper writes keep canonical lot records synchronized while preserving observed claims as observed rather than upgrading their verification level.

## [0.1.0.0] - 2026-07-12

### Added

- Scheduled catalog refreshes now retry temporary storefront failures and publish a readable per-roaster health summary in GitHub Actions.
- CI now reuses the Next.js build cache between runs.

### Changed

- The app and scraper now use Node.js 22 with current, pinned Supabase and scraper dependencies.
- The homepage now explains that CoffeeDB compares specialty coffees seen for sale within the last three days.

### Fixed

- A single temporary roaster outage no longer fails a healthy catalog-wide refresh; broad runs require at least 90% success while targeted probes remain strict.
- Manual scraper probes now reject every unknown roaster slug instead of silently ignoring mixed valid and invalid targets.
- Thrown transient scraper errors are retried consistently with failed scrape results.
