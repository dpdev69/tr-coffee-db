import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isLikelyCatalogCoffeeProduct } from '../scrapers/src/product-classification';
import { classifySpecialtyProduct } from '../scrapers/src/specialty-classification';
import type { NormalizedCoffee, RawProduct } from '../scrapers/src/types';

describe('isLikelyCatalogCoffeeProduct', () => {
  it('excludes Turkish filter-paper product titles with dotted Turkish characters', () => {
    assert.equal(isLikelyCatalogCoffeeProduct(['ABACA Filtre Kağıdı']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Cafec Abaca PLUS Filtre Kağıdı-CUP4']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Hario V60 02 Dripper Filtresi']), false);
  });
});

describe('classifySpecialtyProduct', () => {
  it('qualifies traceable lots with origin, process, flavor, and producer evidence', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Colombia El Paraiso Lychee Lot',
          description:
            'Producer Diego Bermudez. Farm El Paraiso, Cauca. Anaerobic washed. Notes of lychee and jasmine. SCA 88.',
        },
        normalized: {
          origin_country: 'Colombia',
          origin_region: 'Cauca',
          origin_farm: 'El Paraiso',
          process: 'anaerobic',
          flavor_notes_normalized: ['lychee', 'jasmine'],
          sca_score: 88,
        },
      })
    );

    assert.equal(result.specialty_status, 'specialty');
    assert.equal(result.is_public, true);
    assert.ok(result.specialty_score >= 5);
    assert.ok(result.specialty_signals.includes('origin_farm'));
    assert.ok(result.specialty_signals.includes('producer'));
  });

  it('rejects accessories and sample sets before scoring', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Kahve Tadım Paketi',
          description: 'Three small samples for tasting.',
        },
        normalized: {
          origin_country: null,
          process: 'unknown',
        },
      })
    );

    assert.equal(result.specialty_status, 'not_specialty');
    assert.equal(result.specialty_rejection_reason, 'non_coffee_or_bundle');
    assert.equal(result.is_public, false);
  });

  it('rejects generic blends without strong traceability', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'House Espresso Blend',
          description: 'A balanced everyday espresso with chocolate notes.',
        },
        normalized: {
          process: 'unknown',
          flavor_notes_normalized: ['chocolate'],
        },
      })
    );

    assert.equal(result.specialty_status, 'not_specialty');
    assert.equal(result.specialty_rejection_reason, 'generic_blend');
  });

  it('rejects country-only weak metadata', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Colombia',
          description: 'Medium roast coffee.',
        },
        normalized: {
          name: 'Colombia',
          name_normalized: 'Colombia',
          origin_country: 'Colombia',
          process: 'unknown',
        },
      })
    );

    assert.equal(result.specialty_status, 'not_specialty');
    assert.equal(result.specialty_rejection_reason, 'origin_country_only');
  });

  it('keeps weak specialty hints unclassified instead of public', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Peru Amazonas',
          description: 'Single origin coffee with sweet cup profile.',
        },
        normalized: {
          origin_country: 'Peru',
          flavor_notes_normalized: ['sweet'],
          process: 'unknown',
        },
      })
    );

    assert.equal(result.specialty_status, 'unclassified');
    assert.equal(result.specialty_rejection_reason, 'insufficient_traceability');
    assert.equal(result.is_public, false);
  });

  it('applies force-include overrides deterministically', () => {
    const result = classifySpecialtyProduct({
      ...makeClassificationInput({
        raw: { externalId: 'manual-1', name: 'House Blend' },
        normalized: { external_id: 'manual-1' },
      }),
      roasterId: 'roaster-1',
      override: {
        roaster_id: 'roaster-1',
        external_id: 'manual-1',
        override_action: 'force_include',
        reason: 'curated_launch_pick',
      },
    });

    assert.equal(result.specialty_status, 'specialty');
    assert.equal(result.specialty_score, 100);
    assert.deepEqual(result.specialty_signals, ['override:force_include:curated_launch_pick']);
    assert.equal(result.is_public, true);
  });

  it('applies force-exclude overrides deterministically', () => {
    const result = classifySpecialtyProduct({
      ...makeClassificationInput({
        raw: { externalId: 'manual-2', name: 'Colombia El Paraiso' },
        normalized: {
          external_id: 'manual-2',
          origin_country: 'Colombia',
          origin_farm: 'El Paraiso',
          process: 'washed',
          flavor_notes_normalized: ['jasmine', 'peach'],
          sca_score: 87,
        },
      }),
      roasterId: 'roaster-1',
      override: {
        roaster_id: 'roaster-1',
        external_id: 'manual-2',
        override_action: 'force_exclude',
        reason: 'not_currently_public',
      },
    });

    assert.equal(result.specialty_status, 'not_specialty');
    assert.equal(result.specialty_rejection_reason, 'not_currently_public');
    assert.deepEqual(result.specialty_signals, ['override:force_exclude:not_currently_public']);
    assert.equal(result.is_public, false);
  });
});

function makeClassificationInput(overrides: {
  raw?: Partial<RawProduct>;
  normalized?: Partial<NormalizedCoffee>;
}) {
  const raw: RawProduct = {
    externalId: 'test-product',
    name: 'Test Product',
    description: '',
    price: 500,
    currency: 'TRY',
    weightGrams: 250,
    imageUrl: null,
    productUrl: 'https://example.test/products/test-product',
    isAvailable: true,
    tags: [],
    ...overrides.raw,
  };

  const normalized: NormalizedCoffee = {
    external_id: raw.externalId,
    name: raw.name,
    name_normalized: raw.name,
    origin_country: null,
    origin_region: null,
    origin_farm: null,
    origin_altitude: null,
    origin_producer: null,
    process: 'unknown',
    process_detail: null,
    roast_level: 'unknown',
    variety: null,
    harvest_year: null,
    roast_date: null,
    flavor_notes: [],
    flavor_notes_normalized: [],
    flavor_categories: [],
    sca_score: null,
    price_amount: raw.price,
    price_currency: raw.currency,
    weight_grams: raw.weightGrams,
    price_per_100g: null,
    product_url: raw.productUrl,
    image_url: raw.imageUrl,
    is_available: raw.isAvailable,
    is_decaf: false,
    brew_methods: [],
    brew_recipes: [],
    ...overrides.normalized,
  };

  return { raw, normalized };
}
