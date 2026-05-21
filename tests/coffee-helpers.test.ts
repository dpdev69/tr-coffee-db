import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCoffeeFilters } from '@/lib/coffee-filters';

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
