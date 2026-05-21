import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isLikelyCatalogCoffeeProduct } from '../scrapers/src/product-classification';

describe('isLikelyCatalogCoffeeProduct', () => {
  it('excludes Turkish filter-paper product titles with dotted Turkish characters', () => {
    assert.equal(isLikelyCatalogCoffeeProduct(['ABACA Filtre Kağıdı']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Cafec Abaca PLUS Filtre Kağıdı-CUP4']), false);
    assert.equal(isLikelyCatalogCoffeeProduct(['Hario V60 02 Dripper Filtresi']), false);
  });
});
