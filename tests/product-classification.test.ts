import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalize } from '../scrapers/src/normalization';
import { isLikelyCatalogCoffeeProduct } from '../scrapers/src/product-classification';
import { classifySpecialtyProduct } from '../scrapers/src/specialty-classification';
import type { NormalizedCoffee, RawProduct } from '../scrapers/src/types';

describe('isLikelyCatalogCoffeeProduct', () => {
  it('excludes Turkish filter-paper product titles with dotted Turkish characters', () => {
    assert.equal(isLikelyCatalogCoffeeProduct(['ABACA Filtre Kağıdı']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Cafec Abaca PLUS Filtre Kağıdı-CUP4']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Hario V60 02 Dripper Filtresi']), false);
  });

  it('excludes education, equipment, and campaign products before price normalization', () => {
    assert.equal(isLikelyCatalogCoffeeProduct(['Q Grader: Sertifikasyon Programı (6 Gün)']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['AeroPress']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Kinu M47']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Kenya + Fındık Kampanyası']), false);
    assert.equal(
      isLikelyCatalogCoffeeProduct(['Kahve Aboneliği 250 Gr. Haftalık Gönderim 6’lı Paket']),
      false
    );
    assert.equal(
      isLikelyCatalogCoffeeProduct(['Brazil Santos Fine Cup Çiğ Yeşil Çekirdek 1kg']),
      false
    );
    assert.equal(isLikelyCatalogCoffeeProduct(['Origami Air S']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['SCA Barista: Foundation + Intermediate']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Consultancy & Retakes']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Peak Water / Kahve Suyu']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Cold Brew Black & Strong Cam Şişe 200 Ml.']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Wastepresso & Candle + Friends Kahve Posalı Mum']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Aşırı Kolay Cold Brew']), false);
  });

  it('keeps cacao and chocolate tasting notes from excluding coffee cards', () => {
    assert.equal(
      isLikelyCatalogCoffeeProduct([
        'El Salvador / Shasta / Washed',
        'Fındık, Pekmez, Kakao',
        'https://coffeedepartment.co/el-salvador-shasta-washed',
      ]),
      true
    );
    assert.equal(isLikelyCatalogCoffeeProduct(['Kakao']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Çikolata Bar']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['PAU BRASIL (K.Vişne, Bdem, Bitter Çikolata)']), true);
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

  it('rejects stale non-bean catalog entries that previously looked like coffee', () => {
    for (const name of [
      'Baristocrat Sample Box',
      'Origami Air S',
      'SCA Roasting: Foundation + Intermediate',
      'Cold Brew Black & Strong Cam Şişe 200 Ml.',
      'Wastepresso & Candle + Friends Kahve Posalı Mum',
      'Aşırı Kolay Cold Brew',
    ]) {
      const result = classifySpecialtyProduct(
        makeClassificationInput({
          raw: { name },
          normalized: {
            name,
            name_normalized: name,
            origin_country: null,
            process: 'unknown',
          },
        })
      );

      assert.equal(result.specialty_status, 'not_specialty', name);
      assert.equal(result.specialty_rejection_reason, 'non_coffee_or_bundle', name);
      assert.equal(result.is_public, false, name);
    }
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

  it('publishes country-only coffee instead of treating sparse metadata as a failure', () => {
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

    assert.equal(result.specialty_status, 'specialty');
    assert.equal(result.specialty_rejection_reason, null);
    assert.equal(result.is_public, true);
  });

  it('publishes likely coffee even when specialty evidence is sparse', () => {
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

    assert.equal(result.specialty_status, 'specialty');
    assert.equal(result.specialty_rejection_reason, null);
    assert.equal(result.is_public, true);
  });

  it('rejects broad non-origin catalog entries but keeps origin espresso variants public', () => {
    const genericEspresso = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'ORDI NO:1 / ESPRESSO',
          description: 'Classic espresso profile.',
        },
        normalized: {
          name: 'ORDI NO:1 / ESPRESSO',
          name_normalized: 'ORDI NO:1 / ESPRESSO',
          process: 'unknown',
        },
      })
    );

    const originEspresso = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Etiyopya Hambela Espresso',
          description: 'Espresso roast.',
        },
        normalized: {
          name: 'Etiyopya Hambela Espresso',
          name_normalized: 'Etiyopya Hambela Espresso',
          origin_country: 'Ethiopia',
          process: 'unknown',
        },
      })
    );

    assert.equal(genericEspresso.specialty_status, 'not_specialty');
    assert.equal(genericEspresso.specialty_rejection_reason, 'broad_catalog_entry');
    assert.equal(originEspresso.specialty_status, 'specialty');
    assert.equal(originEspresso.is_public, true);
  });

  it('qualifies structured country, lot, and process titles with sparse cards', () => {
    const result = classifySpecialtyProduct(
      makeClassificationInput({
        raw: {
          name: 'Brazil / Diamantina / Natural',
          description: '',
        },
        normalized: {
          name: 'Brazil / Diamantina / Natural',
          name_normalized: 'Brazil / Diamantina / Natural',
          origin_country: 'Brazil',
          process: 'natural',
        },
      })
    );

    assert.equal(result.specialty_status, 'specialty');
    assert.equal(result.is_public, true);
    assert.equal(result.specialty_score, 4);
    assert.ok(result.specialty_signals.includes('structured_single_origin_title'));
  });

  it('recognizes compact Turkish Costa Rica spelling for origin parsing', () => {
    const raw = makeClassificationInput({
      raw: {
        name: 'LAS LAJAS CATUAI CATURRA RED HONEY, KOSTARIKA',
        description: '',
      },
    }).raw;

    const normalized = normalize(raw);

    assert.equal(normalized.origin_country, 'Costa Rica');
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
