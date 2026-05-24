import { supabase } from './supabase.js';
import { normalize } from './normalization/index.js';
import type { RoasterConfig, RawProduct, NormalizedCoffee } from './types.js';
import {
  classifySpecialtyProduct,
  type SpecialtyOverride,
} from './specialty-classification.js';

export type ScrapeRunStatus = 'success' | 'failed';

export interface ScrapeRunResult {
  slug: string;
  status: ScrapeRunStatus;
  roasterId: string | null;
  productsFound: number;
  productsUpserted: number;
  specialtyQualified: number;
  specialtyRejected: number;
  specialtyUnclassified: number;
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
    let specialtyQualified = 0;
    let specialtyRejected = 0;
    let specialtyUnclassified = 0;
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

      // 2. Normalize and classify specialty suitability
      const specialtyOverrides = await this.loadSpecialtyOverrides();
      const normalized = rawProducts.map((raw) => {
        const coffee = normalize(raw);
        const classification = classifySpecialtyProduct({
          raw,
          normalized: coffee,
          roasterId: this.roasterId,
          override: specialtyOverrides.get(coffee.external_id),
        });

        if (classification.specialty_status === 'specialty') specialtyQualified += 1;
        if (classification.specialty_status === 'not_specialty') specialtyRejected += 1;
        if (classification.specialty_status === 'unclassified') specialtyUnclassified += 1;

        return { ...coffee, ...classification };
      });
      console.log(`[${this.config.slug}] Normalized ${normalized.length} products`);
      console.log(
        `[${this.config.slug}] Specialty classification: ${specialtyQualified} qualified, ${specialtyRejected} rejected, ${specialtyUnclassified} unclassified`
      );

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
      specialty_qualified: specialtyQualified,
      specialty_rejected: specialtyRejected,
      specialty_unclassified: specialtyUnclassified,
      error_message: errorMessage,
      duration_ms: durationMs,
    });

    if (logError) {
      if (!this.isMissingSpecialtySchemaError(logError.message)) {
        const message = `Failed to write scrape log: ${logError.message}`;
        console.error(`[${this.config.slug}] ${message}`);
        if (errorMessage) {
          throw new Error(`${errorMessage}; ${message}`);
        }
        throw new Error(message);
      }

      const retryError = await this.writeScrapeLogWithoutSpecialtyCounts({
        roaster_id: this.roasterId,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        status,
        products_found: productsFound,
        products_upserted: productsUpserted,
        error_message: errorMessage,
        duration_ms: durationMs,
      });

      if (retryError) {
        const message = `Failed to write scrape log: ${logError.message}`;
        console.error(`[${this.config.slug}] ${message}`);
        if (errorMessage) {
          throw new Error(`${errorMessage}; ${message}`);
        }
        throw new Error(message);
      }
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
      specialtyQualified,
      specialtyRejected,
      specialtyUnclassified,
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

    const existingMetadata = await this.loadExistingCoffeeMetadata(
      products.map((product) => product.external_id)
    );

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
      process: this.preserveKnownEnum(p.process, existingMetadata.get(p.external_id)?.process),
      process_detail:
        p.process !== 'unknown'
          ? p.process_detail
          : existingMetadata.get(p.external_id)?.process_detail ?? p.process_detail,
      roast_level: this.preserveKnownEnum(
        p.roast_level,
        existingMetadata.get(p.external_id)?.roast_level
      ),
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
      specialty_status: p.specialty_status,
      specialty_score: p.specialty_score,
      specialty_signals: p.specialty_signals,
      specialty_rejection_reason: p.specialty_rejection_reason,
      is_public: p.is_public,
      last_scraped_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }));

    const { error, count } = await supabase
      .from('coffees')
      .upsert(rows, { onConflict: 'roaster_id,external_id' })
      .select();

    if (error) {
      if (this.isMissingSpecialtySchemaError(error.message)) {
        console.warn(
          `[${this.config.slug}] Specialty columns are not available yet; retrying coffee upsert without specialty fields.`
        );
        return this.upsertRowsWithoutSpecialtyFields(rows);
      }

      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    return count ?? rows.length;
  }

  private async loadExistingCoffeeMetadata(externalIds: string[]) {
    const metadata = new Map<
      string,
      {
        process: string | null;
        process_detail: string | null;
        roast_level: string | null;
      }
    >();

    if (!this.roasterId || externalIds.length === 0) return metadata;

    const uniqueExternalIds = Array.from(new Set(externalIds));
    const pageSize = 200;

    for (let index = 0; index < uniqueExternalIds.length; index += pageSize) {
      const batch = uniqueExternalIds.slice(index, index + pageSize);
      const { data, error } = await supabase
        .from('coffees')
        .select('external_id, process, process_detail, roast_level')
        .eq('roaster_id', this.roasterId)
        .in('external_id', batch);

      if (error) {
        console.warn(
          `[${this.config.slug}] Failed to load existing coffee metadata:`,
          error.message
        );
        continue;
      }

      for (const row of data ?? []) {
        if (row.external_id) {
          metadata.set(row.external_id, {
            process: row.process,
            process_detail: row.process_detail,
            roast_level: row.roast_level,
          });
        }
      }
    }

    return metadata;
  }

  private preserveKnownEnum(nextValue: string, existingValue: string | null | undefined) {
    if (nextValue !== 'unknown') return nextValue;
    if (existingValue && existingValue !== 'unknown') return existingValue;
    return nextValue;
  }

  private async loadSpecialtyOverrides(): Promise<Map<string, SpecialtyOverride>> {
    if (!this.roasterId) return new Map();

    const { data, error } = await supabase
      .from('coffee_specialty_overrides')
      .select('roaster_id,external_id,override_action,reason')
      .eq('roaster_id', this.roasterId);

    if (error) {
      if (this.isMissingSpecialtySchemaError(error.message)) {
        console.warn(
          `[${this.config.slug}] Specialty override table is not available yet; continuing without overrides.`
        );
        return new Map();
      }
      throw new Error(`Failed to load specialty overrides: ${error.message}`);
    }

    const overrides = new Map<string, SpecialtyOverride>();
    for (const row of data ?? []) {
      if (
        row &&
        typeof row.external_id === 'string' &&
        (row.override_action === 'force_include' || row.override_action === 'force_exclude')
      ) {
        overrides.set(row.external_id, row as SpecialtyOverride);
      }
    }

    return overrides;
  }

  private async upsertRowsWithoutSpecialtyFields(
    rows: Array<Record<string, unknown>>
  ): Promise<number> {
    const fallbackRows = rows.map((row) => {
      const fallbackRow = { ...row };
      delete fallbackRow.specialty_status;
      delete fallbackRow.specialty_score;
      delete fallbackRow.specialty_signals;
      delete fallbackRow.specialty_rejection_reason;
      delete fallbackRow.is_public;
      return fallbackRow;
    });

    const { error, count } = await supabase
      .from('coffees')
      .upsert(fallbackRows, { onConflict: 'roaster_id,external_id' })
      .select();

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    return count ?? fallbackRows.length;
  }

  private async writeScrapeLogWithoutSpecialtyCounts(
    row: Record<string, unknown>
  ): Promise<unknown | null> {
    const { error } = await supabase.from('scrape_logs').insert(row);
    return error ?? null;
  }

  private isMissingSpecialtySchemaError(message: string): boolean {
    return (
      /specialty_|is_public|coffee_specialty_overrides/i.test(message) &&
      /schema cache|could not find|does not exist|not find|column .* does not exist|relation .* does not exist/i.test(message)
    );
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
