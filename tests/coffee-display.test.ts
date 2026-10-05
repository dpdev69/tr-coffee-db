import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  displayCoffeeName,
  displayNotes,
  displayPackageLabel,
  formatMoney,
  formatPackageWeight,
  formatVerifiedAt,
  getSourceHost,
  getUnitPrice,
} from '@/lib/coffee-display';

describe('coffee display helpers', () => {
  it('calms capitals without guessing at codes or Turkish letters', () => {
    assert.equal(displayCoffeeName('25/26 KENYA KARIMIKUI AA SL28 SL34 GESHA/YIKANMIŞ'), '25/26 Kenya Karimikui AA SL28 SL34 Gesha/Yıkanmış');
    assert.equal(displayCoffeeName('TÜRK KAHVESİ HARMANI'), 'Türk Kahvesi Harmanı');
    assert.equal(displayCoffeeName('INDONESIA MAS IYAN'), 'Indonesia Mas Iyan');
    assert.equal(displayCoffeeName('Kenya Nyeri AA'), 'Kenya Nyeri AA');
  });
  it('drops store tags from tasting notes and tidies their casing', () => {
    assert.deepEqual(displayNotes(['Filtre Kahve', 'Etiyopya', 'Guatemala Antigua', 'Kosta Rika Tarrazu', 'FİZİKSEL MAĞAZA', 'ERİK', 'erik', 'kahve soğudukça çikolata notaları']), ['Erik', 'Kahve soğudukça çikolata notaları']);
  });
  it('shows a package option as its weight only when it says nothing else', () => {
    assert.equal(displayPackageLabel('GRAMAJ: 1000', 1000), '1 kg');
    assert.equal(displayPackageLabel('Miktar: 250 Gr', 250), '250 g');
    assert.equal(displayPackageLabel('250g', 500), '250g');
    assert.equal(displayPackageLabel('GRAMAJ: 200 G Plastik Şişe', 200), '200 G Plastik Şişe');
  });

  it('formats source check dates against the Turkish day boundary', () => {
    const now = new Date('2026-05-22T14:00:00+03:00');

    assert.equal(formatVerifiedAt('2026-05-22T01:00:00+03:00', now), 'Bugün kontrol edildi');
    assert.equal(formatVerifiedAt('2026-05-21T23:30:00+03:00', now), 'Dün kontrol edildi');
    assert.equal(formatVerifiedAt('2026-05-18T09:00:00+03:00', now), '4 gün önce kontrol edildi');
  });

  it('falls back for missing or invalid verification timestamps', () => {
    assert.equal(formatVerifiedAt(null), 'Kontrol tarihi bilinmiyor');
    assert.equal(formatVerifiedAt('not-a-date'), 'Kontrol tarihi bilinmiyor');
  });

  it('extracts source hosts and formats package weights', () => {
    assert.equal(getSourceHost('https://www.example.com/products/ethiopia'), 'example.com');
    assert.equal(getSourceHost('bad url'), null);
    assert.equal(formatPackageWeight(250), '250 g');
    assert.equal(formatPackageWeight(1000), '1 kg');
    assert.equal(formatPackageWeight(1500), '1.5 kg');
    assert.equal(formatPackageWeight(1250), '1.25 kg');
    assert.equal(formatPackageWeight(1001), '1.001 kg');
  });

  it('compares differently sized TRY packages by their computed 100 g price', () => {
    assert.equal(getUnitPrice({ price_amount: 500, weight_grams: 250, price_currency: 'TRY' }), 200);
    assert.equal(getUnitPrice({ price_amount: 1500, weight_grams: 1000, price_currency: 'TRY' }), 150);
    assert.equal(getUnitPrice({ price_amount: 125, weight_grams: 1250, price_currency: 'TRY' }), 10);
  });

  it('does not invent comparable prices for foreign currencies or invalid amounts', () => {
    assert.equal(getUnitPrice({ price_amount: 10, weight_grams: 250, price_currency: 'EUR' }), null);
    for (const invalid of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(getUnitPrice({ price_amount: invalid, weight_grams: 250, price_currency: 'TRY' }), null);
      assert.equal(getUnitPrice({ price_amount: 500, weight_grams: invalid, price_currency: 'TRY' }), null);
    }
    assert.equal(getUnitPrice({ price_amount: Number.MAX_VALUE, weight_grams: 0.01, price_currency: 'TRY' }), null);
  });

  it('formats money with Turkish separators and the actual currency', () => {
    assert.equal(formatMoney(1234.5), '1.234,5 TL');
    assert.equal(formatMoney(500), '500 TL');
    assert.equal(formatMoney(10.129, 'EUR'), '10,13 EUR');
    assert.equal(formatMoney(Number.NaN), '—');
  });
});
