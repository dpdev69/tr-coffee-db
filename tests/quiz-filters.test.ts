import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildQuizFilterResult, hasQuizSelections } from '@/lib/quiz-filters';
import { parseDiscoveryFilters } from '@/components/v2/discovery-catalog';

describe('buildQuizFilterResult', () => {
  it('maps all quiz answers to catalog filters and explanations without price buckets', () => {
    const result = buildQuizFilterResult({
      brewMethod: ['filter'],
      flavorCategory: ['Fruity', 'Floral'],
      process: ['washed'],
      roastLevel: ['light'],
    });

    assert.equal(
      result.url,
      '/kahveler?brewMethod=filter&taste=Fruity&taste=Floral&process=washed&roast=light'
    );
    assert.deepEqual(result.explanations, [
      'Demleme uyumu: Filtre / Pour Over.',
      'Tat kategorisi: Meyvemsi, Çiçeksi.',
      'İşleme: Yıkanmış.',
      'Kavurma seviyesi: Açık.',
    ]);
    assert.deepEqual(result.filters, {
      brewMethod: ['filter'],
      flavorCategory: ['Fruity', 'Floral'],
      process: ['washed'],
      roastLevel: ['light'],
    });
  });

  it('keeps optional preferences from adding fake filters', () => {
    const result = buildQuizFilterResult({
      brewMethod: [],
      flavorCategory: [],
      process: [],
      roastLevel: [],
    });

    assert.equal(result.url, '/kahveler');
    assert.deepEqual(result.explanations, []);
    assert.deepEqual(result.filters, {});
    assert.equal(hasQuizSelections({
      brewMethod: [],
      flavorCategory: [],
      process: [],
      roastLevel: [],
    }), false);
  });

  it('keeps roast answers aligned to exact catalog roast_level values', () => {
    const result = buildQuizFilterResult({
      brewMethod: [],
      flavorCategory: [],
      process: [],
      roastLevel: ['medium_light', 'medium', 'medium_dark'],
    });

    assert.equal(
      result.url,
      '/kahveler?roast=medium_light&roast=medium&roast=medium_dark'
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
    });

    assert.equal(
      result.url,
      '/kahveler?brewMethod=filter&taste=Fruity&process=experimental&roast=medium'
    );
    assert.deepEqual(result.filters, {
      brewMethod: ['filter'],
      flavorCategory: ['Fruity'],
      process: ['experimental'],
      roastLevel: ['medium'],
    });
    assert.equal(hasQuizSelections(result.filters), true);
  });
});


it('hands all optional quiz selections to the live V2 catalog contract', () => {
  const result = buildQuizFilterResult({
    brewMethod: ['filter', 'espresso'],
    flavorCategory: ['Fruity', 'Chocolate'],
    process: ['washed'],
    roastLevel: ['light', 'medium'],
  });
  const url = new URL(result.url, 'https://kahvedrop.test');
  const params = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key)]));
  const catalog = parseDiscoveryFilters(params);
  assert.equal(url.pathname, '/kahveler');
  assert.deepEqual(catalog.brewMethod, ['filter', 'espresso']);
  assert.deepEqual(catalog.taste, ['Fruity', 'Chocolate']);
  assert.deepEqual(catalog.process, ['washed']);
  assert.deepEqual(catalog.roast, ['light', 'medium']);
});
