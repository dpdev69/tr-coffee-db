# Changelog

All notable changes to TR CoffeeDB are documented here.

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
