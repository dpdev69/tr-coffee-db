import axios from 'axios';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base-scraper.js';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import type { RoasterConfig, RawProduct } from '../types.js';
import {
  normalizeRoasterImageUrl,
  normalizeRoasterProductUrl,
} from '../url-policy.js';
import { comparePackageWeightPreference, parsePackageWeight } from './package-selection.js';

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
  images?: NextDataVariantImage[];
}

interface NextDataVariantImage {
  imageId?: string | null;
  isMain?: boolean | null;
  isVideo?: boolean | null;
  order?: number | null;
  image?: {
    id?: string | null;
    isVideo?: boolean | null;
  } | null;
}

interface StructuredProductImage {
  name: string | null;
  urls: string[];
  slugs: string[];
  images: string[];
}

interface IkasImageContext {
  cdnUrl: string;
  merchantId: string;
}

interface ProbadorChallengeSubmission {
  action: string;
  fields: Array<{ name: string; value: string }>;
}

interface DetailPackageSelection {
  weightGrams: number;
  price: number | null;
  label: string;
  text: string;
  isAvailable: boolean;
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

    const productUrl = normalizeRoasterProductUrl(href, config, config.websiteUrl);
    if (!productUrl) return;

    const description = $el.find('.note').first().text().trim();
    if (!isProbadorCoffeeProduct(name, description, href)) return;

    const externalId = makeExternalId(productUrl);
    if (uniqueProducts.has(externalId)) return;

    const imageSrc = $el.find('a.image img').first().attr('src') ?? null;
    const imageUrl = normalizeRoasterImageUrl(imageSrc, config, config.websiteUrl);
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
      weightGrams: parsePackageWeight($el.text()),
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
      const documentBaseUrl =
        normalizeRoasterProductUrl($('base[href]').first().attr('href'), this.config, currentUrl)
        ?? currentUrl;
      const productElements = $(selectors.productList);

      productElements.each((_, el) => {
        try {
          const $el = $(el);
          const name = $el.find(selectors.productName).text().trim();
          if (!name) return;

          const linkEl = $el.find(selectors.productLink);
          const href = linkEl.attr('href') || '';
          const productUrl = normalizeRoasterProductUrl(href, this.config, documentBaseUrl);
          if (!productUrl) return;

          const description = selectors.description
            ? $el.find(selectors.description).text().trim()
            : '';

          if (!isLikelyCatalogCoffeeProduct([name, description, productUrl])) return;

          const priceText = $el.find(selectors.productPrice).text().trim();
          const price = parseCatalogPriceText(priceText, this.config);
          const externalId = this.makeExternalId(productUrl);
          if (allProducts.some((product) => product.externalId === externalId)) return;

          const imageEl = $el.find(selectors.productImage);
          const imageSrc = imageEl.attr('data-lazyloadsrc')
            || imageEl.attr('data-src')
            || imageEl.attr('src')
            || null;
          const imageUrl = normalizeRoasterImageUrl(imageSrc, this.config, documentBaseUrl);

          const weightGrams = parsePackageWeight(`${name} ${$el.text()}`);
          const isAvailable = selectors.unavailableText
            ? !$el.text().includes(selectors.unavailableText)
            : true;

          allProducts.push({
            externalId,
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
        currentUrl = normalizeRoasterProductUrl(nextLink, this.config, documentBaseUrl);
      } else {
        currentUrl = null;
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!this.config.derivePackageFromProductPage) {
      return allProducts;
    }

    return this.enrichProductsWithProductPagePackages(allProducts);
  }

  private async fetchProductsFromProbador(): Promise<RawProduct[]> {
    const html = await this.fetchProbadorPageHtml(this.config.shopUrl);
    return parseProbadorProducts(html, this.config);
  }

  private async enrichProductsWithProductPagePackages(products: RawProduct[]) {
    const enrichedProducts: RawProduct[] = [];

    for (const product of products) {
      try {
        const html = await this.fetchPageHtml(product.productUrl);
        const productPageMetadata = this.config.deriveMetadataFromProductPage === false
          ? { attributes: [], description: '' }
          : parseProductPageMetadata(html);
        const packageSelection = parseProductPagePackageSelection(
          html,
          this.config,
          product.price
        );

        enrichedProducts.push({
          ...product,
          description: [product.description, productPageMetadata.description]
            .filter(Boolean)
            .join(' '),
          ...(packageSelection
            ? {
                price: packageSelection.price,
                weightGrams: packageSelection.weightGrams,
                isAvailable: product.isAvailable && packageSelection.isAvailable,
              }
            : {}),
          rawData: {
            ...product.rawData,
            ...(productPageMetadata.attributes.length > 0
              ? { attributes: productPageMetadata.attributes }
              : {}),
            ...(packageSelection
              ? {
                  packageSelection: {
                    label: packageSelection.label,
                    price: packageSelection.price,
                    weightGrams: packageSelection.weightGrams,
                  },
                }
              : {}),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[${this.config.slug}] Could not read package options for ${product.productUrl}: ${message}`
        );
        enrichedProducts.push(product);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return enrichedProducts;
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
    const ikasImageContext = this.extractIkasImageContext(parsed);
    const structuredProductImages = [
      ...this.collectStructuredProductImages($, this.config.shopUrl),
      ...this.collectHtmlProductImages($, this.config.shopUrl),
    ];
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
      const productUrl = new URL(`/${slug}`, this.config.websiteUrl).toString();
      const imageUrl =
        this.findNextDataProductImageUrl(product, variant, ikasImageContext)
        ?? this.findStructuredProductImageUrl(product, productUrl, structuredProductImages);

      uniqueProducts.set(slug, {
        externalId: slug,
        name: product.name.trim(),
        description: this.stripHtml(product.description || product.shortDescription || ''),
        price: this.extractNextDataPrice(variant),
        currency: 'TRY',
        weightGrams: parsePackageWeight(`${product.name} ${variantText}`),
        imageUrl,
        productUrl,
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

  private extractIkasImageContext(value: unknown): IkasImageContext | null {
    if (!value || typeof value !== 'object') return null;

    const configJson = (((value as Record<string, unknown>).props as Record<string, unknown> | undefined)
      ?.pageProps as Record<string, unknown> | undefined)?.configJson as
      | Record<string, unknown>
      | undefined;
    const merchantSettings = configJson?.merchantSettings as Record<string, unknown> | undefined;
    const rawCdnUrl = typeof configJson?.cdnUrl === 'string' ? configJson.cdnUrl : null;
    const rawMerchantId =
      typeof merchantSettings?.merchantId === 'string' ? merchantSettings.merchantId : null;

    if (!rawCdnUrl || !rawMerchantId) return null;

    try {
      return {
        cdnUrl: new URL(rawCdnUrl).toString().replace(/\/+$/, ''),
        merchantId: rawMerchantId,
      };
    } catch {
      return null;
    }
  }

  private findNextDataProductImageUrl(
    product: NextDataProduct,
    preferredVariant: NextDataVariant,
    imageContext: IkasImageContext | null
  ) {
    if (!imageContext) return null;

    const variantImages = [
      ...(preferredVariant.images ?? []),
      ...(product.variants ?? []).flatMap((variant) => variant.images ?? []),
    ];
    const imageId = variantImages
      .filter((image) => image.isVideo !== true && image.image?.isVideo !== true)
      .sort((left, right) => {
        if (left.isMain !== right.isMain) return left.isMain ? -1 : 1;
        return (left.order ?? Number.POSITIVE_INFINITY)
          - (right.order ?? Number.POSITIVE_INFINITY);
      })
      .map((image) => image.imageId ?? image.image?.id ?? null)
      .find((id): id is string => Boolean(id?.trim()));

    if (!imageId) return null;

    const imageUrl = `${imageContext.cdnUrl}/images/${imageContext.merchantId}/${imageId}/image_1080.webp`;
    return normalizeRoasterImageUrl(imageUrl, this.config, this.config.shopUrl);
  }

  private collectHtmlProductImages(
    $: ReturnType<typeof cheerio.load>,
    documentBaseUrl: string
  ) {
    const products: StructuredProductImage[] = [];

    $('img').each((_, el) => {
      const imageUrls = this.extractImageElementUrls($, el)
        .filter((url) => !this.isNonProductIkasImage(url));
      if (imageUrls.length === 0) return;

      const alt = $(el).attr('alt')?.trim() || null;
      const name = this.cleanProductImageAltText(alt);
      const rawProductUrl = $(el).closest('a[href]').attr('href') ?? null;
      const productUrl = normalizeRoasterProductUrl(rawProductUrl, this.config, documentBaseUrl);
      const slugs = productUrl ? this.productUrlMatchKeys(productUrl) : [];

      if (!name && slugs.length === 0) return;

      products.push({
        name,
        urls: productUrl ? [productUrl] : [],
        slugs: [...new Set(slugs)],
        images: imageUrls,
      });
    });

    return products;
  }

  private collectStructuredProductImages(
    $: ReturnType<typeof cheerio.load>,
    documentBaseUrl: string
  ) {
    const products: StructuredProductImage[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).contents().text().trim();
        if (!text) return;

        const parsed = JSON.parse(text);
        products.push(...this.extractStructuredProductImages(parsed, documentBaseUrl));
      } catch {
        // Structured data is useful enrichment, but it should never fail the catalog scrape.
      }
    });

    return products;
  }

  private extractStructuredProductImages(
    value: unknown,
    documentBaseUrl: string,
    results: StructuredProductImage[] = []
  ) {
    if (!value || typeof value !== 'object') return results;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.extractStructuredProductImages(item, documentBaseUrl, results);
      }
      return results;
    }

    const record = value as Record<string, unknown>;
    const type = record['@type'];
    const typeValues = Array.isArray(type) ? type : [type];

    if (typeValues.some((item) => item === 'Product')) {
      const product = this.readStructuredProductImage(record, documentBaseUrl);
      if (product) results.push(product);
    }

    if (typeValues.some((item) => item === 'ItemList')) {
      this.extractStructuredProductImages(record.itemListElement, documentBaseUrl, results);
    }

    if (record.item && typeof record.item === 'object') {
      this.extractStructuredProductImages(record.item, documentBaseUrl, results);
    }

    if (record['@graph']) {
      this.extractStructuredProductImages(record['@graph'], documentBaseUrl, results);
    }

    return results;
  }

  private readStructuredProductImage(
    product: Record<string, unknown>,
    documentBaseUrl: string
  ): StructuredProductImage | null {
    const images = this.extractStructuredImageValues(product.image);
    if (images.length === 0) return null;

    const name = typeof product.name === 'string' ? product.name.trim() : null;
    const rawUrls = [
      product.url,
      product['@id'],
      typeof product.offers === 'object' && product.offers
        ? (product.offers as Record<string, unknown>).url
        : null,
    ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
    const urls = rawUrls
      .map((url) => normalizeRoasterProductUrl(url, this.config, documentBaseUrl))
      .filter((url): url is string => Boolean(url));
    const slugs = [
      ...urls.flatMap((url) => this.productUrlMatchKeys(url)),
      ...rawUrls.map((url) => this.normalizeSlugMatchKey(url)),
    ].filter((slug): slug is string => Boolean(slug));

    return {
      name,
      urls,
      slugs: [...new Set(slugs)],
      images,
    };
  }

  private extractStructuredImageValues(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (!Array.isArray(value)) return [];

    return value.filter((item): item is string => typeof item === 'string');
  }

  private extractImageElementUrls(
    $: ReturnType<typeof cheerio.load>,
    el: Parameters<ReturnType<typeof cheerio.load>>[0]
  ) {
    const element = $(el);
    const urls = [
      ...this.parseImageSrcSet(element.attr('srcset') ?? element.attr('data-srcset') ?? ''),
      element.attr('data-lazyloadsrc'),
      element.attr('data-src'),
      element.attr('src'),
      ...this.parseCssImageUrls(element.attr('style') ?? ''),
      ...this.extractNearbyNoscriptImageUrls($, el),
    ];

    return [...new Set(
      urls
        .map((url) => url?.trim())
        .filter(
          (url): url is string =>
            typeof url === 'string' && url.length > 0 && !url.startsWith('data:')
        )
    )];
  }

  private extractNearbyNoscriptImageUrls(
    $: ReturnType<typeof cheerio.load>,
    el: Parameters<ReturnType<typeof cheerio.load>>[0]
  ) {
    const element = $(el);
    const htmlSnippets = [
      ...element.nextAll('noscript').map((_, node) => $(node).html() ?? '').get(),
      ...element.parent().find('noscript').map((_, node) => $(node).html() ?? '').get(),
    ].filter(Boolean);
    const urls: string[] = [];

    for (const html of htmlSnippets) {
      const fragment = cheerio.load(html);
      fragment('img').each((_, image) => {
        const imageElement = fragment(image);
        urls.push(
          ...this.parseImageSrcSet(
            imageElement.attr('srcset') ?? imageElement.attr('data-srcset') ?? ''
          ),
          ...[
            imageElement.attr('data-lazyloadsrc'),
            imageElement.attr('data-src'),
            imageElement.attr('src'),
          ].filter((url): url is string => typeof url === 'string'),
          ...this.parseCssImageUrls(imageElement.attr('style') ?? '')
        );
      });
    }

    return urls;
  }

  private parseImageSrcSet(srcSet: string) {
    return srcSet
      .split(',')
      .map((candidate) => {
        const [url = '', descriptor] = candidate.trim().split(/\s+/, 2);
        const width = descriptor?.endsWith('w')
          ? Number.parseInt(descriptor, 10)
          : 0;

        return { url, width: Number.isFinite(width) ? width : 0 };
      })
      .filter((candidate): candidate is { url: string; width: number } => Boolean(candidate.url))
      .sort((left, right) => right.width - left.width)
      .map((candidate) => candidate.url);
  }

  private parseCssImageUrls(style: string) {
    return [...style.matchAll(/url\(([^)]+)\)/gi)]
      .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''))
      .map((url) => url.replace(/&quot;/g, '').replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  private cleanProductImageAltText(value: string | null) {
    const normalized = value
      ?.replace(/\bmain\s+variant\s+image\b/gi, ' ')
      .replace(/\bvariant\s+image\b/gi, ' ')
      .replace(/\bimage\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized || null;
  }

  private isNonProductIkasImage(url: string) {
    return /\/images\/theme-images\//i.test(url) || /\/videos\//i.test(url);
  }

  private findStructuredProductImageUrl(
    product: NextDataProduct,
    productUrl: string,
    structuredProducts: StructuredProductImage[]
  ) {
    const productKeys = new Set([
      ...this.productUrlMatchKeys(productUrl),
      this.normalizeSlugMatchKey(product.metaData?.slug ?? null),
    ].filter((key): key is string => Boolean(key)));
    const nameKey = this.normalizeNameMatchKey(product.name);
    const strongMatches = structuredProducts.filter((structuredProduct) =>
      structuredProduct.slugs.some((slug) => productKeys.has(slug))
    );
    const nameMatches = strongMatches.length > 0
      ? []
      : structuredProducts.filter(
          (structuredProduct) =>
            nameKey && this.normalizeNameMatchKey(structuredProduct.name) === nameKey
        );

    const imageCandidates = this.sortImageCandidatesBySize(
      [...strongMatches, ...nameMatches].flatMap((structuredProduct) => structuredProduct.images)
    );

    for (const image of imageCandidates) {
      const normalizedImage = normalizeRoasterImageUrl(image, this.config, this.config.shopUrl);
      if (normalizedImage) return normalizedImage;
    }

    return null;
  }

  private sortImageCandidatesBySize(images: string[]) {
    return [...new Set(images)].sort((left, right) =>
      this.extractImageCandidateSize(right) - this.extractImageCandidateSize(left)
    );
  }

  private extractImageCandidateSize(url: string) {
    const imageNameSize = url.match(/image_(\d+)\./i);
    if (imageNameSize) return Number.parseInt(imageNameSize[1], 10);

    const pathSize = url.match(/\/(\d+)\/[^/]+$/);
    if (pathSize) return Number.parseInt(pathSize[1], 10);

    return 0;
  }

  private productUrlMatchKeys(url: string) {
    try {
      const parsed = new URL(url);
      return [
        this.normalizePathMatchKey(parsed.pathname),
        this.normalizeSlugMatchKey(parsed.pathname.split('/').filter(Boolean).at(-1) ?? null),
      ].filter((key): key is string => Boolean(key));
    } catch {
      return [];
    }
  }

  private normalizePathMatchKey(path: string | null | undefined) {
    if (!path) return null;

    const normalized = path
      .split('/')
      .map((part) => this.normalizeSlugMatchKey(part))
      .filter(Boolean)
      .join('/');

    return normalized || null;
  }

  private normalizeSlugMatchKey(value: string | null | undefined) {
    const slug = value?.split(/[?#]/, 1)[0]?.split('/').filter(Boolean).at(-1);
    if (!slug) return null;

    return this.normalizeNameMatchKey(slug.replace(/[-_]+/g, ' '));
  }

  private normalizeNameMatchKey(value: string | null | undefined) {
    if (!value) return null;

    const normalized = value
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    return normalized || null;
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
          weightGrams: parsePackageWeight(`${product.name} ${variantText}`),
          text: `${product.name} ${variantText}`,
          price: this.extractNextDataPrice(variant) ?? Number.POSITIVE_INFINITY,
        };
      })
      .sort((left, right) => {
        if (left.isAvailable !== right.isAvailable) {
          return left.isAvailable ? -1 : 1;
        }
        const weightPreference = comparePackageWeightPreference(
          left.weightGrams,
          left.text,
          right.weightGrams,
          right.text
        );
        if (weightPreference !== 0) return weightPreference;
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

export function parseProductPagePackageSelection(
  html: string,
  config: RoasterConfig,
  fallbackBasePrice: number | null
): DetailPackageSelection | null {
  const $ = cheerio.load(html);
  const basePrice = parseProductPageBasePrice($, config) ?? fallbackBasePrice;
  const candidates = [
    ...extractAnchorPackageOptions($, config, basePrice),
    ...extractDefinitionListPackageOptions($, config, basePrice),
  ];

  return candidates
    .filter((candidate) => candidate.weightGrams != null)
    .sort((left, right) => {
      if (left.isAvailable !== right.isAvailable) {
        return left.isAvailable ? -1 : 1;
      }

      const weightPreference = comparePackageWeightPreference(
        left.weightGrams,
        left.text,
        right.weightGrams,
        right.text
      );
      if (weightPreference !== 0) return weightPreference;

      return (left.price ?? Number.POSITIVE_INFINITY)
        - (right.price ?? Number.POSITIVE_INFINITY);
    })[0] ?? null;
}

export function parseProductPageMetadata(html: string) {
  const $ = cheerio.load(html);
  const attributes = [
    ...extractDetailTableAttributes($),
    ...extractColonListAttributes($),
  ];
  const description = [
    ...attributes.map((attribute) => `${attribute.name}: ${attribute.terms[0]?.name ?? ''}`),
    ...extractMetaDescriptions($),
    ...[
      '.short-description',
      '.product-short-desc',
      '.full-description',
      '#tab-description',
      '.woocommerce-Tabs-panel--description',
      '.urunTabAlt',
    ].map((selector) => cleanText($(selector).first().text())),
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 5000);

  return { attributes, description };
}

function extractDetailTableAttributes($: ReturnType<typeof cheerio.load>) {
  return $('tr')
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return null;

      const name = cleanText(cells.first().text());
      const value = cleanText(cells.eq(1).text());
      if (!name || !value) return null;

      return {
        name,
        terms: [{ name: value }],
      };
    })
    .get();
}

function extractMetaDescriptions($: ReturnType<typeof cheerio.load>) {
  return $('meta[name="description"], meta[property="og:description"], meta[property="twitter:description"]')
    .map((_, meta) => cleanText($(meta).attr('content') ?? ''))
    .get()
    .filter(Boolean);
}

function extractColonListAttributes($: ReturnType<typeof cheerio.load>) {
  const containers = [
    '#product-tab-description',
    '#tab-description',
    '.woocommerce-Tabs-panel--description',
    '.urunTabAlt',
  ].join(',');

  return $(containers)
    .find('li, p')
    .map((_, item) => {
      const text = cleanText($(item).text());
      const match = text.match(/^([^:：]{2,45})[:：]\s*(.{1,220})$/u);
      if (!match) return null;

      const name = match[1].trim();
      const value = match[2].trim();
      if (!name || !value) return null;

      return {
        name,
        terms: [{ name: value }],
      };
    })
    .get();
}

function parseProductPageBasePrice(
  $: ReturnType<typeof cheerio.load>,
  config: RoasterConfig
) {
  const selectors = [
    '.product-prices-box .product-price',
    '.product-price .new-price[data-guncel-fiyat]',
    '.product-price .new-price',
    '.product-essential .product-price',
    '.product-info .product-price',
    '.product-price',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    const attrPrice = element.attr('data-guncel-fiyat');
    const textPrice = element.text().trim();
    const price = parseCatalogPriceText(attrPrice || textPrice, config);
    if (price != null) return price;
  }

  return null;
}

function extractAnchorPackageOptions(
  $: ReturnType<typeof cheerio.load>,
  config: RoasterConfig,
  basePrice: number | null
): DetailPackageSelection[] {
  const options: DetailPackageSelection[] = [];

  $('.product-variations a, .product-size-swatch a, a.size').each((_, option) => {
    const element = $(option);
    const label = element.text().replace(/\s+/g, ' ').trim();
    const weightGrams = parsePackageOptionWeight(label);
    if (weightGrams == null) return;

    const explicitPriceText = element.attr('data-fiyat')
      || element.attr('data-price')
      || element.attr('data-option-price')
      || '';
    const explicitPrice = explicitPriceText.trim()
      ? parseCatalogPriceText(explicitPriceText, config)
      : null;
    const stockText = element.attr('data-stok');
    const stock = stockText ? Number.parseInt(stockText, 10) : null;
    const isAvailable = !element.hasClass('nostok') && (stock == null || stock > 0);

    options.push({
      weightGrams,
      price: explicitPrice ?? basePrice,
      label,
      text: label,
      isAvailable,
    });
  });

  return options;
}

function extractDefinitionListPackageOptions(
  $: ReturnType<typeof cheerio.load>,
  config: RoasterConfig,
  basePrice: number | null
): DetailPackageSelection[] {
  const options: DetailPackageSelection[] = [];

  $('dt').each((_, term) => {
    const label = $(term).text().replace(/\s+/g, ' ').trim();
    if (!/gramaj/i.test(normalizeTurkishText(label))) return;

    const rawOptions = $(term).next('dd').find('label').map((_, optionLabel) => {
      const element = $(optionLabel);
      const text = element.text().replace(/\s+/g, ' ').trim();
      const weightGrams = parsePackageOptionWeight(text);
      if (weightGrams == null) return null;

      const priceDelta = parseBracketPriceDelta(text, config);
      const input = $(`#${element.attr('for') ?? ''}`);
      const isAvailable = !input.attr('disabled') && !element.closest('li').hasClass('disabled');

      return {
        weightGrams,
        priceDelta,
        label: text,
        text,
        isAvailable,
      };
    }).get();
    const hasBasePricedOption = rawOptions.some((option) => option.priceDelta == null);

    for (const option of rawOptions) {
      options.push({
        weightGrams: option.weightGrams,
        price: option.priceDelta == null
          ? basePrice
          : hasBasePricedOption && basePrice != null
            ? basePrice + option.priceDelta
            : option.priceDelta,
        label: option.label,
        text: option.text,
        isAvailable: option.isAvailable,
      });
    }
  });

  return options;
}

function parsePackageOptionWeight(text: string) {
  const withoutPrice = text.replace(/\[[^\]]+\]/g, ' ');
  const explicitWeight = parsePackageWeight(withoutPrice);
  if (explicitWeight != null) return explicitWeight;

  const standaloneGrams = withoutPrice.match(/(?:^|\s)(100|150|200|250|350|500|1000)(?:\s|$)/i);
  if (!standaloneGrams) return null;

  return Number.parseInt(standaloneGrams[1], 10);
}

function parseBracketPriceDelta(text: string, config: RoasterConfig) {
  const match = text.match(/\[\s*([+-])?\s*(?:₺|TL)?\s*([\d.,]+)\s*(?:TL)?\s*\]/i);
  if (!match) return null;

  const price = parseCatalogPriceText(match[2], config);
  if (price == null) return null;

  return match[1] === '-' ? -price : price;
}

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
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
