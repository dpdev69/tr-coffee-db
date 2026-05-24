import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGlobalSearchUrl } from '@/lib/search-url';

describe('buildGlobalSearchUrl', () => {
  it('navigates to coffees with a normalized query from any route', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/quiz',
        nextSearch: '  Kenya, V60  ',
      }),
      '/coffees?search=Kenya+V60'
    );
  });

  it('preserves existing coffee filters and clears pagination on catalog searches', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/coffees',
        currentQuery: 'origin=Kenya&page=3&sort=price_asc',
        nextSearch: 'espresso',
      }),
      '/coffees?origin=Kenya&sort=price_asc&search=espresso'
    );
  });

  it('drops deprecated public price range params when preserving catalog filters', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/coffees',
        currentQuery: 'origin=Kenya&priceMin=120&priceMax=200&page=2',
        nextSearch: 'espresso',
      }),
      '/coffees?origin=Kenya&search=espresso'
    );
  });

  it('clears search when the submitted query is empty', () => {
    assert.equal(
      buildGlobalSearchUrl({
        pathname: '/coffees',
        currentQuery: 'search=Kenya&page=2',
        nextSearch: ' ,,, ',
      }),
      '/coffees'
    );
  });
});
