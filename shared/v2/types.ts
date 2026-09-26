/** Source observations only: inferred values belong in FeatureValue. Money is TRY lira at intake. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Stock = boolean | null;
export type CrawlStatus = 'success' | 'partial' | 'failed';
export type EventType = 'NEW' | 'PRICE_DROP' | 'RESTOCKED' | 'DEAL' | 'OUT_OF_STOCK';
export interface RawMetadata {
  /** Explicit source-declared SCA score; never the catalog eligibility or matching score. */
  scaScore?: number | null;
  description?: string | null;
  country?: string | null;
  region?: string | null;
  producer?: string | null;
  farm?: string | null;
  altitude?: string | null;
  varieties?: string[];
  process?: string | null;
  tastingNotes?: string[];
  roast?: string | null;
  decaf?: boolean | null;
  harvestYear?: string | null;
  roastDate?: string | null;
  imageUrl?: string | null;
  brewRecipes?: Json[];
  sourceData?: Json;
}
export interface SourceOffer {
  sourceVariantId: string | null;
  label: string | null;
  weightG: number | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  inStock: Stock;
  purchaseUrl: string;
  /** Required only for a source lacking stable SKU IDs; e.g. canonical option values. Never a title/price guess. */
  identityKey?: string;
}
export interface FeatureValue {
  feature: string;
  value: Json;
  sourceType: 'ROASTER_DECLARED' | 'RULE_INFERRED' | 'MANUAL';
  confidence: number | null;
  version: string;
  sourceReference?: string | null;
}
export interface SourceCoffee {
  sourceProductId: string | null;
  canonicalUrl: string;
  name: string;
  rawMetadata: RawMetadata;
  offers: SourceOffer[];
  /** Source explicitly declares no purchasable variants; absence alone is insufficient. */
  unavailable?: boolean;
  features?: FeatureValue[];
  /** Catalog suitability is separate from objective source metadata. Unknown is hidden pending review. */
  visibility?: 'public' | 'hidden' | 'unclassified';
}
export interface CrawlDiagnostic { stage: string; code: string; message: string; context?: Json }
export interface CrawlInput {
  id: string;
  /** Stable scheduled job identity across delivery attempts; at most one successful attempt can commit. */
  jobKey?: string;
  roasterId: string;
  startedAt: string;
  completedAt: string;
  status: CrawlStatus;
  parserVersion: string;
  products: SourceCoffee[];
  diagnostics: CrawlDiagnostic[];
  mode?: 'live' | 'baseline' | 'import';
}
export interface RoasterInput {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  adapter: string;
  city?: string | null;
  active?: boolean;
  trustedHosts?: string[];
}
export interface PriceObservation {
  id: string;
  offerId: string;
  crawlRunId: string;
  observedAt: string;
  priceMinor: number | null;
  compareAtMinor: number | null;
  weightG: number | null;
  currency: string | null;
  inStock: Stock;
  /** Only complete successful crawls supply event evidence. Import is not a successful source crawl. */
  source: 'crawl' | 'import';
}
export interface CoffeeEvent {
  id: string;
  coffeeId: string;
  offerId: string | null;
  type: EventType;
  createdAt: string;
  before: Json;
  after: Json;
  idempotencyKey: string;
  observationId: string | null;
}
