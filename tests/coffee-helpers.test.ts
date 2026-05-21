import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveCoffeeConfidence } from '@/lib/coffee-confidence';
import { parseCoffeeFilters } from '@/lib/coffee-filters';

const NOW = '2026-05-21T00:00:00.000Z';

function completeCoffee(overrides = {}) {
  return {
    is_available: true,
    origin_country: 'Colombia',
    process: 'washed',
    roast_level: 'medium',
    price_per_100g: 120,
    last_scraped_at: null,
    last_seen_at: '2026-05-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseCoffeeFilters', () => {
  it('deduplicates valid repeated values, normalizes text, and ignores invalid enums', () => {
    const filters = parseCoffeeFilters({
      origin: [' Colombia ', 'Colombia', '', 'Ethiopia'],
      process: ['washed', 'invalid', 'natural', 'washed'],
      roastLevel: ['dark', 'unknown', 'medium'],
      roaster: ['  Kronotrop  ', 'Kronotrop'],
      city: [' İstanbul ', 'istanbul', 'İzmir!'],
      flavorCategory: ['Fruity', 'Savory', 'Chocolate', 'Fruity'],
      brewMethod: ['espresso', 'invalid', 'filter'],
      singleOrigin: ['', '1'],
      isDecaf: 'nope',
      search: '  Kenya, (washed); "espresso"  ',
      sort: 'not-a-sort',
      page: '2.9',
    });

    assert.deepEqual(filters.origin, ['Colombia', 'Ethiopia']);
    assert.deepEqual(filters.process, ['washed', 'natural']);
    assert.deepEqual(filters.roastLevel, ['dark', 'medium']);
    assert.deepEqual(filters.roaster, ['Kronotrop']);
    assert.deepEqual(filters.city, ['istanbul', 'izmir']);
    assert.deepEqual(filters.flavorCategory, ['Fruity', 'Chocolate']);
    assert.deepEqual(filters.brewMethod, ['espresso', 'filter']);
    assert.equal(filters.singleOrigin, true);
    assert.equal(filters.isDecaf, undefined);
    assert.equal(filters.search, 'Kenya washed espresso');
    assert.equal(filters.sort, 'newest');
    assert.equal(filters.page, 2);
    assert.equal(filters.perPage, 24);
  });

  it('clamps price boundaries and falls back for empty or invalid inputs', () => {
    const filters = parseCoffeeFilters({
      priceMin: '-10',
      priceMax: '6000',
      page: '0',
      process: ['invalid'],
      city: ['!!!'],
      search: ',,,',
      sort: 'price_asc',
    });

    assert.equal(filters.priceMin, 0);
    assert.equal(filters.priceMax, 5000);
    assert.equal(filters.page, 1);
    assert.equal(filters.process, undefined);
    assert.equal(filters.city, undefined);
    assert.equal(filters.search, undefined);
    assert.equal(filters.sort, 'price_asc');
  });
});

describe('deriveCoffeeConfidence', () => {
  it('marks a fresh complete coffee with a successful scrape as verified', () => {
    const confidence = deriveCoffeeConfidence(
      completeCoffee(),
      { status: 'success', completed_at: '2026-05-20T00:00:00.000Z' },
      { now: NOW }
    );

    assert.equal(confidence.status, 'verified');
    assert.equal(confidence.isFresh, true);
    assert.equal(confidence.isComplete, true);
    assert.deepEqual(confidence.reasons, [
      'freshness_timestamp_recent',
      'latest_roaster_scrape_success',
    ]);
  });

  it('marks a fresh complete coffee without a successful scrape as recent', () => {
    const confidence = deriveCoffeeConfidence(completeCoffee(), null, { now: NOW });

    assert.equal(confidence.status, 'recent');
    assert.equal(confidence.isFresh, true);
    assert.deepEqual(confidence.reasons, ['freshness_timestamp_recent']);
  });

  it('marks incomplete metadata as partial even when freshness is recent', () => {
    const confidence = deriveCoffeeConfidence(
      completeCoffee({ process: null }),
      { status: 'partial', products_found: 3 },
      { now: NOW }
    );

    assert.equal(confidence.status, 'partial');
    assert.equal(confidence.isComplete, false);
    assert.ok(confidence.reasons.includes('metadata_incomplete'));
    assert.ok(confidence.reasons.includes('latest_roaster_scrape_partial'));
  });

  it('marks old freshness timestamps as stale', () => {
    const confidence = deriveCoffeeConfidence(
      completeCoffee({ last_seen_at: '2026-04-01T00:00:00.000Z' }),
      { status: 'success' },
      { now: NOW }
    );

    assert.equal(confidence.status, 'stale');
    assert.equal(confidence.isFresh, false);
    assert.ok(confidence.reasons.includes('freshness_timestamp_stale'));
  });

  it('marks unavailable coffee as unavailable before freshness checks', () => {
    const confidence = deriveCoffeeConfidence(
      completeCoffee({ is_available: false }),
      { status: 'success' },
      { now: NOW }
    );

    assert.equal(confidence.status, 'unavailable');
    assert.deepEqual(confidence.reasons, ['coffee_unavailable']);
  });
});
