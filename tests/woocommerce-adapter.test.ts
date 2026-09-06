import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-key';

describe('WooCommerceAdapter', () => {
  it('excludes a configured wholesale source product even when its coffee category is missing', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const { oldJava } = await import('../scrapers/src/roasters/configs.ts');
    const originalGet = axios.get.bind(axios);

    try {
      const wholesale = {
        ...makeWooProduct({
          id: 3415,
          name: 'Café Abyssinia / Etiopía',
          categories: [],
          price: '60000',
          minorUnit: 2,
          attributes: [makeAttribute('Miktar', ['1 X 60kg', '5 X 60kg', '10 X 60kg'])],
          variations: [{ id: 3419, attributes: [{ name: 'Miktar', value: '1-x-60kg' }] }],
        }),
        slug: 'cafe-abyssinia-etiopia',
      };
      axios.get = (async () => ({
        data: [wholesale, makeWooProduct({ name: 'Ethiopia Guji 250g', categories: [] })],
        headers: { 'x-wp-totalpages': '1' },
      })) as typeof axios.get;

      const products = await new WooCommerceAdapter({ ...oldJava, ...makeConfig() }).fetchProducts();
      assert.deepEqual(products.map((product) => product.name), ['Ethiopia Guji 250g']);
      assert.equal(products[0].weightGrams, 250);
    } finally {
      axios.get = originalGet;
    }
  });

  it('preserves the upstream error instead of reporting an empty catalog', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async () => {
        throw new Error('timeout of 30000ms exceeded');
      }) as typeof axios.get;

      await assert.rejects(
        new WooCommerceAdapter(makeConfig()).fetchProducts(),
        /WooCommerce Store API failed on page 1: timeout of 30000ms exceeded/
      );
    } finally {
      axios.get = originalGet;
    }
  });

  it('keeps WooCommerce short descriptions so roast profile metadata reaches normalization', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const { normalize } = await import('../scrapers/src/normalization/index.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async () => ({
        data: [
          makeWooProduct({
            name: 'Brazil Yellow Bourbon – Espresso',
            categories: ['Espresso Kahveler', 'KAHVELER'],
            description: '<p>Long origin story without an explicit roast label.</p>',
            shortDescription: '<p><strong>Kavurma profili: Espresso</strong></p>',
          }),
        ],
        headers: { 'x-wp-totalpages': '1' },
      })) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      const products = await adapter.fetchProducts();
      const coffee = normalize(products[0]);

      assert.match(products[0].description, /Long origin story/);
      assert.match(products[0].description, /Kavurma profili: Espresso/);
      assert.equal(coffee.roast_level, 'medium_dark');
    } finally {
      axios.get = originalGet;
    }
  });

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

  it('uses the retail comparison variation instead of the first weight term for price per 100g', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async (url: string) => {
        if (url.endsWith('/wp-json/wc/store/v1/products/2501')) {
          return {
            data: makeWooProduct({
              id: 2501,
              name: 'Brazil Yellow Bourbon',
              categories: ['Kahveler'],
              price: '39000',
              minorUnit: 2,
              variation: 'Gramaj: 250gr, Öğütülme Şekli: Çekirdek',
            }),
            headers: {},
          };
        }

        return {
          data: [
            makeWooProduct({
              name: 'Brazil Yellow Bourbon',
              categories: ['Kahveler'],
              price: '39000',
              minorUnit: 2,
              attributes: [
                makeAttribute('Gramaj', ['1000gr', '250gr', '4 x 250gr.']),
                makeAttribute('Öğütülme Şekli', ['Çekirdek', 'Espresso']),
              ],
              variations: [
                makeVariation(1001, '4-x-250gr'),
                makeVariation(2501, '250gr'),
                makeVariation(1000, '1000gr'),
              ],
            }),
          ],
          headers: { 'x-wp-totalpages': '1' },
        };
      }) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      const products = await adapter.fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].price, 390);
      assert.equal(products[0].weightGrams, 250);
    } finally {
      axios.get = originalGet;
    }
  });

  it('falls through to the next preferred variation instead of mixing parent price with selected weight', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async (url: string) => {
        if (url.endsWith('/wp-json/wc/store/v1/products/2501')) {
          throw new Error('variation unavailable');
        }

        if (url.endsWith('/wp-json/wc/store/v1/products/1001')) {
          throw new Error('variation unavailable');
        }

        if (url.endsWith('/wp-json/wc/store/v1/products/5001')) {
          return {
            data: makeWooProduct({
              id: 5001,
              name: 'Costa Rica Honey',
              categories: ['Kahveler'],
              price: '65000',
              minorUnit: 2,
              variation: 'Gramaj: 500gr, Öğütülme Şekli: Çekirdek',
            }),
            headers: {},
          };
        }

        return {
          data: [
            makeWooProduct({
              name: 'Costa Rica Honey',
              categories: ['Kahveler'],
              price: '25000',
              minorUnit: 2,
              attributes: [makeAttribute('Gramaj', ['100gr', '250gr', '500gr'])],
              variations: [
                makeVariation(1001, '100gr'),
                makeVariation(2501, '250gr'),
                makeVariation(5001, '500gr'),
              ],
            }),
          ],
          headers: { 'x-wp-totalpages': '1' },
        };
      }) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      const products = await adapter.fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].price, 650);
      assert.equal(products[0].weightGrams, 500);
    } finally {
      axios.get = originalGet;
    }
  });

  it('tolerates WooCommerce variation attributes with null values', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { WooCommerceAdapter } = await import('../scrapers/src/adapters/woocommerce-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async () => ({
        data: [
          makeWooProduct({
            name: 'Espresso Kahve / Kolombiya',
            categories: ['Espresso', 'Filtre Kahve'],
            price: '33500',
            minorUnit: 2,
            attributes: [makeAttribute('Ağırlık', ['1000'])],
            variations: [
              {
                id: 2765,
                attributes: [
                  { name: 'Ağırlık', value: null },
                  { name: 'Öğütme', value: null },
                ],
              },
            ],
          }),
        ],
        headers: { 'x-wp-totalpages': '1' },
      })) as typeof axios.get;

      const adapter = new WooCommerceAdapter(makeConfig());
      const products = await adapter.fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].name, 'Espresso Kahve / Kolombiya');
      assert.equal(products[0].price, 335);
      assert.equal(products[0].weightGrams, 1000);
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
  id,
  name,
  categories,
  price = '500',
  minorUnit = 0,
  variation = '',
  variations = [],
  attributes = [],
  description = '',
  shortDescription = '',
}: {
  id?: number;
  name: string;
  categories: string[];
  price?: string;
  minorUnit?: number;
  variation?: string;
  variations?: Array<{ id: number; attributes: { name: string; value: string | null }[] }>;
  attributes?: Array<{ id: number; name: string; terms: { id: number; name: string; slug: string }[] }>;
  description?: string;
  shortDescription?: string;
}) {
  return {
    id: id ?? Math.floor(Math.random() * 100000),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parent: 0,
    type: 'simple',
    variation,
    permalink: `https://example.test/product/${encodeURIComponent(name)}`,
    sku: '',
    short_description: shortDescription,
    description,
    on_sale: false,
    prices: {
      price,
      regular_price: price,
      sale_price: price,
      price_range: null,
      currency_code: 'TRY',
      currency_symbol: '₺',
      currency_minor_unit: minorUnit,
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
    variations,
    attributes,
  };
}

function makeAttribute(name: string, terms: string[]) {
  return {
    id: Math.floor(Math.random() * 1000),
    name,
    terms: terms.map((term, index) => ({
      id: index + 1,
      name: term,
      slug: term.toLowerCase().replace(/\s+/g, '-'),
    })),
  };
}

function makeVariation(id: number, gramaj: string) {
  return {
    id,
    attributes: [
      { name: 'Gramaj', value: gramaj },
      { name: 'Öğütülme Şekli', value: 'cekirdek' },
    ],
  };
}
