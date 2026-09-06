import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-key';

describe('ShopifyAdapter catalog formats', () => {
  it('prices a 1 kg × 10 carton against its full 10 kg package weight', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { ShopifyAdapter } = await import('../scrapers/src/adapters/shopify-adapter.ts');
    const { normalize } = await import('../scrapers/src/normalization/index.ts');
    const originalGet = axios.get.bind(axios);
    let page = 0;

    try {
      axios.get = (async () => ({ data: { products: page++ === 0 ? [
        makeProduct('Colombia Supremo Huila Çekirdek Kahve 1 Kg x 10 Adet (Koli)', [
          makeVariant('Default Title', '8100.00'),
        ]),
      ] : [] } })) as typeof axios.get;
      const products = await new ShopifyAdapter({
        slug: 'test-shopify', name: 'Test Shopify', websiteUrl: 'https://example.test',
        shopUrl: 'https://example.test', platform: 'shopify', city: 'Istanbul',
        priceFormat: 'tl', productTypeFilter: ['kahve'],
      }).fetchProducts();

      assert.equal(products.length, 1);
      const coffee = normalize(products[0]);
      assert.equal(coffee.price_amount, 8100);
      assert.equal(coffee.weight_grams, 10000);
      assert.equal(coffee.price_per_100g, 81);
    } finally {
      axios.get = originalGet;
    }
  });

  it('excludes bottled drinks and gift samplers while retaining cold-brew coffee beans', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { ShopifyAdapter } = await import('../scrapers/src/adapters/shopify-adapter.ts');
    const originalGet = axios.get.bind(axios);
    let page = 0;
    const bottle = makeVariant('Sonraki Üretim Tarihinde Gönderim / 250ML Cam Şişe X 1 Adet', '150.00');
    const beans = makeVariant('250 gr / Çekirdek', '600.00');

    try {
      axios.get = (async () => ({ data: { products: page++ === 0 ? [
        makeProduct('Soğuk Demleme Panama Ninety Plus: Juliette', [bottle]),
        makeProduct('Reserve Gift Set', [makeVariant('90 gr', '900.00')]),
        makeProduct('Cold Brew Beans Colombia', [beans]),
        makeProduct('Colombia Coffee', [bottle, { ...beans, available: false }]),
        makeProduct('Ethiopia Coffee', [bottle, beans]),
      ] : [] } })) as typeof axios.get;

      const products = await new ShopifyAdapter({
        slug: 'test-shopify', name: 'Test Shopify', websiteUrl: 'https://example.test',
        shopUrl: 'https://example.test', platform: 'shopify', city: 'Istanbul',
        priceFormat: 'tl', productTypeFilter: ['kahve'],
      }).fetchProducts();

      assert.deepEqual(products.map((product) => product.name), ['Cold Brew Beans Colombia', 'Colombia Coffee', 'Ethiopia Coffee']);
      assert.equal(products[1].price, 600);
      assert.equal(products[1].weightGrams, 250);
      assert.equal(products[1].isAvailable, false);
      assert.deepEqual(products[1].variants?.map((variant) => variant.title), ['250 gr / Çekirdek']);
      assert.equal(products[2].price, 600);
      assert.equal(products[2].weightGrams, 250);
      assert.equal(products[2].isAvailable, true);
    } finally {
      axios.get = originalGet;
    }
  });
});

function makeVariant(title: string, price: string) {
  return { id: 1, title, price, available: true, grams: 0 };
}

function makeProduct(title: string, variants: ReturnType<typeof makeVariant>[]) {
  return {
    id: title.length, title, handle: title.toLowerCase().replaceAll(' ', '-'),
    body_html: '<p>Taze kavrulmuş kahve</p>', product_type: 'Taze Kavrulmuş Kahve',
    tags: ['Kahve'], images: [], variants,
  };
}
