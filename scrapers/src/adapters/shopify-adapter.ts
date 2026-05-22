import axios from 'axios';
import { BaseScraper } from '../base-scraper.js';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import type { RoasterConfig, RawProduct } from '../types.js';
import {
  normalizeRoasterImageUrl,
  normalizeRoasterProductUrl,
} from '../url-policy.js';
import { comparePackageWeightPreference, parsePackageWeight } from './package-selection.js';

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string[];
  images: { src: string }[];
  variants: {
    id: number;
    title: string;
    price: string;
    available: boolean;
    grams: number;
  }[];
}

export class ShopifyAdapter extends BaseScraper {
  constructor(config: RoasterConfig) {
    super(config);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    let page = 1;
    const baseUrl = this.config.collectionHandle
      ? `${this.config.shopUrl}/collections/${this.config.collectionHandle}/products.json`
      : `${this.config.shopUrl}/products.json`;

    while (true) {
      const url = `${baseUrl}?limit=250&page=${page}`;
      const { data } = await axios.get<{ products: ShopifyProduct[] }>(url, {
        timeout: 30000,
        headers: { 'User-Agent': 'TRCoffeeDB/1.0 (coffee aggregator)' },
      });

      if (!data.products || data.products.length === 0) break;

      for (const product of data.products) {
        if (!this.isCoffeeProduct(product)) continue;

        const variant = this.pickBestVariant(product.variants);
        const weightGrams = this.extractWeight(variant, product);
        const productUrl = normalizeRoasterProductUrl(
          `/products/${product.handle}`,
          this.config,
          this.config.shopUrl
        );
        if (!productUrl) continue;

        allProducts.push({
          externalId: String(product.id),
          name: product.title,
          description: this.stripHtml(product.body_html || ''),
          // Shopify prices are always in TL (e.g., "595.00")
          price: variant ? parseFloat(variant.price) : null,
          currency: 'TRY',
          weightGrams,
          imageUrl: normalizeRoasterImageUrl(product.images[0]?.src, this.config),
          productUrl,
          isAvailable: product.variants.some((v) => v.available),
          variants: product.variants.map((v) => ({
            id: String(v.id),
            title: v.title,
            price: parseFloat(v.price),
            weightGrams: v.grams || parsePackageWeight(v.title),
            isAvailable: v.available,
          })),
          tags: product.tags,
          rawData: { product_type: product.product_type },
        });
      }

      page++;
      // Rate limiting: 2s between pages
      await new Promise((r) => setTimeout(r, 2000));
    }

    return allProducts;
  }

  private isCoffeeProduct(product: ShopifyProduct): boolean {
    if (
      !isLikelyCatalogCoffeeProduct([
        product.title,
        product.product_type,
        ...product.tags,
      ])
    ) {
      return false;
    }

    const { productTypeFilter, tagFilters } = this.config;

    // Check product_type
    if (productTypeFilter && productTypeFilter.length > 0) {
      const pt = product.product_type.toLowerCase();
      if (productTypeFilter.some((f) => pt.includes(f.toLowerCase()))) return true;
    }

    // Check tags
    if (tagFilters && tagFilters.length > 0) {
      const tags = product.tags.map((t) => t.toLowerCase());
      if (tagFilters.some((f) => tags.some((t) => t.includes(f.toLowerCase())))) return true;
    }

    // If no filters set, include everything
    if (!productTypeFilter?.length && !tagFilters?.length) return true;

    return false;
  }

  private pickBestVariant(
    variants: ShopifyProduct['variants']
  ): ShopifyProduct['variants'][0] | null {
    if (!variants.length) return null;
    // Prefer the smallest available variant (typically 250g)
    const available = variants.filter((v) => v.available);
    const pool = available.length > 0 ? available : variants;
    return pool
      .map((variant) => ({
        variant,
        weightGrams: this.extractVariantWeight(variant),
        text: variant.title,
      }))
      .sort((a, b) => {
        const weightPreference = comparePackageWeightPreference(
          a.weightGrams,
          a.text,
          b.weightGrams,
          b.text
        );
        if (weightPreference !== 0) return weightPreference;
        return parseFloat(a.variant.price) - parseFloat(b.variant.price);
      })[0]?.variant ?? null;
  }

  private extractWeight(
    variant: ShopifyProduct['variants'][0] | null,
    product: ShopifyProduct
  ): number | null {
    // Try variant grams field first
    if (variant?.grams && variant.grams > 0) return variant.grams;
    // Try parsing from variant title
    if (variant?.title) {
      const w = parsePackageWeight(variant.title);
      if (w) return w;
    }
    // Try parsing from product title
    return parsePackageWeight(product.title);
  }

  private extractVariantWeight(variant: ShopifyProduct['variants'][0]): number | null {
    if (variant.grams && variant.grams > 0) return variant.grams;
    return parsePackageWeight(variant.title);
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
}
