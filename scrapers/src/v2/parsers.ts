import { coffeeExclusionReason } from '../../../shared/v2/coffee-eligibility.js';
import { load } from 'cheerio';
import { classifySpecialtyProduct } from '../specialty-classification.js';
import { normalize } from '../normalization/index.js';
import { deriveProfileFeatures, profileInput } from './profile.js';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import { normalizeRoasterImageUrl } from '../url-policy.js';
import type { RoasterConfig } from '../types.js';
import type { Json, SourceCoffee, SourceOffer } from '../../../shared/v2/types.js';
import { bool, canonicalUrl, collect, list, money, names, optionalList, plainHtml, record, requiredText, sourceId, stock, text, weight } from './primitives.js';

function json(value: unknown): Json { return JSON.parse(JSON.stringify(value)) as Json; }
function coffee(config: RoasterConfig, raw: Record<string, unknown>, url: string, name: string, id: unknown, offers: SourceOffer[], description: unknown, image: unknown): SourceCoffee {
  const descriptionText = plainHtml(description);
  const eligibility = classifyEligibility(raw, name, url, sourceId(id), descriptionText);
  const score = raw.sca_score ?? raw.scaScore;
  const scaScore = typeof score === 'number' && Number.isFinite(score) && score > 0 && score <= 100 ? score : null;
  return {
    sourceProductId: sourceId(id), canonicalUrl: canonicalUrl(url, config), name,
    rawMetadata: { ...(scaScore === null ? {} : { scaScore }), description: plainHtml(description), imageUrl: normalizeRoasterImageUrl(text(image), config), sourceData: json(raw) },
    offers, visibility: eligibility.is_public ? 'public' : 'hidden',
    features: [{ feature: 'catalog_eligibility', value: json(eligibility), sourceType: 'RULE_INFERRED', confidence: null, version: 'legacy-specialty-v1-coffee-only-v3', sourceReference: url }, ...deriveProfileFeatures(profileInput(raw, name, url, sourceId(id), descriptionText))],
  };
}

/** Existing specialty policy is eligibility evidence only, never a source metadata extractor. */
function classifyEligibility(raw: Record<string, unknown>, name: string, url: string, id: string | null, description: string) {
  const tags = typeof raw.tags === 'string' ? raw.tags.split(',') : names(raw.tags);
  const taxonomy = [text(raw.product_type), ...tags, ...names(raw.categories)];
  const input = profileInput(raw, name, url, id, description);
  const classification = classifySpecialtyProduct({ raw: input, normalized: normalize(input) });
  const equipment = taxonomy.some(value => /(?:^|\s)(?:equipment|ekipman|aksesuar|accessories)(?:\s|$)/i.test(value)) ||
    /filtre\s+(?:kahve\s+)?k[aâ]ğ[ıi]d[ıi]|filtre\s+(?:kahve\s+)?kagidi|\b(?:coffee\s+)?filters?\s+(?:papers?|brown|white)\b/i.test(name);
  return equipment || coffeeExclusionReason({ name, canonicalUrl: url, rawMetadata: { sourceData: json(raw) } }) ? { ...classification, specialty_status: 'not_specialty' as const, is_public: false,
    specialty_rejection_reason: 'non_coffee_or_bundle', specialty_signals: [...classification.specialty_signals, 'reject:equipment'] } : classification;
}

function retail(parts: string[], config: RoasterConfig) {
  if (!isLikelyCatalogCoffeeProduct(parts)) return false;
  return /kahve|coffee|filtre|espresso|çekirdek|cekirdek|single origin/i.test(parts.join(' ')) ||
    (config.coffeeProductKeywords ?? []).some(keyword => parts.join(' ').toLocaleLowerCase('tr').includes(keyword.toLocaleLowerCase('tr')));
}

function shopifyGramWeight(raw: Record<string, unknown>, variant: Record<string, unknown>) {
  for (const value of optionalList(raw.options)) {
    const option = record(value);
    if (!/^(?:gramaj|gram|grams)$/i.test(text(option.name))) continue;
    const label = text(variant[`option${option.position}`]);
    if (/^\d+$/.test(label)) return weight(`${label} g`);
  }
  return null;
}
export function parseShopifyPage(payload: unknown, config: RoasterConfig): SourceCoffee[] {
  return list(record(payload).products).flatMap(value => {
    const raw = record(value);
    const name = requiredText(raw.title);
    const tags = typeof raw.tags === 'string' ? raw.tags.split(',').map(text) : names(raw.tags);
    const kind = text(raw.product_type);
    if (!isLikelyCatalogCoffeeProduct([name, kind, ...tags])) return [];
    if (/e[ğg]itim|at[öo]lye|workshop/i.test(kind)) return [];
    const filters = [...(config.productTypeFilter ?? []).map(filter => kind.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr'))),
      ...(config.tagFilters ?? []).map(filter => tags.some(tag => tag.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr'))))];
    if (filters.length && !filters.some(Boolean)) return [];
    const url = canonicalUrl(`/products/${requiredText(raw.handle)}`, config);
    const sourceVariants = list(raw.variants);
    const offers = sourceVariants.flatMap(value => {
      const variant = record(value);
      const label = requiredText(variant.title);
      if (/\bcam\s*[şs]i[şs]e\b/i.test(label)) return [];
      const id = sourceId(variant.id);
      if (!id) throw new Error('Shopify variant is missing its ID.');
      const purchase = new URL(url); purchase.searchParams.set('variant', id);
      return [{ sourceVariantId: id, label, weightG: weight(label) ?? weight(name) ?? shopifyGramWeight(raw, variant),
        price: money(variant.price), compareAtPrice: variant.compare_at_price != null && Number(variant.compare_at_price) === 0 ? null : money(variant.compare_at_price), currency: 'TRY',
        inStock: bool(variant.available), purchaseUrl: purchase.toString() }];
    });
    if (!offers.length && sourceVariants.length) return [];
    if (!offers.length) throw new Error('Shopify coffee has no retail variants.');
    if (!sourceId(raw.id)) throw new Error('Shopify coffee is missing its ID.');
    return [coffee(config, raw, url, name, raw.id, offers, raw.body_html, optionalList(raw.images)[0] && record(list(raw.images)[0]).src)];
  });
}

export function isWooCoffee(raw: Record<string, unknown>, config: RoasterConfig): boolean {
  if (config.excludedProductSlugs?.includes(text(raw.slug)) || coffeeExclusionReason({name:requiredText(raw.name),canonicalUrl:text(raw.permalink),rawMetadata:{sourceData:json(raw)}})) return false;
  const categories = names(raw.categories).map(category => category.toLocaleLowerCase('tr'));
  const parts = [requiredText(raw.name), ...categories, ...names(raw.tags)];
  const haystack = parts.join(' ').toLocaleLowerCase('tr');
  const excludedCategories = ['aksesuar', 'demleme araç', 'ekipman', 'filtre kağıdı', 'filtre kagidi', 'hediyelik', 'kahve öğütücü', 'kahve ogutucu', 'kozmetik', 'temizlik'];
  if (categories.some(category => excludedCategories.some(keyword => category.includes(keyword)))) return false;
  if (['içilmeye hazır', 'icilmeye hazir', 'şişe dahil', 'sise dahil', 'toptan giriş', 'toptan giris', 'yeşil kahve', 'yesil kahve'].some(fragment => haystack.includes(fragment))) return false;
  return categories.length ? retail(parts, config) : isLikelyCatalogCoffeeProduct(parts);
}
export function parseWooProduct(payload: unknown, variations: unknown[], config: RoasterConfig): SourceCoffee {
  const raw = record(payload);
  const name = requiredText(raw.name);
  const url = canonicalUrl(raw.permalink, config);
  if (!sourceId(raw.id)) throw new Error('WooCommerce coffee is missing its ID.');
  const references = optionalList(raw.variations).map(value => record(value));
  if (raw.type === 'variable' && !references.length) {
    if (raw.is_in_stock !== false || variations.length) throw new Error('Variable WooCommerce coffee lacks SKU discovery.');
    return {...coffee(config, raw, url, name, raw.id, [], [plainHtml(raw.description),plainHtml(raw.short_description)].join('\n'), optionalList(raw.images)[0] && record(list(raw.images)[0]).src), unavailable:true};
  }
  if (references.length !== variations.length) throw new Error('WooCommerce variation discovery is incomplete.');
  const offers = (references.length ? variations : [raw]).map(value => {
    const variant = record(value);
    const id = sourceId(variant.id);
    if (!id) throw new Error('WooCommerce offer is missing its ID.');
    if (references.length && !references.some(ref => sourceId(ref.id) === id)) throw new Error('Unexpected WooCommerce variation ID.');
    const prices = record(variant.prices);
    const unit = typeof prices.currency_minor_unit === 'number' ? prices.currency_minor_unit : config.priceFormat === 'kurus' ? 2 : 0;
    const attributes = optionalList(variant.attributes).map(record);
    const reference = references.find(ref => sourceId(ref.id) === id);
    const referenceValues = optionalList(reference?.attributes).map(record).map(attr => text(attr.value));
    const label = text(variant.variation) || referenceValues.filter(Boolean).join(' · ') || name;
    const weights = [...new Set(attributes.filter(attr => /weight|gram|ağırlık|agirlik/i.test(text(attr.name)))
      .flatMap(attr => names(attr.terms)).map(weight).filter((value): value is number => value != null))];
    // A parent listing several sizes is not evidence for a single bag weight.
    const grams = label.match(/(?:gramaj|gram|grams):\s*(\d+)(?=\s*(?:,|·|$))/i)?.[1];
    const weightG = weight(label) ?? (grams ? weight(`${grams} g`) : null) ?? (weights.length === 1 ? weights[0] : null);
    const purchase = references.length ? canonicalUrl(variant.permalink, config) : url;
    return { sourceVariantId: id, label, weightG, price: variant.is_in_stock === false && Number(prices.price) === 0 ? null : money(prices.price, unit),
      compareAtPrice: Number(prices.regular_price) === 0 ? null : money(prices.regular_price, unit), currency: text(prices.currency_code) || null,
      inStock: bool(variant.is_in_stock), purchaseUrl: purchase };
  });
  return coffee(config, { ...raw, variationDetails: variations }, url, name, raw.id, offers,
    [plainHtml(raw.description), plainHtml(raw.short_description)].filter(Boolean).join('\n'), optionalList(raw.images)[0] && record(list(raw.images)[0]).src);
}

export const IKAS_CATALOG_QUERY = `query searchProducts($input: SearchInput!) { searchProducts(input:$input) {
  count page limit results { id name description shortDescription deleted type metaData { slug }
    categories { name } tags { name }
    productVariantTypes { variantType { id name values { id name } } }
    variants { id deleted isActive sellIfOutOfStock variantValues { variantTypeId variantValueId }
      prices { priceListId currencyCode sellPrice discountPrice } stocks { stockLocationId stockCount }
      images { id isMain isVideo order } }
  }
} }`;
interface IkasContext { apiKey: string; storefrontId: string; routingId: string; salesChannelId: string; priceListId: string | null; locale: string; stockLocationIds: string[]; cdnUrl: string; merchantId: string }
function ikasData(html: string) {
  const script = load(html)('#__NEXT_DATA__').text();
  if (!script) throw new Error('Missing IKAS __NEXT_DATA__ payload.');
  return record(JSON.parse(script));
}
export function ikasCatalogContext(html: string): IkasContext {
  const config = record(record(record(ikasData(html).props).pageProps).configJson);
  if (config.apiUrl !== 'https://api.myikas.com/api/sf/graphql') throw new Error('Unrecognized IKAS storefront API.');
  const routingId = requiredText(config.storefrontRoutingId);
  const routing = list(config.routings).map(record).find(r => r.id === routingId);
  if (!routing || routing.currencyCode !== 'TRY' || routing.dynamicCurrencySettings) throw new Error('Unsupported IKAS storefront currency routing.');
  return { apiKey: requiredText(config.apiKey), storefrontId: requiredText(config.storefrontId), routingId,
    salesChannelId: requiredText(config.salesChannelId), priceListId: sourceId(routing.priceListId), locale: requiredText(routing.locale),
    stockLocationIds: list(config.stockLocationIds).map(requiredText), cdnUrl: requiredText(config.cdnUrl), merchantId: requiredText(record(config.merchantSettings).merchantId) };
}
export function parseIkasPage(html: string, config: RoasterConfig): SourceCoffee[] {
  return parseIkasProducts(collect(ikasData(html), item => typeof item.name === 'string' && Array.isArray(item.variants) && Boolean(item.metaData)), config);
}
export function parseIkasProducts(candidates: Record<string, unknown>[], config: RoasterConfig, context?: IkasContext): SourceCoffee[] {
  const products = new Map<string, SourceCoffee>();
  for (const raw of candidates) {
    if (raw.deleted === true) continue;
    const name = requiredText(raw.name);
    if (!retail([name, ...names(raw.categories), ...names(raw.tags)], config)) continue;
    const url = canonicalUrl(`/${requiredText(record(raw.metaData).slug)}`, config, config.websiteUrl);
    const id = sourceId(raw.id);
    const key = id ?? url;
    const offers = list(raw.variants).map(record).filter(variant => variant.deleted !== true).map(variant => {
      const values = optionalList(variant.variantValues).map(value => {
        const selected = record(value);
        if (selected.name) return requiredText(selected.name);
        const type = optionalList(raw.productVariantTypes).map(record).map(v => record(v.variantType)).find(t => t.id === selected.variantTypeId);
        const option = optionalList(type?.values).map(record).find(v => v.id === selected.variantValueId);
        return requiredText(option?.name);
      });
      const label = values.join(' · ') || null;
      const variantId = sourceId(variant.id);
      if (!variantId) throw new Error('IKAS source variant ID missing; offer identity cannot be established.');
      const prices = optionalList(variant.prices).map(record);
      const tryPrices = prices.filter(price => (!price.currency && !price.currencyCode || price.currency === 'TRY' || price.currencyCode === 'TRY') && (!context || (price.priceListId ?? null) === context.priceListId));
      if (tryPrices.length > 1) throw new Error('IKAS price-list ambiguity; store-specific price selection required.');
      const price = tryPrices[0];
      if (context && !price) throw new Error('IKAS storefront price list is missing.');
      const hasDiscount = typeof price?.discountPrice === 'number' && price.discountPrice > 0;
      const stocks = optionalList(variant.stocks).map(record).filter(item => !context || context.stockLocationIds.includes(requiredText(item.stockLocationId)));
      const declaredStock = stocks.length && stocks.every(item => stock(item.stockCount) != null)
        ? stocks.reduce((sum, item) => sum + Number(item.stockCount), 0) : context && Array.isArray(variant.stocks) ? 0 : variant.stock;
      const available = variant.isActive === false ? false : variant.sellIfOutOfStock === true ? true : stock(declaredStock);
      return { sourceVariantId: variantId, label, weightG: weight(label ?? '') ?? weight(name),
        price: price ? money(hasDiscount ? price.discountPrice : price.sellPrice) : null,
        compareAtPrice: hasDiscount ? money(price.sellPrice) : null, currency: price ? 'TRY' : null,
        inStock: available, purchaseUrl: url };
    });
    if (!offers.length) throw new Error('IKAS coffee has no variants.');
    const images = list(raw.variants).map(record).flatMap(v => optionalList(v.images).map(record)).filter(image => image.isVideo !== true);
    const image = images.find(image => image.isMain === true) ?? images[0];
    const imageUrl = context && image ? `${context.cdnUrl}/images/${context.merchantId}/${requiredText(image.id ?? image.imageId)}/image_1080.webp` : raw.imageUrl;
    const product = coffee(config, raw, url, name, id, offers, raw.description ?? raw.shortDescription, imageUrl);
    const existing = products.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(product)) throw new Error('Conflicting repeated IKAS product.');
    products.set(key, product);
  }
  return [...products.values()];
}

export function parseParsaProduct(payload: unknown, config: RoasterConfig): SourceCoffee {
  const raw = record(payload);
  const id = requiredText(raw.kod);
  const name = requiredText(raw.ad);
  const url = canonicalUrl(`/tr/kahve/${encodeURIComponent(id)}`, config, config.websiteUrl);
  const discount = raw.indirim_orani == null ? 0 : Number(raw.indirim_orani);
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100) throw new Error('Invalid Parsa discount.');
  const rawBase = raw.taban_fiyat_tl;
  const base = rawBase == null || rawBase === '' ? null : Number(rawBase);
  if (base != null && (!Number.isFinite(base) || base < 0)) throw new Error('Invalid Parsa base-price component.');
  const offers = list(raw.varyasyonlar).map(value => {
    const variant = record(value);
    const label = requiredText(variant.gramaj);
    const delta = Number(variant.ek_fiyat_tl ?? 0);
    if (!Number.isFinite(delta)) throw new Error('Invalid Parsa package surcharge.');
    const original = base == null ? null : money(base + delta);
    return { sourceVariantId: sourceId(variant.id), identityKey: `gramaj:${label.trim().toLowerCase()}`,
      label, weightG: weight(label), price: original == null ? null : money(original * (1 - discount / 100)),
      compareAtPrice: discount > 0 ? original : null, currency: 'TRY',
      inStock: raw.aktif === false || variant.aktif === false ? false : stock(variant.stok), purchaseUrl: url };
  });
  if (!offers.length) throw new Error('Parsa coffee has no package details.');
  const result = coffee(config, raw, url, name, id, offers, '', raw.resim_url_on);
  result.rawMetadata = { ...result.rawMetadata, country: text(raw.koken_tr) || null, region: text(raw.origin) || null,
    producer: text(raw.uretici) || null, altitude: text(raw.rakim) || null, process: text(raw.islem_tr) || null,
    varieties: text(raw.cultivar) ? [text(raw.cultivar)] : [], tastingNotes: text(raw.tadim_notlari_tr).split(',').map(text).filter(Boolean), roast: text(raw.kavrum_tipi_tr) || null };
  return result;
}

/** JSON-LD only: selectors can discover products but cannot prove all SKU prices. */
export function parseStructuredProductPage(html: string, config: RoasterConfig, expectedUrl: string): SourceCoffee {
  const $ = load(html);
  const products: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    products.push(...collect(JSON.parse($(el).text()), item => item['@type'] === 'Product'));
  });
  const matching = products.filter(item => !item.url || canonicalUrl(item.url, config) === canonicalUrl(expectedUrl, config));
  if (matching.length !== 1) throw new Error('Expected one unambiguous structured product.');
  const raw = matching[0];
  const name = requiredText(raw.name);
  const url = canonicalUrl(raw.url || expectedUrl, config);
  const offers = (Array.isArray(raw.offers) ? raw.offers : [raw.offers]).map(value => {
    const offer = record(value);
    if (offer['@type'] === 'AggregateOffer') throw new Error('Aggregate price range is not a purchasable offer.');
    const id = sourceId(offer.sku ?? offer['@id'] ?? raw.sku);
    const offerUrl = offer.url ? canonicalUrl(offer.url, config) : url;
    const label = text(offer.name) || null;
    const availability = text(offer.availability);
    return { sourceVariantId: id, ...(id ? {} : { identityKey: `url:${offerUrl}` }), label,
      weightG: weight(label ?? '') ?? weight(name), price: money(offer.price), compareAtPrice: null,
      currency: text(offer.priceCurrency) || null,
      inStock: /\/(InStock|LimitedAvailability)$/.test(availability) ? true : /\/(OutOfStock|SoldOut)$/.test(availability) ? false : null,
      purchaseUrl: offerUrl };
  });
  const identities = offers.map(offer => offer.sourceVariantId ?? offer.identityKey);
  if (new Set(identities).size !== identities.length) throw new Error('Structured offers lack distinct SKU identities.');
  return coffee(config, raw, url, name, raw.productID ?? raw['@id'], offers, raw.description, Array.isArray(raw.image) ? raw.image[0] : raw.image);
}

/** All purchase options are embedded in the public Probador catalog. */
export function parseProbadorCatalog(html: string, config: RoasterConfig): SourceCoffee[] {
  const $=load(html);const products:SourceCoffee[]=[];
  if ($('a[rel="next"],.pagination a.next').length) throw new Error('Probador pagination requires review.');
  $('.products-lists .list').each((_,element)=>{
    const card=$(element),name=card.find('.name').first().text().trim();
    const description=card.find('.note').text().trim();
    if(!isLikelyCatalogCoffeeProduct([name])||/tamper|puly|temizleme|tablet|gear|allfaktor|seti|kaşık|kase|fincan|harita|map|cup|kapak|tabak|değirmen|press/i.test(name))return;
    if(!/etiyopya|ethiopia|kolombiya|colombia|brezilya|brazil|kenya|kostarika|costa rica|kosta rika|guatemala|ruanda|honduras|peru|panama|el salvador|espresso|decaf|finca|yıkanmış|washed|honey/i.test(name))return;
    const url=canonicalUrl(card.find('a.image').attr('href'),config,config.websiteUrl);
    const select=card.find('select[id^="variant"]');
    const productId=select.attr('id')?.match(/^variant(\d+)$/)?.[1];
    if(!productId)throw new Error('Probador coffee lacks variant discovery.');
    const offers:SourceOffer[]=[];
    select.find('option').each((_,option)=>{
      const id=requiredText($(option).attr('value')),label=$(option).text().trim();
      const source=card.find('.variantprice').filter((_,el)=>$(el).attr('id')===`variantprice${id}`);
      if(source.length!==1)throw new Error('Probador variant price missing or duplicated.');
      const amount=source.find('.price').text().replace(/[₺\s]/g,'').replace(/,/g,'.');
      const count=source.attr('data-stock');
      offers.push({sourceVariantId:id,label,weightG:weight(label),price:money(amount),compareAtPrice:null,currency:'TRY',inStock:count==null?null:stock(Number(count)),purchaseUrl:url});
    });
    if(offers.length!==card.find('.variantprice').length)throw new Error('Probador variant coverage differs from prices.');
    products.push(coffee(config,{id:productId,name,description,offers},url,name,productId,offers,description,card.find('img').attr('src')));
  });
  return products;
}

/** Ticimax embeds each SKU's tax-inclusive price and its option mappings separately. */
export function parseTicimaxProduct(html:string,config:RoasterConfig,url:string):SourceCoffee {
  const $=load(html),script=$('script:not([src])').map((_,el)=>$(el).text()).get().find(s=>s.includes('var productDetailModel'));
  const encoded=script?.match(/var productDetailModel\s*=\s*(\{[\s\S]*?\});/)?.[1];
  if(!encoded)throw new Error('Ticimax product model missing.');
  const model=record(JSON.parse(encoded)),name=requiredText(model.productName),id=sourceId(model.productId);
  if(!id||model.isPackageProduct===true||model.isSuite===true)throw new Error('Unsupported Ticimax product identity or bundle.');
  const mappings=list(model.productVariantData).map(record),variants=list(model.products).map(record);
  const offers=variants.map(variant=>{
    const variantId=sourceId(variant.id);if(!variantId)throw new Error('Ticimax variant ID missing.');
    const choices=mappings.filter(m=>sourceId(m.urunID)===variantId),label=choices.map(m=>requiredText(m.tanim)).join(' · ');
    if(mappings.length&&!choices.length)throw new Error('Ticimax variant option mapping missing.');
    const discount=Number(variant.indirimliFiyati)>0;
    const base=money(discount?variant.indirimliFiyati:variant.satisFiyati);
    const tax=Number(discount?variant.indirimliKDV:variant.satisKDV);
    if(base===null||!Number.isFinite(tax)||tax<0)throw new Error('Ticimax price or tax missing.');
    return {sourceVariantId:variantId,label:label||null,weightG:weight(label),price:money(base+tax),compareAtPrice:discount?money(Number(variant.satisFiyati)+Number(variant.satisKDV)):null,
      currency:requiredText(variant.paraBirimiKodu),inStock:variant.aktif===false?false:stock(variant.stokAdedi),purchaseUrl:url};
  });
  if(mappings.some(m=>!variants.some(v=>v.id===m.urunID)))throw new Error('Ticimax variant coverage incomplete.');
  const description=$('#divUrunAciklama,#divTabOzellikler').first().text()||text(model.productShortDescription);
  // Keep source fields relevant to catalog evidence; omit unrelated session and tracking configuration.
  return coffee(config,{id,name,description,variants:variants.map(v=>({id:v.id,price:v.satisFiyati,tax:v.satisKDV,discount:v.indirimliFiyati,discountTax:v.indirimliKDV,stock:v.stokAdedi})),offers},url,name,id,offers,description,optionalList(model.productImages)[0]&&record(list(model.productImages)[0]).bigImagePath);
}

export function parseKronotropProduct(html:string,config:RoasterConfig,url:string):SourceCoffee {
  const product=parseStructuredProductPage(html,config,url),$=load(html),form=$('form#single');
  const id=sourceId(form.find('input[name="id"]').attr('value'));
  if(!id||product.offers.length!==1)throw new Error('Kronotrop product identity or price ambiguous.');
  const base=product.offers[0];
  let choices:{key:string;label:string;extra:number;disabled:boolean}[]=[{key:'',label:'',extra:0,disabled:false}];
  form.find('select').each((_,el)=>{
    const group=$(el).attr('name')?.match(/^product_variant_group_id\[(\d+)\]\[product_variant_value_id\]$/)?.[1];
    if(!group)throw new Error('Unrecognized Kronotrop option group.');
    const options=$(el).find('option[value]').toArray().filter(o=>$(o).attr('value')).map(o=>{
      const price=$(o).attr('data-price');if(!price||!/^\d+(\.\d+)?$/.test(price))throw new Error('Kronotrop option price missing.');
      return {key:`${group}:${$(o).attr('value')}`,label:$(o).text().trim(),extra:Number(price),disabled:$(o).attr('disabled')!==undefined};
    });
    if(!options.length)throw new Error('Kronotrop option group is empty.');
    choices=choices.flatMap(prior=>options.map(next=>({key:[prior.key,next.key].filter(Boolean).join('|'),label:[prior.label,next.label].filter(Boolean).join(' · '),extra:prior.extra+next.extra,disabled:prior.disabled||next.disabled})));
    if(choices.length>200)throw new Error('Kronotrop option budget exceeded.');
  });
  const description=String(product.rawMetadata.description??'');
  return {...product,sourceProductId:id,offers:choices.map(choice=>({...base,sourceVariantId:null,identityKey:choice.key||'single',label:choice.label||null,
    weightG:weight(choice.label)??weight(description)??base.weightG,price:base.price===null?null:money(base.price+choice.extra),inStock:choice.disabled?false:base.inStock}))};
}

export function parseMilestonesProduct(html:string,config:RoasterConfig,url:string):SourceCoffee {
  const $=load(html),id=sourceId($('[data-sepete-ekle]').first().attr('data-sepete-ekle'));
  const name=requiredText($('h1.product-title').first().text());
  const localized=(value:string)=>money(value.replace(/\./g,'').replace(',','.').trim());
  const base=localized(requiredText($('[data-guncel-fiyat]').first().attr('data-guncel-fiyat')));
  const options=$('.product-variation-form [data-secenek-id]').toArray();
  if(!id||base===null||!options.length||$('.product-variation-form').length!==1)throw new Error('Milestones purchase options missing or ambiguous.');
  const offers=options.map(el=>{const node=$(el),quantity=node.attr('data-stok'),extra=node.attr('data-fiyat'),label=node.text().trim();
    if(quantity===undefined||!/^\d+$/.test(quantity)||extra===undefined)throw new Error('Milestones variant evidence missing.');
    // Storefront post.php islem=fiyat adds the option surcharge to the base price.
    return {sourceVariantId:requiredText(node.attr('data-secenek-id')),label,weightG:weight(label),price:money(base+(extra && extra!=='-'?localized(extra)!:0)),compareAtPrice:null,currency:'TRY',inStock:Number(quantity)>0,purchaseUrl:url};});
  const description=$('#product-tab-description').text().trim();
  return coffee(config,{id,name,offers,description},url,name,id,offers,description,$('.product-single img').first().attr('src')||$('meta[property="og:image"]').attr('content'));
}

export function parseKafeinProduct(payload:unknown,html:string,config:RoasterConfig,url:string,selected?:{label:string;data:unknown}[]):SourceCoffee {
  const data=record(record(payload).data),id=sourceId(data.mainProductId),name=requiredText(data.mainProductName);
  if(!id||canonicalUrl(data.mainProductUrl,config)!==canonicalUrl(url,config))throw new Error('Kafein product identity mismatch.');
  const structured=parseStructuredProductPage(html,config,url);
  if(structured.offers.length!==1||structured.offers[0].currency!=='TRY')throw new Error('Kafein currency unclear.');
  const groups=Object.values(record(data.variantProperties));
  if(data.hasVariants!==true||(!selected && groups.length!==1))throw new Error('Kafein variant structure requires review.');
  const group=record(groups[0]);
  const offers=selected ? selected.map(({label,data:payload})=>{const item=record(record(payload).data),native=sourceId(record(item.obProduct).pk);if(!native||native===id)throw new Error('Kafein combination did not resolve to a native SKU.');const pricing=record(item.pricing);return {sourceVariantId:native,label,weightG:weight(label),price:money(pricing.getSalePrice),compareAtPrice:null,currency:'TRY',inStock:bool(item.is_saleable),purchaseUrl:url};}) : Object.values(record(group.options)).map(value=>{const option=record(value);return {sourceVariantId:requiredText(option.product_id),label:requiredText(option.name),weightG:weight(requiredText(option.name)),price:money(option.price),compareAtPrice:null,currency:'TRY',inStock:bool(option.saleable),purchaseUrl:url};});
  if(!offers.length)throw new Error('Kafein variants missing.');
  return coffee(config,{id,name,offers,description:data.description},url,name,id,offers,data.description,data.getPhotoImgTagData);
}

export function parseIdeaProduct(html:string,config:RoasterConfig,url:string):SourceCoffee {
  const encoded=html.match(/pageParams\s*=\s*\{product:\s*(\{[^\n]*?\})\};/)?.[1];
  if(!encoded)throw new Error('IdeaSoft product model missing.');
  const raw=record(JSON.parse(encoded.replace(/([{,])([A-Za-z_]\w*):/g,'$1"$2":'))),$=load(html);
  const id=sourceId(raw.id),name=requiredText(raw.fullName),label=text(raw.variantName)||name;
  if(!id||raw.currency!=='TRY')throw new Error('IdeaSoft identity or currency invalid.');
  const quantity=$('[data-selector="qty"][data-stockamount]').first().attr('data-stockamount');
  if(quantity===undefined||!/^\d+(\.\d+)?$/.test(quantity))throw new Error('IdeaSoft stock evidence missing.');
  const offers=[{sourceVariantId:id,label,weightG:weight(label),price:money(raw.salePrice),compareAtPrice:null,currency:'TRY',inStock:Number(quantity)>0,purchaseUrl:url}];
  const description=$('#product-detail-description,.product-detail-description').first().text();
  return coffee(config,{...raw,description},url,name,id,offers,description,raw.primaryImageUrl);
}

export function choOptions(html:string) {
  const $=load(html),form=$('#product-details-form'),id=sourceId($('#product-ribbon-info').attr('data-productid'));
  if(!id)throw new Error('Cho product identity missing.');
  let choices:{key:string;label:string;params:[string,string][]}[]=[{key:'',label:'',params:[]}];
  form.find('.attributes select').each((_,el)=>{const field=requiredText($(el).attr('name'));
    if(!/^product_attribute_\d+$/.test(field))throw new Error('Cho option control unrecognized.');
    const options=$(el).find('option').toArray().filter(o=>$(o).attr('value')&&$(o).attr('value')!=='0');
    if(!options.length)throw new Error('Cho options missing.');
    choices=choices.flatMap(prior=>options.map(o=>{const value=requiredText($(o).attr('value'));return {key:[prior.key,`${field}:${value}`].filter(Boolean).join('|'),label:[prior.label,$(o).text().replace(/\s*\[[^\]]*\]/g,'').trim()].filter(Boolean).join(' · '),params:[...prior.params,[field,value] as [string,string]]};}));
  });
  if(form.find('.attributes input').length||choices.length>100)throw new Error('Cho option controls require review.');
  return {id,choices,token:requiredText(form.find('input[name="__RequestVerificationToken"]').attr('value'))};
}
export function parseChoProduct(html:string,config:RoasterConfig,url:string,variants:{key:string;label:string;data:unknown}[]):SourceCoffee {
  const $=load(html),{id,choices}=choOptions(html),name=requiredText($('meta[itemprop="name"]').attr('content'));
  if(variants.length!==choices.length||$('meta[itemprop="priceCurrency"]').attr('content')!=='TRY')throw new Error('Cho variant coverage or currency invalid.');
  const availability=$('meta[itemprop="availability"]').attr('content')??'';
  const parentStock=/\/InStock$/.test(availability)?true:/\/(OutOfStock|SoldOut)$/.test(availability)?false:null;
  const offers=variants.map(({key,label,data})=>{const raw=record(data);if(String(raw.productId)!==id||raw.message||optionalList(raw.disabledattributemappingids).length)throw new Error('Cho option response changed or contains conditional availability.');
    const stockText=text(raw.stockAvailability).toLocaleLowerCase('tr');
    const inStock=stockText ? /stokta yok|tükendi|sold out|out of stock/.test(stockText)?false:/stokta var|in stock/.test(stockText)?true:null : parentStock;
    const price=money(requiredText(raw.price).replace(/[₺\s]/g,'').replace(/\./g,'').replace(',','.'));
    return {sourceVariantId:null,identityKey:key||'single',label:label||null,weightG:weight(label),price,compareAtPrice:null,currency:'TRY',inStock,purchaseUrl:url};});
  const description=$('meta[itemprop="description"]').attr('content');
  return coffee(config,{id,name,description,offers},url,name,id,offers,description,$('meta[itemprop="image"]').attr('content')||$('#main-product-img-'+id).attr('src'));
}
