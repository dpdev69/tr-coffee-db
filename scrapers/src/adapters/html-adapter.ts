import axios from 'axios';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base-scraper.js';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import type { RoasterConfig, RawProduct } from '../types.js';

interface NextDataProduct {
  metaData?: {
    slug?: string | null;
  };
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  categories?: { name: string }[];
  tags?: { name: string }[];
  variants: NextDataVariant[];
}

interface NextDataVariant {
  isActive?: boolean;
  sellIfOutOfStock?: boolean;
  stock?: number | null;
  stocks?: { stockCount?: number | null }[];
  prices?: {
    discountPrice?: number | null;
    sellPrice?: number | null;
  }[];
  variantValues?: { name?: string | null }[];
}

interface ProbadorChallengeSubmission {
  action: string;
  fields: Array<{ name: string; value: string }>;
}

class ChallengeElement {
  children: ChallengeElement[] = [];
  action = '';
  method = '';
  id = '';
  name = '';
  value = '';
  type = '';
  style = '';

  constructor(private readonly onSubmit?: (form: ChallengeElement) => void) {}

  appendChild(child: ChallengeElement) {
    this.children.push(child);
  }

  submit() {
    this.onSubmit?.(this);
  }
}

export function parseProbadorProducts(html: string, config: RoasterConfig): RawProduct[] {
  const $ = cheerio.load(html);
  const uniqueProducts = new Map<string, RawProduct>();

  $('.products-lists .list').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a.image[href]').first().attr('href');
    const name = $el.find('.name').first().text().trim();
    if (!href || !name) return;

    const productUrl = new URL(href, config.websiteUrl).toString();
    const description = $el.find('.note').first().text().trim();
    if (!isProbadorCoffeeProduct(name, description, href)) return;

    const externalId = makeExternalId(productUrl);
    if (uniqueProducts.has(externalId)) return;

    const imageSrc = $el.find('a.image img').first().attr('src') ?? null;
    const imageUrl = imageSrc ? new URL(imageSrc, config.websiteUrl).toString() : null;
    const priceText = $el.find('.variantprice.active .price').first().text().trim()
      || $el.find('.price').first().text().trim();
    const stockText = $el.find('.variantprice.active').first().attr('data-stock');
    const stock = stockText ? Number.parseInt(stockText, 10) : null;

    uniqueProducts.set(externalId, {
      externalId,
      name,
      description,
      price: parseTurkishPrice(priceText, config),
      currency: 'TRY',
      weightGrams: parseWeight($el.text()),
      imageUrl,
      productUrl,
      isAvailable: Number.isFinite(stock) ? (stock as number) > 0 : !$el.text().includes('STOKTA YOK'),
      tags: $el.find('.tag').text().trim() ? [$el.find('.tag').text().trim()] : [],
    });
  });

  return Array.from(uniqueProducts.values());
}

export class HtmlAdapter extends BaseScraper {
  constructor(config: RoasterConfig) {
    super(config);
    if (!config.selectors && !config.structuredDataParser) {
      throw new Error(
        `[${config.slug}] HTML adapter requires selectors or a structured data parser in config`
      );
    }
  }

  async fetchProducts(): Promise<RawProduct[]> {
    if (this.config.structuredDataParser === 'next-data-products') {
      return this.fetchProductsFromNextData();
    }

    if (this.config.structuredDataParser === 'probador-products') {
      return this.fetchProductsFromProbador();
    }

    return this.fetchProductsFromSelectors();
  }

  private async fetchProductsFromSelectors(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    const selectors = this.config.selectors!;
    let currentUrl: string | null = this.config.shopUrl;
    let pageCount = 0;
    const maxPages = 20;

    while (currentUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`[${this.config.slug}] Fetching page ${pageCount}: ${currentUrl}`);

      const html = await this.fetchPageHtml(currentUrl);
      const $ = cheerio.load(html);
      const productElements = $(selectors.productList);

      productElements.each((_, el) => {
        try {
          const $el = $(el);
          const name = $el.find(selectors.productName).text().trim();
          if (!name) return;

          const linkEl = $el.find(selectors.productLink);
          const href = linkEl.attr('href') || '';
          const productUrl = href.startsWith('http')
            ? href
            : new URL(href, this.config.shopUrl).toString();
          const description = selectors.description
            ? $el.find(selectors.description).text().trim()
            : '';

          if (!isLikelyCatalogCoffeeProduct([name, description, productUrl])) return;

          const priceText = $el.find(selectors.productPrice).text().trim();
          const price = parseCatalogPriceText(priceText, this.config);

          const imageEl = $el.find(selectors.productImage);
          const imageSrc = imageEl.attr('src') || imageEl.attr('data-src') || null;
          const imageUrl = imageSrc && imageSrc.startsWith('http')
            ? imageSrc
            : imageSrc
              ? new URL(imageSrc, this.config.shopUrl).toString()
              : null;

          const weightGrams = this.parseWeight(name);
          const isAvailable = selectors.unavailableText
            ? !$el.text().includes(selectors.unavailableText)
            : true;

          allProducts.push({
            externalId: this.makeExternalId(productUrl),
            name,
            description,
            price,
            currency: 'TRY',
            weightGrams,
            imageUrl,
            productUrl,
            isAvailable,
            tags: [],
          });
        } catch {
          // Skip individual product parse errors
        }
      });

      // Check for next page
      if (selectors.nextPage) {
        const nextLink = $(selectors.nextPage).attr('href');
        currentUrl = nextLink
          ? nextLink.startsWith('http')
            ? nextLink
            : new URL(nextLink, this.config.shopUrl).toString()
          : null;
      } else {
        currentUrl = null;
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }

    return allProducts;
  }

  private async fetchProductsFromProbador(): Promise<RawProduct[]> {
    const html = await this.fetchProbadorPageHtml(this.config.shopUrl);
    return parseProbadorProducts(html, this.config);
  }

  private async fetchProductsFromNextData(): Promise<RawProduct[]> {
    const html = await this.fetchPageHtml(this.config.shopUrl);
    const $ = cheerio.load(html);
    const nextData = $('#__NEXT_DATA__').html();

    if (!nextData) {
      throw new Error(`[${this.config.slug}] Missing __NEXT_DATA__ script`);
    }

    const parsed = JSON.parse(nextData);
    const products = this.collectNextDataProducts(parsed);
    const uniqueProducts = new Map<string, RawProduct>();

    for (const product of products) {
      const slug = product.metaData?.slug?.trim();
      if (!slug || uniqueProducts.has(slug)) continue;
      if (!this.isNextDataCoffeeProduct(product)) continue;

      const variant = this.pickPreferredVariant(product);
      if (!variant) continue;

      const categoryNames = (product.categories ?? []).map((category) => category.name);
      const tagNames = (product.tags ?? []).map((tag) => tag.name);
      const variantText = (variant.variantValues ?? [])
        .map((value) => value.name?.trim())
        .filter((value): value is string => Boolean(value))
        .join(' ');

      uniqueProducts.set(slug, {
        externalId: slug,
        name: product.name.trim(),
        description: this.stripHtml(product.description || product.shortDescription || ''),
        price: this.extractNextDataPrice(variant),
        currency: 'TRY',
        weightGrams: this.parseWeight(`${product.name} ${variantText}`),
        imageUrl: null,
        productUrl: new URL(`/${slug}`, this.config.websiteUrl).toString(),
        isAvailable: this.isVariantAvailable(variant),
        tags: tagNames,
        rawData: {
          categories: categoryNames,
          variantValues: variant.variantValues ?? [],
        },
      });
    }

    return Array.from(uniqueProducts.values());
  }

  private async fetchPageHtml(url: string) {
    const { data: html } = await axios.get<string>(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TRCoffeeDB/1.0)',
        Accept: 'text/html',
      },
    });

    return html;
  }

  private async fetchProbadorPageHtml(url: string) {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    };

    const firstResponse = await axios.get<string>(url, {
      timeout: 30000,
      headers,
    });

    if (!firstResponse.data.includes('Please wait while your request is being verified')) {
      return firstResponse.data;
    }

    const challenge = extractProbadorChallengeSubmission(firstResponse.data);
    const params = new URLSearchParams();
    for (const field of challenge.fields) {
      params.append(field.name, field.value);
    }

    const challengeUrl = new URL(challenge.action, url);
    challengeUrl.search = params.toString();

    const challengeResponse = await axios.get<string>(challengeUrl.toString(), {
      timeout: 30000,
      headers,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const cookies = normalizeSetCookieHeader(challengeResponse.headers['set-cookie']);
    const { data: html } = await axios.get<string>(url, {
      timeout: 30000,
      headers: {
        ...headers,
        ...(cookies ? { Cookie: cookies } : {}),
      },
    });

    return html;
  }

  private collectNextDataProducts(value: unknown, results: NextDataProduct[] = []) {
    if (!value || typeof value !== 'object') return results;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectNextDataProducts(item, results);
      }
      return results;
    }

    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.name === 'string' &&
      Array.isArray(candidate.variants) &&
      typeof (candidate.metaData as { slug?: string } | undefined)?.slug === 'string'
    ) {
      results.push(candidate as unknown as NextDataProduct);
    }

    for (const nested of Object.values(candidate)) {
      this.collectNextDataProducts(nested, results);
    }

    return results;
  }

  private isNextDataCoffeeProduct(product: NextDataProduct) {
    const categoryNames = (product.categories ?? []).map((category) => category.name);
    const tagNames = (product.tags ?? []).map((tag) => tag.name);
    const parts = [
      product.name,
      product.description,
      product.shortDescription,
      ...categoryNames,
      ...tagNames,
    ];
    const haystack = parts
      .filter((part): part is string => Boolean(part))
      .join(' ')
      .toLowerCase();
    const configKeywordMatches = (this.config.coffeeProductKeywords ?? []).some((keyword) =>
      haystack.includes(keyword.toLowerCase())
    );

    if (!isLikelyCatalogCoffeeProduct(parts) && !configKeywordMatches) {
      return false;
    }

    const classificationHaystack = [product.name, ...categoryNames, ...tagNames]
      .filter((part): part is string => Boolean(part))
      .join(' ')
      .toLowerCase();

    const excludedKeywords = [
      'aboneli',
      'çanta',
      'canta',
      'çuval',
      'cuval',
      'öğütücü',
      'ogutucu',
      'grinder',
      'makinesi',
      'machine',
      'kapsül',
      'kapsul',
      'kitap',
      'seramik',
      'bardak',
      'fincan',
    ];

    if (excludedKeywords.some((keyword) => classificationHaystack.includes(keyword))) {
      return false;
    }

    const defaultCoffeeKeywords = [
      'kahve',
      'coffee',
      'çekirdek',
      'cekirdek',
      'espresso',
      'filtre',
      'single origin',
      'tek köken',
      'decaf',
      'kafeinsiz',
    ];

    if (defaultCoffeeKeywords.some((keyword) => haystack.includes(keyword))) {
      return true;
    }

    return configKeywordMatches;
  }

  private pickPreferredVariant(product: NextDataProduct) {
    const candidates = (product.variants ?? []).filter((variant) => variant.isActive !== false);
    if (candidates.length === 0) return null;

    return candidates
      .map((variant) => {
        const variantText = (variant.variantValues ?? [])
          .map((value) => value.name?.trim())
          .filter((value): value is string => Boolean(value))
          .join(' ');

        return {
          variant,
          isAvailable: this.isVariantAvailable(variant),
          weightGrams: this.parseWeight(`${product.name} ${variantText}`) ?? Number.POSITIVE_INFINITY,
          price: this.extractNextDataPrice(variant) ?? Number.POSITIVE_INFINITY,
        };
      })
      .sort((left, right) => {
        if (left.isAvailable !== right.isAvailable) {
          return left.isAvailable ? -1 : 1;
        }
        if (left.weightGrams !== right.weightGrams) {
          return left.weightGrams - right.weightGrams;
        }
        return left.price - right.price;
      })[0]?.variant ?? null;
  }

  private isVariantAvailable(variant: NextDataVariant) {
    if (variant.sellIfOutOfStock) return true;

    const totalStock = (variant.stocks ?? []).reduce(
      (sum, stock) => sum + (stock.stockCount ?? 0),
      0
    );

    if (totalStock > 0) return true;
    if (typeof variant.stock === 'number') return variant.stock > 0;

    return false;
  }

  private extractNextDataPrice(variant: NextDataVariant) {
    for (const price of variant.prices ?? []) {
      if (typeof price.discountPrice === 'number') return price.discountPrice;
      if (typeof price.sellPrice === 'number') return price.sellPrice;
    }

    return null;
  }

  private parseWeight(text: string): number | null {
    const gMatch = text.match(/(\d+)\s*(?:gr?|gram)\b/i);
    if (gMatch) return parseInt(gMatch[1]);
    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
    return null;
  }

  private stripHtml(html: string) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#?\w+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private makeExternalId(url: string): string {
    // Use the URL path as a stable external ID
    try {
      const path = new URL(url).pathname
        .replace(/^\/+|\/+$/g, '')
        .replace(/\//g, '-');
      return path || url;
    } catch {
      return url;
    }
  }
}

function extractProbadorChallengeSubmission(html: string): ProbadorChallengeSubmission {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const challengeScript = scripts.at(-1);
  if (!challengeScript) {
    throw new Error('[probador] Missing verification challenge script');
  }

  let submittedForm: ChallengeElement | null = null;
  const document = {
    getElementById: () => new ChallengeElement(),
    createElement: () => new ChallengeElement((form) => {
      submittedForm = form;
    }),
    addEventListener: (_name: string, callback: () => void) => callback(),
  };
  const navigator = createProbadorNavigator();
  const browserWindow = {
    document,
    navigator,
    outerHeight: 900,
    outerWidth: 1400,
    addEventListener: () => undefined,
  };
  const context = {
    window: browserWindow,
    document,
    navigator,
    setTimeout: (callback: () => void) => callback(),
    URLSearchParams,
    XMLHttpRequest: class {
      open() {}
      send() {}
    },
    ...createProbadorBrowserConstructors(navigator),
  };

  vm.runInNewContext(challengeScript, context, { timeout: 1000 });

  const form = submittedForm as ChallengeElement | null;
  if (!form?.action || form.children.length === 0) {
    throw new Error('[probador] Could not solve verification challenge');
  }

  return {
    action: form.action,
    fields: form.children
      .filter((child: ChallengeElement) => child.name)
      .map((child) => ({ name: child.name, value: child.value })),
  };
}

function createProbadorNavigator() {
  function PluginArray() {}
  function Plugin() {}
  function MimeTypeArray() {}
  function MimeType() {}

  const plugins = [{}];
  Object.setPrototypeOf(plugins[0], Plugin.prototype);
  Object.setPrototypeOf(plugins, PluginArray.prototype);

  const mimeTypes = [{}];
  Object.setPrototypeOf(mimeTypes[0], MimeType.prototype);
  Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);

  return {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    appVersion: '5.0 (Macintosh)',
    language: 'en-US',
    languages: ['en-US', 'en'],
    plugins,
    mimeTypes,
    constructors: {
      PluginArray,
      Plugin,
      MimeTypeArray,
      MimeType,
    },
  };
}

function createProbadorBrowserConstructors(navigator: ReturnType<typeof createProbadorNavigator>) {
  return navigator.constructors;
}

function normalizeSetCookieHeader(setCookie: string[] | string | undefined) {
  if (!setCookie) return '';
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  return values.map((cookie) => cookie.split(';')[0]).join('; ');
}

function isProbadorCoffeeProduct(name: string, description: string, href: string) {
  const classifierText = `${name} ${href}`;
  const normalizedClassifierText = normalizeTurkishText(classifierText);
  if (!isLikelyCatalogCoffeeProduct([classifierText])) return false;
  if (
    /(?:\bseti\b|\bsetleri\b|orneklem|kahveler[ıi]?\s+\d|allfaktori|harita|map|huskee|cup|kapak|tabak|degirmen|comandante|rhinowares|espro|delter|mikrofiltre|filtre\s*kagidi|press|stand|aparat)/i.test(
      normalizedClassifierText
    )
  ) {
    return false;
  }

  const haystack = normalizeTurkishText(`${name} ${description} ${href}`);
  return [
    'kahve',
    'coffee',
    'etiyopya',
    'ethiopia',
    'kolombiya',
    'colombia',
    'kostarika',
    'costa rica',
    'peru',
    'kenya',
    'guatemala',
    'honduras',
    'panama',
    'el salvador',
    'brezilya',
    'brazil',
    'yıkanmış',
    'yikanmis',
    'washed',
    'dogal',
    'honey',
    'finca',
    'geisha',
    'gesha',
    'caturra',
    'bourbon',
    'mikrolot',
    'microlot',
  ].some((keyword) => haystack.includes(keyword));
}

function normalizeTurkishText(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

export function parseCatalogPriceText(text: string, config: RoasterConfig): number | null {
  const compactText = text.replace(/\s+/g, ' ').trim();
  const firstPriceText = compactText.match(/\d[\d.,]*/)?.[0];

  if (!firstPriceText) return null;

  const num = parseLocalizedPriceNumber(firstPriceText);
  if (num === null) return null;

  return config.priceFormat === 'kurus' ? num / 100 : num;
}

function parseTurkishPrice(text: string, config: RoasterConfig): number | null {
  return parseCatalogPriceText(text, config);
}

function parseLocalizedPriceNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = /\d+,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastDot >= 0) {
    normalized = /\d+\.\d{1,2}$/.test(cleaned)
      ? cleaned
      : cleaned.replace(/\./g, '');
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseWeight(text: string): number | null {
  const gMatch = text.match(/(\d+)\s*(?:gr?|gram)\b/i);
  if (gMatch) return Number.parseInt(gMatch[1], 10);
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) return Math.round(Number.parseFloat(kgMatch[1]) * 1000);
  return null;
}

function makeExternalId(url: string): string {
  try {
    const path = new URL(url).pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '-');
    return path || url;
  } catch {
    return url;
  }
}
