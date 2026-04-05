import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base-scraper.js';
import type { RoasterConfig, RawProduct } from '../types.js';

export class HtmlAdapter extends BaseScraper {
  constructor(config: RoasterConfig) {
    super(config);
    if (!config.selectors) {
      throw new Error(`[${config.slug}] HTML adapter requires selectors in config`);
    }
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    const selectors = this.config.selectors!;
    let currentUrl: string | null = this.config.shopUrl;
    let pageCount = 0;
    const maxPages = 20;

    while (currentUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`[${this.config.slug}] Fetching page ${pageCount}: ${currentUrl}`);

      const { data: html } = await axios.get<string>(currentUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TRCoffeeDB/1.0)',
          'Accept': 'text/html',
        },
      });

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
