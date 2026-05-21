import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildQuizFilterResult } from '@/lib/quiz-filters';

describe('buildQuizFilterResult', () => {
  it('maps all quiz answers to catalog filters and explanations', () => {
    const result = buildQuizFilterResult({
      brew: 'filter',
      flavors: ['Fruity', 'Floral'],
      adventure: 'surprise',
      roast: 'light',
      budget: 'mid',
    });

    assert.equal(
      result.url,
      '/coffees?brewMethod=filter&flavorCategory=Fruity&flavorCategory=Floral&roastLevel=light&priceMin=120&priceMax=200&sort=newest'
    );
    assert.deepEqual(result.explanations, [
      'Demleme: Filter / V60 filtresi eklendi.',
      'Tat: Meyvemsi kahveler öne alındı.',
      'Tat: Çiçeksi notlar öne alındı.',
      'Kavrum: Açık kavrum filtresi eklendi.',
      'Bütçe: 250 g için 300-500 TL, 120-200 TL/100 g aralığına çevrildi.',
      'Keşif modu: daha yeni eklenen kahveler önce gösterilecek.',
    ]);
  });

  it('keeps optional preferences from adding fake filters', () => {
    const result = buildQuizFilterResult({
      brew: null,
      flavors: [],
      adventure: 'classic',
      roast: 'any',
      budget: 'any',
    });

    assert.equal(result.url, '/coffees?sort=popular');
    assert.deepEqual(result.explanations, [
      'Bütçe: fiyat sınırı eklenmedi.',
      'Keşif modu: daha çok ilgi gören kahveler önce gösterilecek.',
    ]);
  });

  it('expands medium roast quiz answers to adjacent medium roast filters', () => {
    const result = buildQuizFilterResult({
      brew: null,
      flavors: [],
      adventure: null,
      roast: 'medium',
      budget: null,
    });

    assert.equal(
      result.url,
      '/coffees?roastLevel=medium_light&roastLevel=medium&roastLevel=medium_dark'
    );
    assert.deepEqual(result.explanations, [
      'Kavrum: Orta, orta-açık ve orta-koyu kavrum filtreleri eklendi.',
    ]);
  });
});
