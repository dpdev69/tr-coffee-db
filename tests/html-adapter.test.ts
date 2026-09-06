import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-key';

describe('parseProbadorProducts', () => {
  it('keeps roasted coffee cards and excludes equipment and sample sets', async () => {
    const { parseProbadorProducts } = await import('../scrapers/src/adapters/html-adapter.ts');

    const products = parseProbadorProducts(
      `
      <div class="products-lists">
        <div class="list">
          <a class="image" href="/danse-mormora-ozel-hasat-dogal-etiyopya">
            <img src="/_upload/productimages/danse.jpg" alt="DANSE MORMORA ÖZEL HASAT DOĞAL, ETİYOPYA">
            <div class="name">DANSE MORMORA ÖZEL HASAT DOĞAL, ETİYOPYA</div>
            <div class="note">kakao, kuru lavanta, şekerleme tatlılığı</div>
          </a>
          <div class="buttons">
            <div class="variantprice active" data-stock="79">
              <div class="price"><small>₺</small><span>745.</span><samp>00</samp></div>
            </div>
            <button>250gr Öğütülmemiş</button>
          </div>
        </div>
        <div class="list">
          <a class="image" href="/el-yapimi-seramik-kahve-fincanlari">
            <div class="name">EL YAPIMI SERAMİK KAHVE FİNCANLARI</div>
          </a>
          <div class="variantprice active" data-stock="20">
            <div class="price"><small>₺</small><span>720.</span><samp>00</samp></div>
          </div>
        </div>
        <div class="list">
          <a class="image" href="/yikanmis-kahveler-1">
            <div class="name">YIKANMIŞ KAHVELER 1</div>
          </a>
          <div class="variantprice active" data-stock="36">
            <div class="price"><small>₺</small><span>916.</span><samp>00</samp></div>
          </div>
        </div>
      </div>
      `,
      {
        slug: 'probador',
        name: 'Probador Colectiva',
        websiteUrl: 'https://probadorcolectiva.com',
        shopUrl: 'https://probadorcolectiva.com/urunler',
        platform: 'custom',
        city: 'Istanbul',
        priceFormat: 'tl',
        structuredDataParser: 'probador-products',
      }
    );

    assert.equal(products.length, 1);
    assert.equal(products[0].externalId, 'danse-mormora-ozel-hasat-dogal-etiyopya');
    assert.equal(products[0].price, 745);
    assert.equal(products[0].weightGrams, 250);
    assert.equal(products[0].isAvailable, true);
  });

  it('drops unsafe product and image URLs from Probador-style HTML', async () => {
    const { parseProbadorProducts } = await import('../scrapers/src/adapters/html-adapter.ts');

    const products = parseProbadorProducts(
      `
      <div class="products-lists">
        <div class="list">
          <a class="image" href="javascript:alert(document.domain)">
            <img src="data:text/html,pwned">
            <div class="name">ETİYOPYA YIKANMIŞ KAHVE</div>
            <div class="note">çiçeksi, narenciye</div>
          </a>
          <div class="variantprice active" data-stock="12">
            <div class="price">₺745,00</div>
          </div>
        </div>
        <div class="list">
          <a class="image" href="//evil.example/phish">
            <div class="name">KOLOMBİYA NATURAL KAHVE</div>
            <div class="note">meyvemsi</div>
          </a>
          <div class="variantprice active" data-stock="12">
            <div class="price">₺700,00</div>
          </div>
        </div>
      </div>
      `,
      {
        slug: 'probador',
        name: 'Probador Colectiva',
        websiteUrl: 'https://probadorcolectiva.com',
        shopUrl: 'https://probadorcolectiva.com/urunler',
        platform: 'custom',
        city: 'Istanbul',
        priceFormat: 'tl',
        structuredDataParser: 'probador-products',
      }
    );

    assert.deepEqual(products, []);
  });
});

describe('HtmlAdapter URL policy', () => {
  it('ignores malicious base tags, unsafe schemes, and off-roaster product links', async () => {
    const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
    const { HtmlAdapter } = await import('../scrapers/src/adapters/html-adapter.ts');
    const originalGet = axios.get.bind(axios);

    try {
      axios.get = (async () => ({
        data: `
          <base href="https://evil.example/">
          <div class="product">
            <a class="title" href="javascript:alert(1)">Ethiopia Washed Coffee</a>
            <span class="price">₺500,00</span>
            <img src="https://evil.example/coffee.jpg">
          </div>
          <div class="product">
            <a class="title" href="//evil.example/phish">Colombia Natural Coffee</a>
            <span class="price">₺550,00</span>
            <img src="/coffee.jpg">
          </div>
          <div class="product">
            <a class="title" href="/safe-coffee">Kenya Washed Coffee</a>
            <span class="price">₺600,00</span>
            <img src="data:text/html,pwned">
          </div>
          <a class="next" href="//evil.example/page-2">Next</a>
        `,
        headers: {},
      })) as typeof axios.get;

      const adapter = new HtmlAdapter({
        ...makeCustomConfig(),
        selectors: {
          ...makeCustomConfig().selectors,
          productLink: 'a.title',
          productName: 'a.title',
          nextPage: 'a.next',
        },
      });

      const products = await adapter.fetchProducts();

      assert.equal(products.length, 1);
      assert.equal(products[0].productUrl, 'https://example.test/safe-coffee');
      assert.equal(products[0].imageUrl, null);
    } finally {
      axios.get = originalGet;
    }
  });
});

describe('HtmlAdapter next-data structured images', () => {
  it('does not let coffee keyword hints override non-coffee product exclusions', async () => {
    const payload = makeNextDataPayload();
    payload.props.pageProps.productList.push({
      ...payload.props.pageProps.productList[0],
      name: 'Matcha Demleme Seti',
      metaData: { slug: 'matcha-demleme-seti' },
    });
    const products = await fetchNextDataProductsWithHtml(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`,
      { coffeeProductKeywords: ['kahve'] }
    );
    assert.deepEqual(products.map((product) => product.name), ['Colombia Filter Coffee']);
  });

  it('keeps coffees with brewing advice and embedded styles while excluding accessories', async () => {
    const payload = makeNextDataPayload();
    const coffee = payload.props.pageProps.productList[0];
    coffee.description = '<style>.scale-bar { color: red; }</style><script>track()</script><p>Yıkanmış kahve. V60 veya AeroPress ile demleyin.</p>';
    payload.props.pageProps.productList.push({
      ...coffee,
      name: 'Hario V60 Dripper',
      description: 'Kahve demleme ekipmanı',
      metaData: { slug: 'hario-v60-dripper' },
    });

    const products = await fetchNextDataProductsWithHtml(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>`
    );

    assert.deepEqual(products.map((product) => product.name), ['Colombia Filter Coffee']);
    assert.match(products[0].description, /Yıkanmış kahve/);
    assert.doesNotMatch(products[0].description, /scale-bar|track\(\)|color: red/);
  });

  it('excludes Paper chocolate and a coffee sampler placed in the Kahve category', async () => {
    const payload = makeNextDataPayload();
    for (const [name, description] of [
      ['Mixed Fruit Box - 200 gr', "Seçeceğiniz 50'er gr lık 4 paket kahve."],
      ['Paper Chocolate - El Salvador La Carrera %25 Kakao Nibi - Sütlü Çikolata', 'Kakao çekirdeği, şeker pancarı'],
      ['Paper Chocolate - El Salvador La Carrera %70 Kakao Nibi - Bitter Çikolata', 'Kakao çekirdeği, şeker pancarı'],
    ]) {
      payload.props.pageProps.productList.push({
        ...payload.props.pageProps.productList[0],
        name,
        description,
        metaData: { slug: name.toLowerCase().replaceAll(' ', '-') },
      });
    }
    const products = await fetchNextDataProductsWithHtml(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`,
      { coffeeProductKeywords: ['kahve'] }
    );
    assert.deepEqual(products.map((product) => product.name), ['Colombia Filter Coffee']);
  });

  it('builds IKAS CDN images from __NEXT_DATA__ variant image IDs', async () => {
    const products = await fetchNextDataProductsWithHtml(`
      <script id="__NEXT_DATA__" type="application/json">
        ${JSON.stringify(makeNextDataPayload({
          configJson: {
            cdnUrl: 'https://cdn.myikas.com/',
            merchantSettings: { merchantId: 'merchant-123' },
          },
          variantImages: [
            {
              imageId: 'secondary-image',
              isMain: false,
              isVideo: false,
              order: 2,
            },
            {
              imageId: 'main-image',
              isMain: true,
              isVideo: false,
              order: 1,
            },
          ],
        }))}
      </script>
    `);

    assert.equal(products.length, 1);
    assert.equal(
      products[0].imageUrl,
      'https://cdn.myikas.com/images/merchant-123/main-image/image_1080.webp'
    );
  });

  it('uses a trusted IKAS CDN image from JSON-LD ItemList products', async () => {
    const products = await fetchNextDataProductsWithHtml(`
      <script id="__NEXT_DATA__" type="application/json">
        ${JSON.stringify(makeNextDataPayload())}
      </script>
      <script type="application/ld+json">
        ${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              item: {
                '@type': 'Product',
                name: 'Colombia Filter Coffee',
                url: 'https://example.test/products/colombia-filter-coffee',
                image: [
                  'https://cdn.myikas.com/images/colombia-filter-coffee.jpg',
                ],
              },
            },
          ],
        })}
      </script>
    `);

    assert.equal(products.length, 1);
    assert.equal(
      products[0].imageUrl,
      'https://cdn.myikas.com/images/colombia-filter-coffee.jpg'
    );
  });

  it('ignores untrusted JSON-LD image hosts', async () => {
    const products = await fetchNextDataProductsWithHtml(`
      <script id="__NEXT_DATA__" type="application/json">
        ${JSON.stringify(makeNextDataPayload())}
      </script>
      <script type="application/ld+json">
        ${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Colombia Filter Coffee',
          url: 'https://example.test/colombia-filter-coffee',
          image: 'https://evil.example/colombia-filter-coffee.jpg',
        })}
      </script>
    `);

    assert.equal(products.length, 1);
    assert.equal(products[0].imageUrl, null);
  });

  it('uses trusted IKAS product-card images from rendered srcsets', async () => {
    const products = await fetchNextDataProductsWithHtml(`
      <a href="/products/colombia-filter-coffee">
        <img
          alt="Colombia Filter Coffee main variant image"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
          style="background-image:url(&quot;https://cdn.myikas.com/images/store/image-id/10/colombia.webp&quot;)"
        >
        <noscript>
          <img
            alt="Colombia Filter Coffee main variant image"
            srcSet="https://cdn.myikas.com/images/store/image-id/180/colombia.webp 180w, https://cdn.myikas.com/images/store/image-id/1080/colombia.webp 1080w"
          >
        </noscript>
      </a>
      <script id="__NEXT_DATA__" type="application/json">
        ${JSON.stringify(makeNextDataPayload())}
      </script>
    `);

    assert.equal(products.length, 1);
    assert.equal(
      products[0].imageUrl,
      'https://cdn.myikas.com/images/store/image-id/1080/colombia.webp'
    );
  });
});

describe('structured retail offers', () => {
  it('takes the TRY price and single package weight from the same product offer', async () => {
    const { parseCatalogPriceText, parseProductPagePackageSelection } = await import('../scrapers/src/adapters/html-adapter.ts');
    assert.equal(parseCatalogPriceText('$19.95', makeCustomConfig()), null);
    assert.equal(parseCatalogPriceText('19,95 EUR', makeCustomConfig()), null);
    const product = {
      '@type': 'Product', description: 'Taze kavrulmuş 250 g kahve çekirdeği.',
      offers: { priceCurrency: 'TRY', price: '1300.00', availability: 'https://schema.org/InStock' },
    };
    const html = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
    const selected = parseProductPagePackageSelection(html(product), makeCustomConfig(), 19.95);
    assert.equal(selected?.price, 1300);
    assert.equal(selected?.weightGrams, 250);
    assert.equal(selected?.isAvailable, true);
    assert.equal(parseProductPagePackageSelection(html({ ...product, offers: { ...product.offers, priceCurrency: 'USD' } }), makeCustomConfig(), 19.95), null);
    assert.equal(parseProductPagePackageSelection(html({ ...product, description: '250 g ve 1 kg seçenekleri' }), makeCustomConfig(), 19.95), null);
  });
});

describe('parseCatalogPriceText', () => {
  it('uses the first visible catalog price from Turkish ranges and sale strings', async () => {
    const { parseCatalogPriceText } = await import('../scrapers/src/adapters/html-adapter.ts');
    const config = makeCustomConfig();

    assert.equal(parseCatalogPriceText('650,00 ₺ – 3.200,00 ₺', config), 650);
    assert.equal(
      parseCatalogPriceText('1.100,00 ₺ – 5.500,00 ₺Fiyat aralığı: 1.100,00 ₺ - 5.500,00 ₺', config),
      1100
    );
    assert.equal(parseCatalogPriceText('₺ 250.00 - ₺ 2,100.00', config), 250);
  });
});

describe('parsePackageWeight', () => {
  it('treats Turkish thousands separators in gram values as thousands', async () => {
    const { parsePackageWeight } = await import('../scrapers/src/adapters/package-selection.ts');

    assert.equal(parsePackageWeight('1.000 gr'), 1000);
    assert.equal(parsePackageWeight('1,000 gr'), 1000);
    assert.equal(parsePackageWeight('4 x 250gr'), 1000);
    assert.equal(parsePackageWeight('0,5 kg'), 500);
  });

  it('does not read Turkish words that start with g as gram units', async () => {
    const { parsePackageWeight } = await import('../scrapers/src/adapters/package-selection.ts');

    assert.equal(parsePackageWeight('Q Grader Sertifikasyon Programı (6 Gün)'), null);
    assert.equal(parsePackageWeight('Kurs: 2 Gün'), null);
  });
});

describe('parseProductPagePackageSelection', () => {
  it('uses absolute product-page package prices when no base package option exists', async () => {
    const { parseProductPagePackageSelection } = await import('../scrapers/src/adapters/html-adapter.ts');

    const selected = parseProductPagePackageSelection(
      `
        <div class="product-price"><span>₺300,00</span></div>
        <div class="attributes">
          <dl>
            <dt><label>GRAMAJ</label></dt>
            <dd>
              <ul>
                <li><input id="w250" type="radio"><label for="w250">250 Gr [+₺450,00]</label></li>
              </ul>
            </dd>
          </dl>
        </div>
      `,
      makeCustomConfig(),
      300
    );

    assert.equal(selected?.price, 450);
    assert.equal(selected?.weightGrams, 250);
  });

  it('adds product-page package deltas when a base package option is present', async () => {
    const { parseProductPagePackageSelection } = await import('../scrapers/src/adapters/html-adapter.ts');

    const selected = parseProductPagePackageSelection(
      `
        <div class="product-price"><span>₺200,00</span></div>
        <div class="attributes">
          <dl>
            <dt><label>GRAMAJ</label></dt>
            <dd>
              <ul>
                <li><input id="w100" type="radio"><label for="w100">100 Gr</label></li>
                <li><input id="w250" type="radio"><label for="w250">250 Gr [+₺300,00]</label></li>
              </ul>
            </dd>
          </dl>
        </div>
      `,
      makeCustomConfig(),
      200
    );

    assert.equal(selected?.price, 500);
    assert.equal(selected?.weightGrams, 250);
  });
});

describe('parseProductPageMetadata', () => {
  it('extracts structured product detail rows for normalization', async () => {
    const { parseProductPageMetadata } = await import('../scrapers/src/adapters/html-adapter.ts');

    const metadata = parseProductPageMetadata(`
      <div id="product-tab-description">
        <table>
          <tr><td>Menşe ülke</td><td>Kosta Rika</td></tr>
          <tr><td>İşleme yöntemi</td><td>Yıkanmış</td></tr>
          <tr><td>Kavurma Derecesi</td><td>Light</td></tr>
        </table>
        Pürüzsüz tatlı çok temiz bir yıkanmış.
      </div>
      <meta name="description" content="Kosta Rika honey işlem kahve">
    `);

    assert.deepEqual(metadata.attributes, [
      { name: 'Menşe ülke', terms: [{ name: 'Kosta Rika' }] },
      { name: 'İşleme yöntemi', terms: [{ name: 'Yıkanmış' }] },
      { name: 'Kavurma Derecesi', terms: [{ name: 'Light' }] },
    ]);
    assert.match(metadata.description, /Menşe ülke: Kosta Rika/);
    assert.match(metadata.description, /Kosta Rika honey işlem kahve/);
  });

  it('extracts colon-delimited product details from list-based pages', async () => {
    const { parseProductPageMetadata } = await import('../scrapers/src/adapters/html-adapter.ts');

    const metadata = parseProductPageMetadata(`
      <div class="woocommerce-Tabs-panel--description">
        <ul>
          <li><strong>Ülke: Colombia</strong></li>
          <li><strong>İşlem: Honey & Wine Yeast</strong></li>
        </ul>
      </div>
    `);

    assert.deepEqual(metadata.attributes, [
      { name: 'Ülke', terms: [{ name: 'Colombia' }] },
      { name: 'İşlem', terms: [{ name: 'Honey & Wine Yeast' }] },
    ]);
  });
});

function makeCustomConfig() {
  return {
    slug: 'test-html',
    name: 'Test HTML',
    websiteUrl: 'https://example.test',
    shopUrl: 'https://example.test/shop',
    platform: 'custom' as const,
    city: 'Istanbul',
    priceFormat: 'tl' as const,
    selectors: {
      productList: '.product',
      productLink: 'a',
      productName: '.title',
      productPrice: '.price',
      productImage: 'img',
      description: '',
    },
  };
}

function makeNextDataConfig() {
  return {
    slug: 'test-ikas',
    name: 'Test IKAS',
    websiteUrl: 'https://example.test',
    shopUrl: 'https://example.test/kahve',
    platform: 'ikas' as const,
    city: 'Istanbul',
    priceFormat: 'tl' as const,
    structuredDataParser: 'next-data-products' as const,
  };
}

function makeNextDataPayload({
  configJson = {},
  variantImages = [],
}: {
  configJson?: Record<string, unknown>;
  variantImages?: Array<Record<string, unknown>>;
} = {}) {
  return {
    props: {
      pageProps: {
        configJson,
        productList: [
          {
            name: 'Colombia Filter Coffee',
            description: 'Fresh roasted kahve',
            metaData: { slug: 'colombia-filter-coffee' },
            categories: [{ name: 'Kahve' }],
            tags: [],
            variants: [
              {
                isActive: true,
                stock: 4,
                prices: [{ sellPrice: 650 }],
                variantValues: [{ name: '250 Gr' }],
                images: variantImages,
              },
            ],
          },
        ],
      },
    },
  };
}

async function fetchNextDataProductsWithHtml(html: string, overrides: { coffeeProductKeywords?: string[] } = {}) {
  const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
  const { HtmlAdapter } = await import('../scrapers/src/adapters/html-adapter.ts');
  const originalGet = axios.get.bind(axios);

  try {
    axios.get = (async () => ({
      data: html,
      headers: {},
    })) as typeof axios.get;

    const adapter = new HtmlAdapter({ ...makeNextDataConfig(), ...overrides });
    return adapter.fetchProducts();
  } finally {
    axios.get = originalGet;
  }
}
