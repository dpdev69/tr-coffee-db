import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { coffeeMatchesSearch } from '@/lib/coffee-search';
import type { Coffee } from '@/lib/types/database';

describe('coffeeMatchesSearch', () => {
  it('matches roaster, tasting note, process, and brew method aliases', () => {
    const coffee = makeCoffee({
      name: 'Kenya Gakuyuini',
      process: 'washed',
      process_detail: 'Yıkanmış',
      flavor_notes_normalized: ['Red Currant', 'Bergamot'],
      flavor_categories: ['Fruity', 'Floral'],
      brew_methods: ['filter'],
      roasters: { name: 'Coffee Department' },
    });

    assert.equal(coffeeMatchesSearch(coffee, 'department'), true);
    assert.equal(coffeeMatchesSearch(coffee, 'bergamot'), true);
    assert.equal(coffeeMatchesSearch(coffee, 'yıkanmış'), true);
    assert.equal(coffeeMatchesSearch(coffee, 'v60'), true);
    assert.equal(coffeeMatchesSearch(coffee, 'meyvemsi canlı'), true);
    assert.equal(coffeeMatchesSearch(coffee, 'espresso'), false);
  });
});

function makeCoffee(
  overrides: Partial<Coffee> & { roasters?: { name: string } }
): Pick<
  Coffee,
  | 'name'
  | 'name_normalized'
  | 'origin_country'
  | 'origin_region'
  | 'origin_farm'
  | 'origin_producer'
  | 'process'
  | 'process_detail'
  | 'roast_level'
  | 'variety'
  | 'flavor_notes'
  | 'flavor_notes_normalized'
  | 'flavor_categories'
  | 'brew_methods'
> & { roasters?: { name: string } } {
  return {
    name: 'Test Coffee',
    name_normalized: null,
    origin_country: 'Kenya',
    origin_region: null,
    origin_farm: null,
    origin_producer: null,
    process: 'unknown',
    process_detail: null,
    roast_level: 'unknown',
    variety: null,
    flavor_notes: [],
    flavor_notes_normalized: [],
    flavor_categories: [],
    brew_methods: [],
    ...overrides,
  };
}
