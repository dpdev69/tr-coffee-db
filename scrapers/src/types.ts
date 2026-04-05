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
  rawData?: Record<string, unknown>;
}

export interface RawVariant {
  id: string;
  title: string;
  price: number;
  weightGrams: number | null;
  isAvailable: boolean;
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
  city: string;
  priceFormat: PriceFormat;
  // Shopify-specific
  collectionHandle?: string;
  productTypeFilter?: string[];
  tagFilters?: string[];
  // WooCommerce-specific
  categoryId?: number;
  // HTML scraping selectors (ikas, ticimax, custom)
  selectors?: {
    productList: string;
    productLink: string;
    productName: string;
    productPrice: string;
    productImage: string;
    description: string;
    nextPage?: string;
  };
}
