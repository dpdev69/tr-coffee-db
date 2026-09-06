import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyCatalogFailures } from '../scripts/image-health-policy.ts';

describe('image audit catalog coverage', () => {
  it('fails an empty current catalog even when there are no missing images', () => {
    assert.deepEqual(emptyCatalogFailures(0), [
      'No current public available coffees found; catalog freshness or scraper ingestion may be broken.',
    ]);
  });

  it('continues image checks when current coffees are present', () => {
    assert.deepEqual(emptyCatalogFailures(1), []);
    assert.deepEqual(emptyCatalogFailures(500), []);
  });
});
