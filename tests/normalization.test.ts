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

  it('detects uppercase Turkish origin names with dotted characters', () => {
    const colombia = normalize(
      makeRawProduct({
        name: 'FINCA PORVENIR TABI YIKANMIŞ, KOLOMBİYA',
      })
    );
    const ethiopia = normalize(
      makeRawProduct({
        name: 'CHELCHELE DOĞAL, ETİYOPYA',
      })
    );
    const costaRica = normalize(
      makeRawProduct({
        name: 'LAS LAJAS CATUAI CATURRA RED HONEY, KOSTARİKA',
      })
    );

    assert.equal(colombia.origin_country, 'Colombia');
    assert.equal(ethiopia.origin_country, 'Ethiopia');
    assert.equal(costaRica.origin_country, 'Costa Rica');
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

  it('prefers structured process attributes over lower-confidence catalog text', () => {
    const coffee = normalize(
      makeRawProduct({
        name: 'Kolombiya Monteblanco',
        description: 'Natural kahveler koleksiyonundan seçki.',
        rawData: {
          categories: ['Natural Kahveler'],
          attributes: [
            { name: 'İşleme', terms: [{ name: 'Yıkanmış' }] },
          ],
        },
      })
    );

    assert.equal(coffee.process, 'washed');
    assert.equal(coffee.process_detail, 'Yıkanmış');
  });

  it('detects Turkish roast levels with dotted characters', () => {
    const coffee = normalize(
      makeRawProduct({
        name: 'Peru Amazonas Açık Kavurma',
      })
    );

    assert.equal(coffee.roast_level, 'light');
  });

  it('detects açık-orta roast phrasing as medium-light', () => {
    const coffee = normalize(
      makeRawProduct({
        description: 'Bu kahveyi açık–orta kavrum tercih ettik.',
      })
    );

    assert.equal(coffee.roast_level, 'medium_light');
  });

  it('prefers explicit roast labels over filter brew-method wording', () => {
    const coffee = normalize(
      makeRawProduct({
        description: 'Filtre için uygundur. Kavrum: Orta.',
      })
    );

    assert.equal(coffee.roast_level, 'medium');
    assert.deepEqual(coffee.brew_methods, ['filter']);
  });

  it('keeps filter and espresso profile wording out of roast inference', () => {
    const filterCoffee = normalize(
      makeRawProduct({
        name: 'Example Filtre',
        description: 'Filtre için uygundur.',
      })
    );
    const espressoCoffee = normalize(
      makeRawProduct({
        name: 'Example Espresso',
        description: 'Espresso için uygundur.',
      })
    );

    assert.equal(filterCoffee.roast_level, 'unknown');
    assert.deepEqual(filterCoffee.brew_methods, ['filter']);
    assert.equal(espressoCoffee.roast_level, 'unknown');
    assert.deepEqual(espressoCoffee.brew_methods, ['espresso']);
  });

  it('detects explicit filter and espresso roast profile labels', () => {
    const filterRoast = normalize(
      makeRawProduct({
        description: 'Roast Profile: Filter.',
      })
    );
    const espressoRoast = normalize(
      makeRawProduct({
        description: 'Kavrum: Espresso.',
      })
    );

    assert.equal(filterRoast.roast_level, 'medium_light');
    assert.equal(espressoRoast.roast_level, 'medium_dark');
  });

  it('does not treat grinder guidance as a medium roast signal', () => {
    const coffee = normalize(
      makeRawProduct({
        description: 'Demleme Reçetesi V60: Kahve 16 g, Su 250 ml. Öğütüm orta-ince.',
      })
    );

    assert.equal(coffee.roast_level, 'unknown');
  });

  it('extracts only high-confidence product-page brew recipes', () => {
    const coffee = normalize(
      makeRawProduct({
        description:
          'Demleme Reçetesi V60: Kahve 16 g, Su 250 ml, oran 1:15, 93 C. Öğütüm orta-ince. Bloom 45 sn. Toplam süre 2:30.',
      })
    );

    assert.equal(coffee.brew_recipes.length, 1);
    assert.equal(coffee.brew_recipes[0].method, 'Filter / Pour Over');
    assert.equal(coffee.brew_recipes[0].dose_grams, 16);
    assert.equal(coffee.brew_recipes[0].water_grams, 250);
    assert.equal(coffee.brew_recipes[0].ratio, '1:15');
    assert.equal(coffee.brew_recipes[0].water_temp_c, '93 C');
    assert.equal(coffee.brew_recipes[0].source, 'product_page');
  });

  it('does not turn generic brew method mentions into recipes', () => {
    const coffee = normalize(
      makeRawProduct({
        description: 'Filtre ve espresso için uygundur. Dengeli ve tatlı bir kahvedir.',
      })
    );

    assert.deepEqual(coffee.brew_recipes, []);
  });

  it('extracts crop year and roast date when product text exposes them', () => {
    const coffee = normalize(
      makeRawProduct({
        description: 'Hasat Yılı: 2024/25. Kavrum Tarihi: 10.05.2026.',
      })
    );

    assert.equal(coffee.harvest_year, '2024/25');
    assert.equal(coffee.roast_date, '10.05.2026');
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
