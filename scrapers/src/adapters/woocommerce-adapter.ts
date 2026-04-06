import axios from 'axios';
import { BaseScraper } from '../base-scraper.js';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import type { RoasterConfig, RawProduct } from '../types.js';

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description: string;
  short_description: string;
  prices: {
    price: string;        // Could be kuruş (e.g. "75000") or TL (e.g. "520")
    currency_code: string;
    currency_minor_unit: number; // 0 = TL, 2 = kuruş
  };
  images: { src: string; alt: string }[];
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  is_purchasable: boolean;
  is_in_stock: boolean;
  variations: unknown[];
  attributes: { id: number; name: string; terms: { id: number; name: string }[] }[];
}

export class WooCommerceAdapter extends BaseScraper {
  constructor(config: RoasterConfig) {
    super(config);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    let page = 1;

    while (true) {
      const url = `${this.config.shopUrl}/wp-json/wc/store/v1/products`;
      const params: Record<string, string | number> = {
        per_page: 100,
        page,
      };
      if (this.config.categoryId) {
        params.category = this.config.categoryId;
      }

      try {
        const { data, headers } = await axios.get<WooProduct[]>(url, {
          params,
          timeout: 30000,
          headers: { 'User-Agent': 'TRCoffeeDB/1.0 (coffee aggregator)' },
        });

        if (!Array.isArray(data) || data.length === 0) break;

        for (const product of data) {
          if (!this.isCoffeeProduct(product)) continue;

          const priceTL = this.normalizePriceToTL(product);
          const weightGrams = this.extractWeight(product);

          allProducts.push({
            externalId: String(product.id),
            name: this.decodeHtmlEntities(product.name),
            description: this.stripHtml(
              product.description || product.short_description || ''
            ),
            price: priceTL,
            currency: 'TRY',
            weightGrams,
            imageUrl: product.images[0]?.src || null,
            productUrl: product.permalink,
            isAvailable: product.is_in_stock,
            tags: product.tags.map((t) => t.name),
            rawData: {
              categories: product.categories.map((c) => c.name),
              attributes: product.attributes,
            },
          });
        }

        // Check if there are more pages
        const totalPages = parseInt(
          headers['x-wp-totalpages'] || '1'
        );
        if (page >= totalPages) break;

        page++;
        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        // If Store API fails, try legacy WC REST API
        if (page === 1) {
          console.warn(
            `[${this.config.slug}] Store API failed, trying v3 API...`
          );
          return this.fetchFromLegacyApi();
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `WooCommerce Store API failed on page ${page}: ${message}`
        );
      }
    }

    return allProducts;
  }

  /**
   * Normalize price to TL (Turkish Lira).
   * WooCommerce Store API prices vary:
   * - currency_minor_unit=2: price is in kuruş (e.g., "75000" = 750.00 TL)
   * - currency_minor_unit=0: price is in TL (e.g., "520" = 520 TL)
   * - We also use the roaster config's priceFormat as fallback
   */
  private normalizePriceToTL(product: WooProduct): number | null {
    const raw = product.prices?.price;
    if (!raw) return null;

    const numericPrice = parseFloat(raw);
    if (isNaN(numericPrice)) return null;

    // Use WooCommerce's currency_minor_unit if available
    const minorUnit = product.prices?.currency_minor_unit;
    if (minorUnit !== undefined && minorUnit > 0) {
      return numericPrice / Math.pow(10, minorUnit);
    }

    // Fallback to roaster config
    if (this.config.priceFormat === 'kurus') {
      return numericPrice / 100;
    }

    return numericPrice;
  }

  private isCoffeeProduct(product: WooProduct): boolean {
    const categories = product.categories.map((c) => c.name.toLowerCase());
    const tags = product.tags.map((tag) => tag.name);

    if (
      !isLikelyCatalogCoffeeProduct([
        product.name,
        ...categories,
        ...tags,
      ])
    ) {
      return false;
    }

    const coffeeKeywords = [
      'kahve', 'coffee', 'filtre', 'espresso', 'çekirdek',
      'blend', 'single origin', 'tek köken',
    ];
    // If product has categories, check for coffee-related ones
    if (categories.length > 0) {
      return categories.some((cat) =>
        coffeeKeywords.some((kw) => cat.includes(kw))
      );
    }
    // If no categories, include by default (small catalog = likely all coffee)
    return true;
  }

  private extractWeight(product: WooProduct): number | null {
    // Try attributes
    for (const attr of product.attributes || []) {
      if (
        attr.name.toLowerCase().includes('ağırlık') ||
        attr.name.toLowerCase().includes('gram') ||
        attr.name.toLowerCase().includes('weight')
      ) {
        const term = attr.terms[0];
        if (term) return this.parseWeight(term.name);
      }
    }
    // Try product name
    return this.parseWeight(product.name);
  }

  private parseWeight(text: string): number | null {
    const gMatch = text.match(/(\d+)\s*(?:gr?|gram)\b/i);
    if (gMatch) return parseInt(gMatch[1]);
    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
    return null;
  }

  private async fetchFromLegacyApi(): Promise<RawProduct[]> {
    // v3 REST API typically requires auth — just return empty
    console.warn(`[${this.config.slug}] Legacy API requires auth, skipping`);
    return [];
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#?\w+;/g, '')
      .trim();
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&#215;/g, '×')
      .replace(/&#8217;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
}
