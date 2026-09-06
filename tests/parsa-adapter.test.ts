import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-key';

describe('Parsa storefront API', () => {
  it('uses the available package price and weight together and preserves disclosed metadata', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { ParsaAdapter } = await import('../scrapers/src/adapters/parsa-adapter.ts');
    const { parsa } = await import('../scrapers/src/roasters/configs.ts');
    const { normalize } = await import('../scrapers/src/normalization/index.ts');
    const originalGet = axios.get.bind(axios);
    const calls: string[] = [];
    const coffee = fixture();

    try {
      axios.get = (async (url: string) => {
        calls.push(url);
        return { data: url.endsWith('/101') ? coffee : [coffee, { ...coffee, aktif: false }] };
      }) as typeof axios.get;
      const products = await new ParsaAdapter(parsa).fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].externalId, 'catalog-101');
      assert.equal(products[0].price, 1530);
      assert.equal(products[0].weightGrams, 1000);
      assert.equal(products[0].isAvailable, true);
      assert.equal(products[0].productUrl, 'https://parsacoffeeroasters.com/tr/kahve/101');
      assert.equal(products[0].imageUrl, 'https://parsacoffeeroasters.com/uploads/coffee.png');
      assert.equal(normalize(products[0]).process, 'natural');
      assert.equal(normalize(products[0]).price_per_100g, 153);
      assert.deepEqual(calls, [
        'https://parsacoffeeroasters.com/api/katalog/kahveler',
        'https://parsacoffeeroasters.com/api/katalog/kahveler/101',
      ]);
    } finally {
      axios.get = originalGet;
    }
  });

  it('fails incomplete package discovery so a partial run cannot mark other coffees unavailable', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { ParsaAdapter } = await import('../scrapers/src/adapters/parsa-adapter.ts');
    const { parsa } = await import('../scrapers/src/roasters/configs.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async (url: string) => ({
        data: url.endsWith('/101') ? { ...fixture(), varyasyonlar: [] } : [fixture()],
      })) as typeof axios.get;
      await assert.rejects(new ParsaAdapter(parsa).fetchProducts(), /no valid retail package/);
    } finally {
      axios.get = originalGet;
    }
  });
});

function fixture() {
  return {
    kod: '101', ad: 'Brazil Irmas Pereira', aktif: true,
    taban_fiyat_tl: '500.00', indirim_orani: 10, resim_url_on: '/uploads/coffee.png',
    koken_tr: 'Brezilya', origin: 'Irmas Pereira', islem_tr: 'Natürel',
    cultivar: 'Yellow Bourbon', rakim: '1075-1130 MASL',
    tadim_notlari_tr: 'Karamel, Sütlü Çikolata',
    varyasyonlar: [
      { gramaj: '250g', ek_fiyat_tl: '0', stok: 0, aktif: true },
      { gramaj: '1000g', ek_fiyat_tl: '1200', stok: 20, aktif: true },
    ],
  };
}
