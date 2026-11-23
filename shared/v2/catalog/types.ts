import type { CoffeeEvent, FeatureValue, RawMetadata } from '../types';

export interface CatalogOffer {
  id: string;
  coffeeId: string;
  sourceVariantId: string | null;
  label: string | null;
  weightG: number | null;
  currency: string | null;
  priceMinor: number | null;
  compareAtMinor: number | null;
  inStock: boolean | null;
  purchaseUrl: string | null;
  unitPriceTry: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPriceChangeAt: string | null;
  /** Grind/roast variants with the same weight, price and stock collapse into one package; their ids stay here for event lookup. */
  variantOfferIds: string[];
}

export interface CatalogCoffee {
  id: string;
  name: string;
  slug: string;
  canonicalUrl: string;
  sourceUrl: string | null;
  sourceProductId: string | null;
  roaster: { id: string; slug: string; name: string; websiteUrl: string; city: string | null };
  rawMetadata: RawMetadata;
  features: FeatureValue[];
  offers: CatalogOffer[];
  latestEvents: CoffeeEvent[];
  firstSeenAt: string;
  lastSeenAt: string;
  discontinuedAt: string | null;
  stale: boolean;
}

export interface CatalogFilters {
  origin?: string[];
  process?: string[];
  taste?: string[];
  roaster?: string[];
  priceMin?: number;
  priceMax?: number;
  search?: string;
  farm?: string;
  producer?: string;
  variety?: string;
  roast?: string[];
  brewMethod?: string[];
  altitude?: string;
  traceability?: 'available' | 'missing';
  event?: CoffeeEvent['type'];
  since?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'unit_price_asc';
  page?: number;
  perPage?: number;
}

export interface CatalogRoaster {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  city: string | null;
  adapter: string;
  coffeeCount: number;
  offerCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  crawlHealth: string;
}

export interface CoffeeRow {
  id: string;
  roaster_id: string;
  source_product_id: string | null;
  canonical_url: string;
  name: string;
  slug: string;
  raw_metadata_json: string;
  first_seen_at: string;
  last_seen_at: string;
  discontinued_at: string | null;
  roaster_slug: string;
  roaster_name: string;
  website_url: string;
  city: string | null;
  trusted_hosts_json: string;
}

/** Internal to the catalog modules; not re-exported by shared/v2/catalog.ts. */
export interface OfferRow {
  id: string;
  coffee_id: string;
  source_variant_id: string | null;
  label: string | null;
  weight_g: number | null;
  currency: string | null;
  current_price_minor: number | null;
  compare_at_price_minor: number | null;
  in_stock: number | null;
  purchase_url: string;
  first_seen_at: string;
  last_seen_at: string;
  last_price_change_at: string | null;
}

/** Internal to the catalog modules; not re-exported by shared/v2/catalog.ts. */
export interface FeatureRow {
  coffee_id: string;
  feature: string;
  value_json: string;
  source_type: FeatureValue['sourceType'];
  confidence: number | null;
  version: string;
  source_reference: string | null;
}

/** Internal to the catalog modules; not re-exported by shared/v2/catalog.ts. */
export interface EventRow {
  id: string;
  coffee_id: string;
  offer_id: string | null;
  type: CoffeeEvent['type'];
  created_at: string;
  before_json: string;
  after_json: string;
  idempotency_key: string;
  observation_id: string | null;
}
