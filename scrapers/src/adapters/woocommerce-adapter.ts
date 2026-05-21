import axios from 'axios';
import { createContext, runInContext } from 'node:vm';
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

interface ImunifyChallengeSubmission {
  action: string;
  params: Record<string, string | number>;
}

export class WooCommerceAdapter extends BaseScraper {
  private challengeCookie: string | null = null;

  constructor(config: RoasterConfig) {
    super(config);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    let page = 1;
    let challengeRetried = false;

    while (true) {
      try {
        const { data, headers } = await this.fetchStoreApiPage(page);

        if (!Array.isArray(data)) {
          if (!challengeRetried && this.isImunifyDeniedResponse(data)) {
            this.challengeCookie = await this.createImunifyChallengeCookie();
            challengeRetried = true;
            continue;
          }

          throw new Error(
            `WooCommerce Store API returned a non-product response: ${this.describeUnexpectedResponse(data)}`
          );
        }

        if (data.length === 0) break;

        const products = data as WooProduct[];
        for (const product of products) {
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
        if (!challengeRetried && this.isPotentialImunifyError(error)) {
          this.challengeCookie = await this.createImunifyChallengeCookie();
          challengeRetried = true;
          continue;
        }

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

  private async fetchStoreApiPage(page: number) {
    const url = `${this.config.shopUrl}/wp-json/wc/store/v1/products`;
    const params: Record<string, string | number> = {
      per_page: 100,
      page,
    };
    if (this.config.categoryId) {
      params.category = this.config.categoryId;
    }

    return axios.get<WooProduct[] | unknown>(url, {
      params,
      timeout: 30000,
      headers: this.getRequestHeaders('application/json'),
    });
  }

  private async createImunifyChallengeCookie(): Promise<string> {
    const { data: html } = await axios.get<string>(this.config.shopUrl, {
      timeout: 30000,
      responseType: 'text',
      transformResponse: [(data) => data],
      headers: this.getRequestHeaders('text/html,application/xhtml+xml'),
    });

    const submission = this.extractImunifyChallengeSubmission(html);
    if (!submission) {
      throw new Error('WooCommerce Store API was blocked, and no Imunify challenge form was found.');
    }

    const challengeUrl = new URL(submission.action, this.config.shopUrl);
    for (const [key, value] of Object.entries(submission.params)) {
      challengeUrl.searchParams.append(key, String(value));
    }

    const response = await axios.get<string>(challengeUrl.toString(), {
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        ...this.getRequestHeaders('text/html,application/xhtml+xml'),
        Referer: this.config.shopUrl,
      },
    });

    const cookie = this.extractCookieHeader(response.headers['set-cookie']);
    if (!cookie) {
      throw new Error('Imunify challenge completed without returning a session cookie.');
    }

    return cookie;
  }

  private extractImunifyChallengeSubmission(html: string): ImunifyChallengeSubmission | null {
    if (!html.includes('Please wait while your request is being verified')) return null;

    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
    const challengeScript = scripts.at(-1)?.[1];
    if (!challengeScript) return null;

    let submission: ImunifyChallengeSubmission | null = null;

    interface ChallengeElement {
      tag: string;
      action?: unknown;
      name?: unknown;
      value?: unknown;
      children: ChallengeElement[];
      appendChild(child: ChallengeElement): void;
      submit(): void;
    }

    function createElement(tag: string): ChallengeElement {
      return {
        tag,
        children: [],
        appendChild(child: ChallengeElement) {
          this.children.push(child);
        },
        submit() {
          submission = {
            action: String(this.action),
            params: Object.fromEntries(
              this.children.map((child) => [
                String(child.name),
                String(child.value),
              ])
            ),
          };
        },
      };
    }

    function PluginArray() {}
    function MimeTypeArray() {}
    function Plugin() {}
    function MimeType() {}

    class FakeXMLHttpRequest {
      open(_method: string, requestUrl: string) {
        const [action, query = ''] = requestUrl.split('?');
        submission = {
          action,
          params: Object.fromEntries(new URLSearchParams(query)),
        };
      }

      send() {
        return undefined;
      }
    }

    const plugins: unknown[] = [];
    const mimeTypes: unknown[] = [];
    Object.setPrototypeOf(plugins, PluginArray.prototype);
    Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);

    const root = createElement('div');
    const document = {
      addEventListener(_event: string, callback: () => void) {
        callback();
      },
      attachEvent(_event: string, callback: () => void) {
        callback();
      },
      createElement,
      getElementById() {
        return root;
      },
    };
    const navigator = {
      userAgent: this.browserUserAgent,
      appVersion: '5.0',
      languages: ['en-US', 'en'],
      language: 'en-US',
      plugins,
      mimeTypes,
    };
    const window = {
      navigator,
      document,
      outerHeight: 900,
      outerWidth: 1200,
      addEventListener: true,
    };

    const context = createContext({
      window: { ...window, window },
      document,
      navigator,
      PluginArray,
      MimeTypeArray,
      Plugin,
      MimeType,
      URLSearchParams,
      XMLHttpRequest: FakeXMLHttpRequest,
      setTimeout: (callback: () => void) => callback(),
    });

    runInContext(challengeScript, context, { timeout: 1000 });
    return submission;
  }

  private extractCookieHeader(setCookie: string | string[] | undefined): string | null {
    if (!setCookie) return null;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies
      .map((cookie) => cookie.split(';')[0])
      .filter(Boolean)
      .join('; ') || null;
  }

  private getRequestHeaders(accept: string): Record<string, string> {
    return {
      Accept: accept,
      'User-Agent': this.browserUserAgent,
      ...(this.challengeCookie ? { Cookie: this.challengeCookie } : {}),
    };
  }

  private get browserUserAgent(): string {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
  }

  private isImunifyDeniedResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const message = 'message' in data ? String((data as { message?: unknown }).message) : '';
    return /Imunify360 bot-protection|Access denied/i.test(message);
  }

  private isPotentialImunifyError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 415) return true;
    if (typeof data === 'string') {
      return /One moment, please|Imunify360|Unsupported Media Type/i.test(data);
    }
    return this.isImunifyDeniedResponse(data);
  }

  private describeUnexpectedResponse(data: unknown): string {
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message?: unknown }).message);
    }
    return typeof data;
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
    const haystack = [
      product.name,
      ...categories,
      ...tags,
    ].join(' ').toLowerCase();
    const excludedCategoryKeywords = [
      'aksesuar',
      'barista aksesuar',
      'demleme araç',
      'ekipman',
      'filtre kağıdı',
      'filtre kagidi',
      'hediyelik',
      'kahve öğütücü',
      'kahve ogutucu',
      'kozmetik',
      'temizlik',
    ];
    const excludedTextFragments = [
      'ekme',
      'icilmeye hazir',
      'içilmeye hazır',
      'sise dahil',
      'şişe dahil',
      'toptan giris',
      'toptan giriş',
      'yesil kahve',
      'yeşil kahve',
    ];

    if (
      !isLikelyCatalogCoffeeProduct([
        product.name,
        ...categories,
        ...tags,
      ])
    ) {
      return false;
    }

    if (excludedTextFragments.some((fragment) => haystack.includes(fragment))) {
      return false;
    }

    if (
      categories.some((cat) =>
        excludedCategoryKeywords.some((kw) => cat.includes(kw))
      )
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
