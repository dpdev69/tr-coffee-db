import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-key';

describe('WooCommerceAdapter', () => {
  it('retries Store API product discovery with an Imunify challenge cookie', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);
    const calls: Array<{ url: string; options: { headers?: Record<string, string> } }> = [];

    try {
      axios.get = (async (url: string, options: { headers?: Record<string, string> } = {}) => {
        calls.push({ url, options });

        if (calls.length === 1) {
          return {
            data: {
              message: 'Access denied by Imunify360 bot-protection. IPs used for automation should be whitelisted',
            },
            headers: {},
          };
        }

        return {
          data: [makeWooProduct({ name: 'Colombia La Loma', categories: ['Kahveler'] })],
          headers: { 'x-wp-totalpages': '1' },
        };
      }) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      (adapter as unknown as { createImunifyChallengeCookie: () => Promise<string> })
        .createImunifyChallengeCookie = async () => 'wssplashchk=test-cookie';

      const products = await adapter.fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].name, 'Colombia La Loma');
      assert.equal(calls.length, 2);
      assert.equal(calls[1].options.headers?.Cookie, 'wssplashchk=test-cookie');
    } finally {
      axios.get = originalGet;
    }
  });

  it('excludes WooCommerce accessory categories and non-catalog entries that contain coffee words', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async () => ({
        data: [
          makeWooProduct({ name: 'Brazil Carmo', categories: ['Kahveler'] }),
          makeWooProduct({ name: 'Comandante C40 Nitro Blade', categories: ['Kahve Öğütücüleri'] }),
          makeWooProduct({ name: 'Cafec TH-3 Filtre Kağıdı', categories: ['Filtre Kağıdı'] }),
          makeWooProduct({ name: 'Toptan Giriş', categories: ['Toptan Kahve'] }),
          makeWooProduct({ name: 'Poka Cold Brew (Şişe Dahil)(İçilmeye Hazır)', categories: ['Kahveler'] }),
          makeWooProduct({ name: 'Ekşi Maya Tam Çavdar Ekmeği', categories: [] }),
        ],
        headers: { 'x-wp-totalpages': '1' },
      })) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      const products = await adapter.fetchProducts();

      assert.deepEqual(products.map((product) => product.name), ['Brazil Carmo']);
    } finally {
      axios.get = originalGet;
    }
  });
});

function makeConfig() {
  return {
    slug: 'test-woo',
    name: 'Test Woo',
    websiteUrl: 'https://example.test',
    shopUrl: 'https://example.test',
    platform: 'woocommerce' as const,
    city: 'Istanbul',
    priceFormat: 'tl' as const,
  };
}

function makeWooProduct({
  name,
  categories,
}: {
  name: string;
  categories: string[];
}) {
  return {
    id: Math.floor(Math.random() * 100000),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parent: 0,
    type: 'simple',
    variation: '',
    permalink: `https://example.test/product/${encodeURIComponent(name)}`,
    sku: '',
    short_description: '',
    description: '',
    on_sale: false,
    prices: {
      price: '500',
      regular_price: '500',
      sale_price: '500',
      price_range: null,
      currency_code: 'TRY',
      currency_symbol: '₺',
      currency_minor_unit: 0,
      currency_decimal_separator: ',',
      currency_thousand_separator: '.',
      currency_prefix: '',
      currency_suffix: ' ₺',
    },
    images: [],
    categories: categories.map((category, index) => ({
      id: index + 1,
      name: category,
      slug: category.toLowerCase().replace(/\s+/g, '-'),
    })),
    tags: [],
    is_purchasable: true,
    is_in_stock: true,
    variations: [],
    attributes: [],
  };
}
