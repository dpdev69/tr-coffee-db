import { supabase } from './supabase.js';
import { normalize } from './normalization/index.js';
import type { RoasterConfig, RawProduct, NormalizedCoffee } from './types.js';

export type ScrapeRunStatus = 'success' | 'failed';

export interface ScrapeRunResult {
  slug: string;
  status: ScrapeRunStatus;
  roasterId: string | null;
  productsFound: number;
  productsUpserted: number;
  durationMs: number;
  error?: string;
}

export abstract class BaseScraper {
  protected config: RoasterConfig;
  protected roasterId: string | null = null;

  constructor(config: RoasterConfig) {
    this.config = config;
  }

  // Platform-specific: override in each adapter
  abstract fetchProducts(): Promise<RawProduct[]>;

  async run(): Promise<ScrapeRunResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let status: ScrapeRunStatus = 'success';
    let productsFound = 0;
    let productsUpserted = 0;
    let errorMessage: string | null = null;

    try {
      // Resolve roaster ID
      this.roasterId = await this.resolveRoasterId();

      // 1. Fetch raw products
      console.log(`[${this.config.slug}] Fetching products...`);
      const rawProducts = await this.fetchProducts();
      productsFound = rawProducts.length;
      console.log(`[${this.config.slug}] Found ${productsFound} raw products`);

      if (productsFound === 0) {
        throw new Error(
          'Scrape returned zero products; preserving existing availability until the adapter is verified.'
        );
      }

      // 2. Normalize
      const normalized = rawProducts.map((raw) => normalize(raw));
      console.log(`[${this.config.slug}] Normalized ${normalized.length} products`);

      // 3. Upsert to Supabase
      productsUpserted = await this.upsertToSupabase(normalized);
      console.log(`[${this.config.slug}] Upserted ${productsUpserted} products`);

      // 4. Mark stale products as unavailable
      await this.markStaleProducts(startedAt);
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[${this.config.slug}] Error:`, errorMessage);
    }

    // Log the scrape
    const durationMs = Date.now() - startMs;
    const { error: logError } = await supabase.from('scrape_logs').insert({
      roaster_id: this.roasterId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status,
      products_found: productsFound,
      products_upserted: productsUpserted,
      error_message: errorMessage,
      duration_ms: durationMs,
    });

    if (logError) {
      const message = `Failed to write scrape log: ${logError.message}`;
      console.error(`[${this.config.slug}] ${message}`);
      if (errorMessage) {
        throw new Error(`${errorMessage}; ${message}`);
      }
      throw new Error(message);
    }

    console.log(
      `[${this.config.slug}] Done in ${durationMs}ms (${status})`
    );

    return {
      slug: this.config.slug,
      status,
      roasterId: this.roasterId,
      productsFound,
      productsUpserted,
      durationMs,
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  }

  private async resolveRoasterId(): Promise<string> {
    const { data, error } = await supabase
      .from('roasters')
      .select('id')
      .eq('slug', this.config.slug)
      .single();

    if (error || !data) {
      throw new Error(
        `Roaster "${this.config.slug}" not found in database. Run seed first.`
      );
    }
    return data.id;
  }

  private async upsertToSupabase(
    products: NormalizedCoffee[]
  ): Promise<number> {
    if (!this.roasterId || products.length === 0) return 0;

    const rows = products.map((p) => ({
      roaster_id: this.roasterId,
      slug: this.makeSlug(p.name, this.config.slug),
      external_id: p.external_id,
      name: p.name,
      name_normalized: p.name_normalized,
      origin_country: p.origin_country,
      origin_region: p.origin_region,
      origin_farm: p.origin_farm,
      origin_altitude: p.origin_altitude,
      origin_producer: p.origin_producer,
      process: p.process,
      process_detail: p.process_detail,
      roast_level: p.roast_level,
      variety: p.variety,
      harvest_year: p.harvest_year,
      roast_date: p.roast_date,
      flavor_notes: p.flavor_notes,
      flavor_notes_normalized: p.flavor_notes_normalized,
      flavor_categories: p.flavor_categories,
      sca_score: p.sca_score,
      price_amount: p.price_amount,
      price_currency: p.price_currency,
      weight_grams: p.weight_grams,
      price_per_100g: p.price_per_100g,
      product_url: p.product_url,
      image_url: p.image_url,
      is_available: p.is_available,
      is_decaf: p.is_decaf,
      brew_methods: p.brew_methods,
      brew_recipes: p.brew_recipes,
      last_scraped_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }));

    const { error, count } = await supabase
      .from('coffees')
      .upsert(rows, { onConflict: 'roaster_id,external_id' })
      .select();

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    return count ?? rows.length;
  }

  private async markStaleProducts(scrapeStartedAt: string): Promise<void> {
    if (!this.roasterId) return;

    const { error } = await supabase
      .from('coffees')
      .update({ is_available: false })
      .eq('roaster_id', this.roasterId)
      .eq('is_available', true)
      .lt('last_scraped_at', scrapeStartedAt);

    if (error) {
      console.warn(
        `[${this.config.slug}] Failed to mark stale products:`,
        error.message
      );
    }
  }

  private makeSlug(name: string, roasterSlug: string): string {
    const base = `${roasterSlug}-${name}`
      .toLowerCase()
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return base.slice(0, 120);
  }
}
