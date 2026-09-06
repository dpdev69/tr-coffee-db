import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateBrewAmount } from '@/lib/brew-calculator';
describe('brew calculator', () => {
  it('scales the cited starter recipes and keeps espresso as beverage yield', () => {
    assert.equal(calculateBrewAmount(15, 'filter'), 255);
    assert.equal(calculateBrewAmount(18, 'espresso'), 36);
    assert.equal(calculateBrewAmount(56, 'french_press'), 850);
    assert.equal(calculateBrewAmount(17, 'aeropress'), 220);
    assert.equal(calculateBrewAmount(7.5, 'filter'), 128);
  });
  it('rejects missing, nonfinite and out-of-range doses', () => {
    for (const value of [0, -1, 101, Infinity, NaN])
      assert.equal(calculateBrewAmount(value, 'filter'), null);
  });
});
