import axios from 'axios';
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

          const priceText = $el.find(selectors.productPrice).text().trim();
          const price = this.parsePrice(priceText);

          const imageEl = $el.find(selectors.productImage);
          const imageSrc = imageEl.attr('src') || imageEl.attr('data-src') || null;
          const imageUrl = imageSrc && imageSrc.startsWith('http')
            ? imageSrc
            : imageSrc
              ? new URL(imageSrc, this.config.shopUrl).toString()
              : null;

          const weightGrams = this.parseWeight(name);

          allProducts.push({
            externalId: this.makeExternalId(productUrl),
            name,
            description: '', // Fetched from detail page if needed
            price,
            currency: 'TRY',
            weightGrams,
            imageUrl,
            productUrl,
            isAvailable: true, // Assume available if listed
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

    if (!isLikelyCatalogCoffeeProduct(parts)) {
      return false;
    }

    const haystack = parts
      .filter((part): part is string => Boolean(part))
      .join(' ')
      .toLowerCase();
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
      'kitap',
      'çikolata',
      'cikolata',
      'kakao',
      'seramik',
      'bardak',
      'fincan',
    ];

    if (excludedKeywords.some((keyword) => classificationHaystack.includes(keyword))) {
      return false;
    }

    return [
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
    ].some((keyword) => haystack.includes(keyword));
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

  private parsePrice(text: string): number | null {
    // Handle Turkish price formats: "595,00 TL", "₺595.00", "595 ₺", "595,00"
    const cleaned = text
      .replace(/[^\d,.]/g, '')
      .replace(/\.(?=\d{3})/g, '')  // Remove thousand separators
      .replace(',', '.');            // Normalize decimal separator

    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;

    // Apply price format normalization
    if (this.config.priceFormat === 'kurus') {
      return num / 100;
    }
    return num;
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
