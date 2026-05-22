import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildQuizFilterResult } from '@/lib/quiz-filters';

describe('buildQuizFilterResult', () => {
  it('maps all quiz answers to catalog filters and explanations', () => {
    const result = buildQuizFilterResult({
      brewMethod: ['filter'],
      flavorCategory: ['Fruity', 'Floral'],
      process: ['washed'],
      roastLevel: ['light'],
      pricePer100g: '120_200',
    });

    assert.equal(
      result.url,
      '/coffees?brewMethod=filter&flavorCategory=Fruity&flavorCategory=Floral&process=washed&roastLevel=light&priceMin=120&priceMax=200'
    );
    assert.deepEqual(result.explanations, [
      'Demleme uyumu: Filter / Pour Over.',
      'Tat kategorisi: Meyvemsi, Çiçeksi.',
      'İşleme: Yıkanmış.',
      'Kavurma seviyesi: Açık.',
      'Bütçe: 120-200 TL/100 g aralığı.',
    ]);
    assert.deepEqual(result.filters, {
      brewMethod: ['filter'],
      flavorCategory: ['Fruity', 'Floral'],
      process: ['washed'],
      roastLevel: ['light'],
      priceMin: 120,
      priceMax: 200,
    });
  });

  it('keeps optional preferences from adding fake filters', () => {
    const result = buildQuizFilterResult({
      brewMethod: [],
      flavorCategory: [],
      process: [],
      roastLevel: [],
      pricePer100g: 'any',
    });

    assert.equal(result.url, '/coffees');
    assert.deepEqual(result.explanations, [
      'Bütçe: fiyat sınırı eklenmedi.',
    ]);
    assert.deepEqual(result.filters, {});
  });

  it('keeps roast answers aligned to exact catalog roast_level values', () => {
    const result = buildQuizFilterResult({
      brewMethod: [],
      flavorCategory: [],
      process: [],
      roastLevel: ['medium_light', 'medium', 'medium_dark'],
      pricePer100g: null,
    });

    assert.equal(
      result.url,
      '/coffees?roastLevel=medium_light&roastLevel=medium&roastLevel=medium_dark'
    );
    assert.deepEqual(result.explanations, [
      'Kavurma seviyesi: Orta-Açık, Orta, Orta-Koyu.',
    ]);
  });

  it('dedupes selections and ignores unsupported catalog values', () => {
    const result = buildQuizFilterResult({
      brewMethod: ['filter', 'filter', 'unknown-brew'],
      flavorCategory: ['Fruity', 'Unknown'],
      process: ['experimental', 'unknown'],
      roastLevel: ['medium', 'unknown'],
      pricePer100g: 'under_120',
    });

    assert.equal(
      result.url,
      '/coffees?brewMethod=filter&flavorCategory=Fruity&process=experimental&roastLevel=medium&priceMax=120'
    );
    assert.deepEqual(result.filters, {
      brewMethod: ['filter'],
      flavorCategory: ['Fruity'],
      process: ['experimental'],
      roastLevel: ['medium'],
      priceMax: 120,
    });
  });
});
