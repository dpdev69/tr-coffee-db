import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPackageWeight, formatVerifiedAt, getSourceHost } from '@/lib/coffee-display';

describe('coffee display helpers', () => {
  it('formats verification dates against the local day boundary', () => {
    const now = new Date('2026-05-22T14:00:00+03:00');

    assert.equal(formatVerifiedAt('2026-05-22T01:00:00+03:00', now), 'Bugün doğrulandı');
    assert.equal(formatVerifiedAt('2026-05-21T23:30:00+03:00', now), 'Dün doğrulandı');
    assert.equal(formatVerifiedAt('2026-05-18T09:00:00+03:00', now), '4 gün önce doğrulandı');
  });

  it('falls back for missing or invalid verification timestamps', () => {
    assert.equal(formatVerifiedAt(null), 'Doğrulama bekliyor');
    assert.equal(formatVerifiedAt('not-a-date'), 'Doğrulama bekliyor');
  });

  it('extracts source hosts and formats package weights', () => {
    assert.equal(getSourceHost('https://www.example.com/products/ethiopia'), 'example.com');
    assert.equal(getSourceHost('bad url'), null);
    assert.equal(formatPackageWeight(250), '250 g');
    assert.equal(formatPackageWeight(1000), '1 kg');
    assert.equal(formatPackageWeight(1500), '1.5 kg');
  });
});
