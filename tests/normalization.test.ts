import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalize } from '../scrapers/src/normalization/index';
import type { RawProduct } from '../scrapers/src/types';

describe('normalize price per 100g', () => {
  it('leaves price_per_100g null when package weight is missing', () => {
    const coffee = normalize(makeRawProduct({ price: 500, weightGrams: null }));

    assert.equal(coffee.weight_grams, null);
    assert.equal(coffee.price_per_100g, null);
  });

  it('calculates price_per_100g from a 250g package', () => {
    const coffee = normalize(makeRawProduct({ price: 745, weightGrams: 250 }));

    assert.equal(coffee.weight_grams, 250);
    assert.equal(coffee.price_per_100g, 298);
  });

  it('calculates price_per_100g from a 1kg package', () => {
    const coffee = normalize(makeRawProduct({ price: 1200, weightGrams: 1000 }));

    assert.equal(coffee.weight_grams, 1000);
    assert.equal(coffee.price_per_100g, 120);
  });

  it('ignores non-positive and non-finite package weights', () => {
    for (const weightGrams of [0, -250, Number.POSITIVE_INFINITY]) {
      const coffee = normalize(makeRawProduct({ price: 500, weightGrams }));

      assert.equal(coffee.weight_grams, null);
      assert.equal(coffee.price_per_100g, null);
    }
  });
});

function makeRawProduct(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    externalId: 'ethiopia-test',
    name: 'Ethiopia Test Coffee',
    description: '',
    price: 500,
    currency: 'TRY',
    weightGrams: 250,
    imageUrl: null,
    productUrl: 'https://example.test/products/ethiopia-test',
    isAvailable: true,
    tags: [],
    ...overrides,
  };
}
