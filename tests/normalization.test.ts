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

describe('normalize coffee metadata', () => {
  it('detects Turkish process words with dotted characters', () => {
    const coffee = normalize(
      makeRawProduct({
        name: 'Etiyopya Killenso Yıkanmış',
      })
    );

    assert.equal(coffee.process, 'washed');
    assert.equal(coffee.process_detail, 'Yıkanmış');
  });

  it('prefers specific fermentation process over generic natural or washed words', () => {
    const naturalAnaerobic = normalize(
      makeRawProduct({
        name: 'Rwanda Rugali Natural Anaerobic',
      })
    );
    const carbonicWashed = normalize(
      makeRawProduct({
        name: 'Colombia Washed Carbonic Maceration',
      })
    );

    assert.equal(naturalAnaerobic.process, 'anaerobic');
    assert.equal(carbonicWashed.process, 'anaerobic');
  });

  it('uses platform metadata such as categories and attributes for classification', () => {
    const coffee = normalize(
      makeRawProduct({
        name: 'Kolombiya Monteblanco',
        description: '',
        tags: [],
        rawData: {
          categories: ['Nitelikli Kahve'],
          attributes: [
            { name: 'İşleme', terms: [{ name: 'Yıkanmış' }] },
            { name: 'Kavrum', terms: [{ name: 'Orta Açık' }] },
          ],
        },
      })
    );

    assert.equal(coffee.process, 'washed');
    assert.equal(coffee.roast_level, 'medium_light');
  });

  it('detects Turkish roast levels with dotted characters', () => {
    const coffee = normalize(
      makeRawProduct({
        name: 'Peru Amazonas Açık Kavurma',
      })
    );

    assert.equal(coffee.roast_level, 'light');
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
