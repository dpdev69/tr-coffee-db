import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { crawlRoaster } from '../scrapers/src/v2/crawl.ts';
import { canonicalUrl, money } from '../scrapers/src/v2/primitives.ts';
import { choOptions, parseChoProduct, parseIdeaProduct, parseKafeinProduct, parseKronotropProduct, parseMilestonesProduct, parseProbadorCatalog, parseTicimaxProduct, parseIkasPage, parseIkasProducts, parseParsaProduct, parseShopifyPage, parseStructuredProductPage, parseWooProduct } from '../scrapers/src/v2/parsers.ts';
import type { RoasterConfig } from '../scrapers/src/types.ts';

const fixture = (name: string) => readFile(new URL(`./fixtures/v2/${name}`, import.meta.url), 'utf8');
const json = async (name: string) => JSON.parse(await fixture(name));
const config: RoasterConfig = { slug: 'test', name: 'Test', websiteUrl: 'https://example.test', shopUrl: 'https://example.test', platform: 'shopify', city: 'Unknown', priceFormat: 'tl' };
const response = (body: unknown, status = 200, headers?: Record<string, string>) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const noWait = { requestDelayMs: 0, sleep: async () => {} };

describe('V2 pure adapter contracts', () => {
  it('preserves all Shopify IDs, offer-coupled prices, raw source and unknowns', async () => {
    const product = parseShopifyPage(await json('shopify.json'), config)[0];
    assert.equal(product.sourceProductId, '101');
    assert.deepEqual(product.offers.map(o => [o.sourceVariantId, o.weightG, o.price, o.inStock]), [
      ['1001', 250, 500, false], ['1002', 1000, 1500, true], ['1003', null, 300, null],
    ]);
    assert.equal(product.offers[0].compareAtPrice, 600);
    assert.match(product.offers[0].purchaseUrl, /variant=1001/);
    assert.ok(product.rawMetadata.sourceData);
    assert.equal(product.rawMetadata.country, undefined);
  });
  it('uses Woo minor-unit zero without config fallback and keeps variation identity', async () => {
    const data = await json('woocommerce.json');
    const product = parseWooProduct(data.product, data.variations, { ...config, priceFormat: 'kurus' });
    assert.deepEqual(product.offers.map(o => [o.sourceVariantId, o.price, o.weightG, o.inStock]), [['2001', 500, 250, false], ['2002', 1800, 1000, true]]);
    assert.equal(product.canonicalUrl, 'https://example.test/product/ethiopia');
    assert.throws(() => parseWooProduct(data.product, data.variations.slice(1), config), /incomplete/);
  });
  it('keeps IKAS variant IDs and unknown stock; missing IDs fail closed', async () => {
    const html = await fixture('ikas.html');
    const product = parseIkasPage(html, config)[0];
    assert.deepEqual(product.offers.map(o => [o.sourceVariantId, o.price, o.inStock]), [['v1', 500, false], ['v2', 1800, null]]);
    assert.throws(() => parseIkasPage(html.replace('"id":"v1",', ''), config), /variant ID missing/);
  });
  it('keeps an uncategorised IKAS coffee named by its origin; a bean-to-bar bar with an origin stays hidden', () => {
    // Gourme, 2026-10-05: "Etiyopya Chelchele Limited Edition" has no category and was kept only by a per-roaster origin list.
    const ikas = (id: string, name: string) => ({ id, name, metaData: { slug: id }, categories: [], tags: [], variants: [{ id: `${id}-v`, prices: [{ sellPrice: 900 }], stocks: [{ stockCount: 3 }] }] });
    const products = parseIkasProducts([ikas('peru', 'Peru Finca Churupampa Limited Edition'), ikas('ETIOPYA', 'ETİYOPYA GUJI'), ikas('bar', 'Kolombiya Opita - Bean To Bar Çikolata 45gr'), ikas('shirt', 'Calibre Design T-Shirt')], { ...config, platform: 'ikas' });
    assert.deepEqual(products.map(p => [p.name, p.visibility]), [['Peru Finca Churupampa Limited Edition', 'public'], ['ETİYOPYA GUJI', 'public'], ['Kolombiya Opita - Bean To Bar Çikolata 45gr', 'hidden']]);
  });
  it('keeps Parsa raw origin/producer and every package with stable source option keys', async () => {
    const product = parseParsaProduct(await json('parsa.json'), config);
    assert.equal(product.sourceProductId, '101');
    assert.equal(product.rawMetadata.producer, 'Example Producer');
    assert.deepEqual(product.offers.map(o => [o.identityKey, o.weightG, o.price, o.inStock]), [['gramaj:250g', 250, 450, false], ['gramaj:1000g', 1000, 1530, true]]);
  });
  it('uses same-offer JSON-LD stock/price/weight and rejects aggregate ranges', async () => {
    const html = await fixture('structured-product.html');
    const product = parseStructuredProductPage(html, config, 'https://example.test/product/ethiopia');
    assert.deepEqual(product.offers.map(o => [o.sourceVariantId, o.weightG, o.price, o.inStock]), [['sku-250', 250, 500, true], ['sku-1000', 1000, 1500, false]]);
    assert.throws(() => parseStructuredProductPage(html.replace('"@type":"Offer"', '"@type":"AggregateOffer"'), config, product.canonicalUrl), /Aggregate/);
  });
  it('strips tracking while preserving variant parameters and path identity', () => {
    assert.equal(canonicalUrl('/a/b?variant=7&utm_source=email#x', config), 'https://example.test/a/b?variant=7');
    assert.notEqual(canonicalUrl('/a/b', config), canonicalUrl('/a-b', config));
    assert.throws(() => canonicalUrl('https://evil.test/p', config), /allowlist/);
  });
  it('rejects malformed price, negative, infinite and unsafe identifiers', async () => {
    for (const value of [-1, Infinity, NaN, '500abc', '1,000']) assert.throws(() => money(value));
    assert.equal(money(null), null); assert.equal(money('0.00'), 0);
    const data = await json('shopify.json'); data.products[0].id = 9007199254740992;
    assert.throws(() => parseShopifyPage(data, config), /identifier/);
  });
});

describe('V2 complete-discovery and request safety', () => {
  it('returns complete Shopify source snapshot without touching legacy persistence', async () => {
    const data = await json('shopify.json');
    const result = await crawlRoaster(config, { ...noWait, fetch: async () => response(data) });
    assert.equal(result.complete, true); assert.equal(result.products[0].offers.length, 3);
  });
  it('returns incomplete on second-page error and duplicate catalog records', async () => {
    const data = await json('shopify.json');
    const fullPage = { products: Array.from({ length: 250 }, (_, i) => ({ ...data.products[0], id: i + 1 })) };
    const result = await crawlRoaster(config, { ...noWait, fetch: async (url) => String(url).includes('page=1') ? response(fullPage) : response('Unavailable', 503) });
    assert.equal(result.complete, false); assert.equal(result.products.length, 250); assert.match(result.diagnostics[0].message, /503/);
    const duplicates = await crawlRoaster(config, { ...noWait, fetch: async () => response({ products: [data.products[0], data.products[0]] }) });
    assert.equal(duplicates.complete, false); assert.match(duplicates.diagnostics[0].message, /Duplicate/);
  });
  it('refuses pagination limit as a successful snapshot', async () => {
    const data = await json('shopify.json');
    const result = await crawlRoaster(config, { ...noWait, maxPages: 1, fetch: async () => response({ products: Array.from({ length: 250 }, (_, i) => ({ ...data.products[0], id: i + 1 })) }) });
    assert.equal(result.complete, false); assert.match(result.diagnostics[0].message, /Pagination limit/);
  });
  it('fetches every Woo variation and marks any missing variation incomplete', async () => {
    const data = await json('woocommerce.json');
    const woo = { ...config, platform: 'woocommerce' as const };
    const fetcher: typeof fetch = async url => new URL(String(url)).searchParams.get('type') === 'variation' ? response(data.variations) : response([data.product], 200, { 'x-wp-totalpages': '1' });
    assert.equal((await crawlRoaster(woo, { ...noWait, fetch: fetcher })).complete, true);
    const broken: typeof fetch = async (url, init) => new URL(String(url)).searchParams.get('type') === 'variation' ? response(data.variations.slice(0,1)) : fetcher(url, init);
    assert.equal((await crawlRoaster(woo, { ...noWait, fetch: broken })).complete, false);
  });
  it('Parsa catalog and detail identity must agree', async () => {
    const data = await json('parsa.json');
    const parsa = { ...config, platform: 'custom' as const, structuredDataParser: 'parsa-catalog' as const };
    const good = await crawlRoaster(parsa, { ...noWait, fetch: async url => response(String(url).endsWith('/101') ? data : [data]) });
    assert.equal(good.complete, true);
    const bad = await crawlRoaster(parsa, { ...noWait, fetch: async url => response(String(url).endsWith('/101') ? { ...data, kod: 'other' } : [data]) });
    assert.equal(bad.complete, false);
  });
  it('IKAS never claims initial embedded data establishes catalog completeness', async () => {
    const html = await fixture('ikas.html');
    const result = await crawlRoaster({ ...config, platform: 'ikas', structuredDataParser: 'next-data-products' }, { ...noWait, fetch: async () => response(html) });
    assert.equal(result.complete, false); assert.equal(result.products.length, 0);
  });
  for (const probador of [false]) it(`parses ${probador ? 'Probador' : 'generic HTML'} discovery but does not claim offer completeness`, async () => {
    const catalog = await fixture(probador ? 'probador-catalog.html' : 'html-catalog.html');
    const detail = await fixture('structured-product.html');
    const htmlConfig: RoasterConfig = { ...config, platform: 'custom', ...(probador ? { structuredDataParser: 'probador-products' } : { selectors: { productList: '.product', productLink: 'a', productName: '.title', productPrice: '.price', productImage: 'img', description: '' } }) };
    const result = await crawlRoaster(htmlConfig, { ...noWait, fetch: async url => response(String(url).includes('/product/') ? detail : catalog) });
    assert.equal(result.complete, false); assert.equal(result.products.length, 1); assert.equal(result.products[0].offers.length, 2);
  });
  it('refuses challenges without executing script or fetching cookies', async () => {
    let calls = 0;
    const result = await crawlRoaster(config, { ...noWait, fetch: async () => { calls++; return response('<script>throw new Error("execute")</script>Please wait while your request is being verified'); } });
    assert.equal(calls, 1); assert.equal(result.complete, false); assert.match(result.diagnostics[0].message, /challenge/);
  });
  it('does not follow off-roaster redirects', async () => {
    let calls = 0;
    const result = await crawlRoaster(config, { ...noWait, fetch: async () => { calls++; return response('', 302, { location: 'https://evil.test/private' }); } });
    assert.equal(calls, 1); assert.equal(result.complete, false); assert.match(result.diagnostics[0].message, /allowlist/);
  });
  it('empty catalog and exhausted request budget remain incomplete', async () => {
    const empty = await crawlRoaster(config, { ...noWait, fetch: async () => response({ products: [] }) });
    assert.equal(empty.complete, false); assert.equal(empty.diagnostics[0].code, 'empty_catalog');
    const budget = await crawlRoaster(config, { ...noWait, maxRequests: 1, fetch: async () => response('', 302, { location: '/next' }) });
    assert.equal(budget.complete, false); assert.match(budget.diagnostics[0].message, /budget/);
  });
});

describe('V2 read-only legacy comparison', () => {
  it('reports source ID changes and avoids pretending legacy prices prove a same-SKU difference', async () => {
    const { compareSnapshots } = await import('../scrapers/src/v2/compare.ts');
    const product = parseParsaProduct(await json('parsa.json'), config);
    const old = { externalId: 'catalog-101', name: product.name, description: '', price: 450, currency: 'TRY', weightGrams: 250, imageUrl: null, productUrl: product.canonicalUrl, isAvailable: false };
    const result = compareSnapshots([old], { roasterSlug: 'test', parserVersion: 'test', complete: true, products: [product], diagnostics: [] }, config);
    assert.equal(result.v2Offers, 2);
    assert.deepEqual(result.differences.map(item => item.kind), ['identity_change', 'offer_comparison_ambiguous']);
  });
});

describe('Live-source regression cases (2026-09-14)', () => {
  it('treats Petra zero compare-at and current prices as unknown instead of failing the roaster', async () => {
    const data = await json('shopify.json'); data.products[0].variants[0].compare_at_price = '0.00';
    assert.equal(parseShopifyPage(data, config)[0].offers[0].compareAtPrice, null);
    data.products[0].variants[0].price = '0.00';
    assert.equal(parseShopifyPage(data, config)[0].offers[0].price, null);
  });
  it('sums Parsa zero base-price component with positive per-package surcharge', async () => {
    const data = await json('parsa.json');
    data.taban_fiyat_tl = '0.00'; data.indirim_orani = 0;
    data.varyasyonlar = [{ id: 127, gramaj: '250g', ek_fiyat_tl: '950.00', stok: 287, aktif: true }];
    const product = parseParsaProduct(data, config);
    assert.equal(product.offers[0].sourceVariantId, '127');
    assert.equal(product.offers[0].price, 950);
    data.varyasyonlar[0].ek_fiyat_tl = '0.00';
    assert.equal(parseParsaProduct(data, config).offers[0].price, null);
  });
});

describe('Captured public source specimens', () => {
  it('parses minimally retained Petra, Daphne and Parsa facts from 2026-09-14', async () => {
    const data = await json('live-public-samples.json');
    const { petra, daphne, parsa } = await import('../scrapers/src/roasters/configs.ts');
    const shopify = parseShopifyPage(data.shopify, petra)[0];
    assert.equal(shopify.offers.length, 2);
    assert.equal(shopify.offers[1].compareAtPrice, null);
    const woo = parseWooProduct(data.woocommerce.product, data.woocommerce.variations, daphne);
    assert.ok(woo.offers.every(offer => offer.price !== null && offer.price > 0));
    const custom = parseParsaProduct(data.parsa, parsa);
    assert.equal(custom.offers[0].price, 950);
    assert.equal(custom.offers[0].sourceVariantId, '127');
  });
});

describe('Configured coffee-category HTML sources', () => {
  it('retains origin-only coffee names without requiring a redundant coffee keyword', async () => {
    const catalog = await fixture('html-catalog.html');
    const detail = (await fixture('structured-product.html')).replace('Ethiopia Coffee', 'Kenya Kirinyaga Washed');
    const result = await crawlRoaster({ ...config, platform: 'custom', selectors: { productList: '.product', productLink: 'a', productName: '.title', productPrice: '.price', productImage: 'img', description: '' } }, { ...noWait, fetch: async url => response(String(url).includes('/product/') ? detail : catalog) });
    assert.equal(result.products[0].name, 'Kenya Kirinyaga Washed');
    assert.equal(result.complete, false);
  });
});

describe('Additional live taxonomy regressions', () => {
  it('keeps origin-only Shopify coffees when a curated roaster has no type filters', async () => {
    const data = await json('shopify.json');
    data.products[0].title = 'BREZİLYA MANTIQUEIRA'; data.products[0].product_type = ''; data.products[0].tags = [];
    assert.equal(parseShopifyPage(data, config).length, 1);
  });
  it('excludes a source-declared training ticket before validating its zero-price ticket variants', async () => {
    const data = await json('shopify.json');
    data.products[0].title = 'CoffeeNutz Kahve Barı'; data.products[0].product_type = 'Kahve Eğitimi'; data.products[0].variants[0].price = '0.00';
    assert.equal(parseShopifyPage(data, { ...config, productTypeFilter: ['kahve'] }).length, 0);
  });
});

it('excludes bottled-only Shopify drinks while missing source SKU arrays fail closed', async () => {
  const data = await json('shopify.json'); data.products[0].variants = [{ id: 1, title: 'Cam Şişe', price: '500', available: true }];
  assert.equal(parseShopifyPage(data, config).length, 0);
  data.products[0].variants = [];
  assert.throws(() => parseShopifyPage(data, config), /no retail variants/);
});

it('excludes Woo gift mugs and ready-to-drink bottled coffee using source taxonomy', async () => {
  const { isWooCoffee } = await import('../scrapers/src/v2/parsers.ts');
  assert.equal(isWooCoffee({ name: 'Poka Kızı Kahve Kupası', categories: [{ name: 'Hediyelikler' }] }, config), false);
  assert.equal(isWooCoffee({ name: 'Poka Cold Brew (Şişe Dahil)(İçilmeye Hazır)', categories: [{ name: 'Kahveler' }] }, config), false);
  assert.equal(isWooCoffee({ name: 'Colombia Cold Brew Coffee', categories: [{ name: 'Kahveler' }] }, config), true);
});

it('retains uncategorized origin-only coffees from curated Woo roasters', async () => {
  const { isWooCoffee } = await import('../scrapers/src/v2/parsers.ts');
  assert.equal(isWooCoffee({ name: 'Guatemala Rio Dorado Pacamara FW', categories: [], tags: [] }, config), true);
  assert.equal(isWooCoffee({ name: 'Hario V60 Dripper', categories: [], tags: [] }, config), false);
});

describe('Specialty eligibility is retained independently from raw observations', () => {
  it('keeps generic blends and broad catalog entries hidden while retaining every source offer', async () => {
    const data = await json('shopify.json');
    for (const title of ['House Blend', 'Espresso Harmanı', 'Türk Kahvesi', 'Filtre Kahve']) {
      data.products[0].title = title; data.products[0].body_html = ''; data.products[0].tags = []; data.products[0].product_type = 'Coffee';
      const parsed = parseShopifyPage(data, config)[0];
      assert.equal(parsed.visibility, 'hidden', title); assert.equal(parsed.offers.length, 3);
      assert.equal(parsed.rawMetadata.country, undefined); assert.ok(parsed.features?.some(f => f.feature === 'catalog_eligibility' && f.sourceType === 'RULE_INFERRED'));
    }
  });
  it('recognizes filter paper with intervening coffee words and source equipment taxonomy', async () => {
    const data = await json('shopify.json');
    for (const title of ['Coffee Filters Brown Filtre Kahve Kağıdı 4 Numara (80 Adet)', 'Filtre Kahve Kagidi', 'Coffee Filters White']) {
      data.products[0].title = title; data.products[0].tags = []; data.products[0].product_type = 'Coffee';
      assert.equal(parseShopifyPage(data, config)[0].visibility, 'hidden', title);
    }
    data.products[0].title = 'Coffee Gear'; data.products[0].tags = ['Equipment'];
    assert.equal(parseShopifyPage(data, config)[0].visibility, 'hidden');
  });
  it('keeps traceable origin coffee and DESCAFECOL public without a CAFEC substring false positive', async () => {
    const data = await json('shopify.json');
    for (const title of ['Ethiopia Guji Natural', 'Kolombiya DESCAFECOL']) {
      data.products[0].title = title; data.products[0].tags = []; data.products[0].product_type = 'Coffee';
      assert.equal(parseShopifyPage(data, config)[0].visibility, 'public', title);
    }
  });
  it('applies the same specialty policy to Woo and Parsa', async () => {
    const woo = await json('woocommerce.json'); woo.product.name = 'House Blend';
    assert.equal(parseWooProduct(woo.product, woo.variations, config).visibility, 'hidden');
    const parsa = await json('parsa.json'); parsa.ad = 'House Blend';
    assert.equal(parseParsaProduct(parsa, config).visibility, 'hidden');
  });
});

describe('Current source profiles survive a successful crawl without claiming inferred facts as declared', () => {
  it('derives named Guatemala origin, process, flavor, variety and brew features with versioned provenance', async () => {
    const data = await json('shopify.json');
    data.products[0].title = 'Guatemala Finca Example Bourbon';
    data.products[0].body_html = '<p>Washed. Light roast. Tasting notes: jasmine, peach, chocolate. Brew with filter coffee.</p>';
    data.products[0].tags = []; data.products[0].handle = 'example';
    const parsed = parseShopifyPage(data, config)[0];
    const features = new Map(parsed.features?.map(f => [f.feature, f]));
    assert.deepEqual(features.get('normalized_origin')?.value, ['Guatemala']);
    assert.deepEqual(features.get('process_family')?.value, ['washed']);
    assert.ok((features.get('flavor_families')?.value as string[]).includes('Floral'));
    assert.ok((features.get('brew_compatibility')?.value as string[]).includes('filter'));
    assert.ok(features.get('normalized_variety'));
    for (const feature of parsed.features!.filter(f => f.feature !== 'catalog_eligibility')) {
      assert.equal(feature.sourceType, 'RULE_INFERRED'); assert.equal(feature.confidence, null);
      assert.equal(feature.version, 'v2-profile-4'); assert.equal(feature.sourceReference, parsed.canonicalUrl);
    }
    assert.equal(parsed.rawMetadata.country, undefined); assert.equal(parsed.rawMetadata.process, undefined);
    assert.deepEqual(parsed.rawMetadata.tastingNotes,['jasmine','peach','chocolate'],'source-labeled tasting notes are declared; following brew prose is excluded');
  });
  it('never infers Panama from Gesha alone or from a source URL and keeps unknown profiles empty', async () => {
    const data = await json('shopify.json'); data.products[0].body_html = ''; data.products[0].tags = []; data.products[0].product_type = '';
    data.products[0].handle = 'panama';
    for (const title of ['Gesha', 'Rare Coffee']) {
      data.products[0].title = title;
      const parsed = parseShopifyPage(data, config)[0];
      assert.equal(parsed.features?.find(f => f.feature === 'normalized_origin'), undefined, title);
      assert.equal(parsed.features?.find(f => f.feature === 'flavor_families'), undefined, title);
    }
    data.products[0].title = 'Gesha from Guatemala';
    assert.deepEqual(parseShopifyPage(data, config)[0].features?.find(f => f.feature === 'normalized_origin')?.value, ['Guatemala']);
    data.products[0].title = 'Panama Gesha';
    assert.deepEqual(parseShopifyPage(data, config)[0].features?.find(f => f.feature === 'normalized_origin')?.value, ['Panama']);
  });
});

it('preserves only an explicit valid source SCA score, never specialty scoring or inferred legacy ratings', async () => {
  const data = await json('shopify.json');
  const original = data.products[0];
  const declared = parseShopifyPage({ products: [{ ...original, sca_score: 87.5, specialty_score: 9 }] }, config)[0];
  assert.equal(declared.rawMetadata.scaScore, 87.5);
  for (const sca_score of [null, '87.5', -1, 101]) {
    const value = parseShopifyPage({ products: [{ ...original, sca_score, specialty_score: 9 }] }, config)[0];
    assert.equal(value.rawMetadata.scaScore, undefined);
  }
});

describe('complete storefront variants',()=>{
  it('uses every IKAS catalog page and the selected price list and warehouse; count drift fails closed',async()=>{
    const context={apiUrl:'https://api.myikas.com/api/sf/graphql',apiKey:'public-fixture',storefrontId:'store',storefrontRoutingId:'route',routings:[{id:'route',currencyCode:'TRY',locale:'tr',priceListId:'try'}],salesChannelId:'sales',stockLocationIds:['warehouse'],cdnUrl:'https://cdn.myikas.com',merchantSettings:{merchantId:'merchant'}};
    const product=(id:number)=>({id:String(id),name:'Ethiopia Coffee',description:'Coffee',metaData:{slug:'coffee-'+id},categories:[{name:'Coffee'}],variants:[{id:'v'+id,isActive:true,variantValues:[{name:'250 g'}],prices:[{priceListId:'other',sellPrice:2},{priceListId:'try',sellPrice:500}],stocks:[{stockLocationId:'other',stockCount:0},{stockLocationId:'warehouse',stockCount:2}],images:[]}]});
    let drift=false;
    const fetch:typeof globalThis.fetch=async(_,init)=>{if(!init?.body)return response(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{configJson:context}}})}</script>`);const page=JSON.parse(String(init.body)).variables.input.page;return response({data:{searchProducts:{count:drift&&page===2?52:51,page,results:page===1?Array.from({length:50},(_,i)=>product(i)):[product(50)]}}});};
    const cfg={...config,platform:'custom' as const,structuredDataParser:'next-data-products' as const};
    const result=await crawlRoaster(cfg,{...noWait,fetch});assert.equal(result.complete,true);assert.equal(result.products.length,51);assert.equal(result.products[0].offers[0].price,500);assert.equal(result.products[0].offers[0].inStock,true);
    drift=true;assert.equal((await crawlRoaster(cfg,{...noWait,fetch})).complete,false);
  });
  it('handles source-declared unavailable Woo parents and zero-price archived SKUs without inventing a price',async()=>{
    const raw=(await json('woocommerce.json')).product;
    const parent=parseWooProduct({...raw,type:'variable',is_in_stock:false,variations:[]},[],config);assert.equal(parent.unavailable,true);assert.equal(parent.offers.length,0);
    assert.throws(()=>parseWooProduct({...raw,type:'variable',is_in_stock:true,variations:[]},[],config),/SKU discovery/);
    const single=parseWooProduct({...raw,type:'simple',is_in_stock:false,variations:[],prices:{price:'0',regular_price:'0',currency_code:'TRY',currency_minor_unit:2}},[],config);
    assert.equal(single.offers[0].price,null);assert.equal(single.offers[0].inStock,false);
  });
  it('keeps Probador prices attached to their option IDs and rejects missing variant evidence',()=>{
    const html='<div class="products-lists"><div class="list"><a class="image" href="/ethiopia"></a><div class="name">Ethiopia Coffee</div><select id="variant1"><option value="11">250 g</option><option value="12">1 kg</option></select><div class="variantprice" id="variantprice11" data-stock="0"><span class="price">500</span></div><div class="variantprice" id="variantprice12" data-stock="2"><span class="price">1800</span></div></div></div>';
    assert.deepEqual(parseProbadorCatalog(html,config)[0].offers.map(o=>[o.sourceVariantId,o.price,o.inStock]),[['11',500,false],['12',1800,true]]);
    assert.throws(()=>parseProbadorCatalog(html.replace('variantprice12','missing'),config),/price missing/);
  });
  it('folds Turkish upper case in Probador names so sets are skipped and İ-spelled origins are kept',()=>{
    const card=(name:string,variants:boolean)=>`<div class="list"><a class="image" href="/x"></a><div class="name">${name}</div>${variants?'<select id="variant7"><option value="71">250gr</option></select>':''}<div class="variantprice" id="variantprice71" data-stock="1"><span class="price">745</span></div></div>`;
    const html=`<div class="products-lists">${card('PERU GEISHA SETİ',false)}${card('KOSTARİKA İŞLEM/TÜR ÖRNEKLEM SETİ',false)}${card('YIKANMIŞ KAHVELER 1',false)}${card('CHELCHELE DOĞAL, ETİYOPYA',true)}</div>`;
    assert.deepEqual(parseProbadorCatalog(html,config).map(p=>p.name),['CHELCHELE DOĞAL, ETİYOPYA']);
  });
  it('uses Ticimax tax-inclusive variant prices and explicit option mappings',()=>{
    const model={productId:1,productName:'Ethiopia Coffee',products:[{id:10,satisFiyati:500,satisKDV:50,indirimliFiyati:0,stokAdedi:2,paraBirimiKodu:'TRY'}],productVariantData:[{urunID:10,tanim:'250 g'}],productImages:[]};
    const parse=()=>parseTicimaxProduct(`<script>var productDetailModel = ${JSON.stringify(model)};</script>`,config,'https://example.test/coffee');
    assert.deepEqual([parse().offers[0].price,parse().offers[0].weightG],[550,250]);model.productVariantData[0].urunID=11;assert.throws(parse,/mapping missing/);
  });
  it('resolves Kronotrop option surcharges and Milestones base-plus-option prices',()=>{
    const structured={...JSON.parse('{"@type":"Product","name":"Ethiopia Coffee","description":"250 g","offers":{"price":500,"priceCurrency":"TRY","availability":"https://schema.org/InStock"}}')};
    const html=`<script type="application/ld+json">${JSON.stringify(structured)}</script><form id="single"><input name="id" value="1"><select name="product_variant_group_id[3][product_variant_value_id]"><option value="1" data-price="0.00">Bean</option><option value="2" data-price="20.00" disabled>Ground</option></select></form>`;
    assert.deepEqual(parseKronotropProduct(html,config,'https://example.test/coffee').offers.map(o=>[o.price,o.weightG,o.inStock]),[[500,250,true],[520,250,false]]);
    const milestone='<h1 class="product-title">Ethiopia Coffee</h1><button data-sepete-ekle="1"></button><ins data-guncel-fiyat="640,00"></ins><div class="product-variation-form"><a data-secenek-id="1" data-stok="2" data-fiyat="-">250g</a><a data-secenek-id="2" data-stok="0" data-fiyat="1920,00">1kg</a></div>';
    assert.deepEqual(parseMilestonesProduct(milestone,config,'https://example.test/coffee').offers.map(o=>[o.price,o.weightG,o.inStock]),[[640,250,true],[2560,1000,false]]);
    const image=milestone+'<div class="product-single"><img src="upload/coffee.jpg"></div>';
    const categoryConfig={...config,shopUrl:'https://example.test/kategori/kahveler-57/'};
    assert.equal(parseMilestonesProduct(image,categoryConfig,'https://example.test/urun/coffee').rawMetadata.imageUrl,'https://example.test/upload/coffee.jpg');
    assert.equal(parseMilestonesProduct('<base href="/media/">'+image,categoryConfig,'https://example.test/urun/coffee').rawMetadata.imageUrl,'https://example.test/media/upload/coffee.jpg');
    assert.equal(parseMilestonesProduct('<base href="https://evil.test/">'+image,categoryConfig,'https://example.test/urun/coffee').rawMetadata.imageUrl,'https://example.test/upload/coffee.jpg');
  });
  it('uses Kafein native option price/stock and IdeaSoft variant evidence without executing source scripts',()=>{
    const data={mainProductId:'1',mainProductName:'Ethiopia Coffee',mainProductUrl:'/coffee',hasVariants:true,variantProperties:{1:{options:{5:{product_id:'2',name:'250gr',saleable:false,price:500}}}}};
    const html='<script type="application/ld+json">{"@type":"Product","name":"Ethiopia Coffee","offers":{"price":500,"priceCurrency":"TRY"}}</script>';
    assert.deepEqual(parseKafeinProduct({data},html,config,'https://example.test/coffee').offers.map(o=>[o.sourceVariantId,o.price,o.inStock]),[['2',500,false]]);
    const idea='<script>pageParams = {product: {id:"2",fullName:"Ethiopia Coffee",variantName:"250 Gr",currency:"TRY",salePrice:849.99996}};</script><input data-selector="qty" data-stockamount="0">';
    assert.deepEqual(parseIdeaProduct(idea,config,'https://example.test/coffee').offers.map(o=>[o.sourceVariantId,o.weightG,o.price,o.inStock]),[['2',250,850,false]]);
  });
  it('checks Cho option coverage, response identity and conditional inventory before accepting a catalog',()=>{
    const html='<div id="product-ribbon-info" data-productid="1"></div><meta itemprop="name" content="Ethiopia Coffee"><meta itemprop="priceCurrency" content="TRY"><meta itemprop="availability" content="https://schema.org/InStock"><form id="product-details-form"><input name="__RequestVerificationToken" value="fixture"><div class="attributes"><select name="product_attribute_1"><option value="0">Select</option><option value="2">250 Gr</option></select></div></form>';
    const choice=choOptions(html).choices[0];const variants=[{...choice,data:{productId:1,price:'₺1.250,00',stockAvailability:'',disabledattributemappingids:[]}}];
    assert.equal(parseChoProduct(html,config,'https://example.test/coffee',variants).offers[0].price,1250);
    assert.throws(()=>parseChoProduct(html,config,'https://example.test/coffee',[]),/coverage/);variants[0].data.productId=2;assert.throws(()=>parseChoProduct(html,config,'https://example.test/coffee',variants),/response changed/);
  });
});
