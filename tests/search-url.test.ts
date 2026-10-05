import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGlobalSearchUrl } from '@/lib/search-url';

describe('buildGlobalSearchUrl', () => {
  it('navigates to the catalog with a normalized query from any route', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/quiz',
        currentQuery: 'step=2',
        nextSearch: '  Kenya, V60  ',
      }),
      '/kahveler?search=Kenya+V60'
    );
  });

  it('preserves catalog filters, including package price, and clears pagination', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/kahveler',
        currentQuery: 'origin=Kenya&priceMin=120&page=3&sort=price_asc',
        nextSearch: 'espresso',
      }),
      '/kahveler?search=espresso&origin=Kenya&priceMin=120&sort=price_asc'
    );
  });

  it('clears search when the submitted query is empty', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/kahveler',
        currentQuery: 'search=Kenya&page=2',
        nextSearch: ' ,,, ',
      }),
      '/kahveler'
    );
  });
});
