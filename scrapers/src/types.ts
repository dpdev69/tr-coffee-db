// Raw product as extracted from any platform before normalization
export interface RawProduct {
  externalId: string;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  weightGrams: number | null;
  imageUrl: string | null;
  productUrl: string;
  isAvailable: boolean;
  variants?: RawVariant[];
  tags?: string[];
  brewRecipes?: BrewRecipe[];
  rawData?: Record<string, unknown>;
}

export interface RawVariant {
  id: string;
  title: string;
  price: number;
  weightGrams: number | null;
  isAvailable: boolean;
}

export interface BrewRecipe {
  method: string;
  dose_grams: number | null;
  water_grams: number | null;
  yield_grams: number | null;
  ratio: string | null;
  grind: string | null;
  water_temp_c: string | null;
  brew_time: string | null;
  steps: string[];
  note: string | null;
  source: 'product_page' | 'adapter';
  source_text: string;
}

// After normalization, ready for Supabase upsert
export interface NormalizedCoffee {
  external_id: string;
  name: string;
  name_normalized: string;
  origin_country: string | null;
  origin_region: string | null;
  origin_farm: string | null;
  origin_altitude: string | null;
  origin_producer: string | null;
  process: string;
  process_detail: string | null;
  roast_level: string;
  variety: string | null;
  harvest_year: string | null;
  roast_date: string | null;
  flavor_notes: string[];
  flavor_notes_normalized: string[];
  flavor_categories: string[];
  sca_score: number | null;
  price_amount: number | null;
  price_currency: string;
  weight_grams: number | null;
  price_per_100g: number | null;
  product_url: string;
  image_url: string | null;
  is_available: boolean;
  is_decaf: boolean;
  brew_methods: string[];
  brew_recipes: BrewRecipe[];
  specialty_status?: 'specialty' | 'not_specialty' | 'unclassified';
  specialty_score?: number;
  specialty_signals?: string[];
  specialty_rejection_reason?: string | null;
  is_public?: boolean;
}

export type Platform = 'shopify' | 'woocommerce' | 'ikas' | 'ticimax' | 'custom';

// Price format varies across platforms:
// - Shopify: string like "595.00" (TL)
// - WooCommerce Store API: string like "75000" (kuruş) or "520" (TL)
// We normalize ALL prices to TL (lira) in the normalization step.
export type PriceFormat = 'tl' | 'kurus';

export interface RoasterConfig {
  slug: string;
  name: string;
  websiteUrl: string;
  shopUrl: string;
  platform: Platform;
  city: string | null;
  /** false keeps the roaster registered but out of crawls and the catalog. configs.ts is the source of truth. */
  active?: boolean;
  /** 'relay': the shop refuses GitHub's network, so its requests go through our own Worker (shared/v2/relay.ts). See docs/crawl-relay.md. */
  runsFrom?: 'relay';
  priceFormat: PriceFormat;
  // Shopify-specific
  collectionHandle?: string;
  productTypeFilter?: string[];
  tagFilters?: string[];
  // HTML/structured-data product classification hints for stores whose coffee
  // products are named only by origin/lot and lack coffee category metadata.
  coffeeProductKeywords?: string[];
  trustedProductHosts?: string[];
  trustedImageHosts?: string[];
  // Selector-based stores often show the minimum package price on catalog cards.
  // When enabled, fetch each product page and choose the retail comparison pack.
  derivePackageFromProductPage?: boolean;
  deriveMetadataFromProductPage?: boolean;
  // WooCommerce-specific
  categoryId?: number;
  // Source-confirmed products outside the retail catalog whose category metadata is missing.
  excludedProductSlugs?: string[];
  // HTML scraping selectors (ikas, ticimax, custom)
  selectors?: {
    productList: string;
    productLink: string;
    productName: string;
    productPrice: string;
    productImage: string;
    description: string;
    nextPage?: string;
    unavailableText?: string;
  };
  structuredDataParser?: 'next-data-products' | 'probador-products' | 'parsa-catalog';
}
