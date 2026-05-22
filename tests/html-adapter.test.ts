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
