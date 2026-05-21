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
    const config = {
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

    assert.equal(parseCatalogPriceText('650,00 ₺ – 3.200,00 ₺', config), 650);
    assert.equal(
      parseCatalogPriceText('1.100,00 ₺ – 5.500,00 ₺Fiyat aralığı: 1.100,00 ₺ - 5.500,00 ₺', config),
      1100
    );
    assert.equal(parseCatalogPriceText('₺ 250.00 - ₺ 2,100.00', config), 250);
  });
});
