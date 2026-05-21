import type { Coffee } from '@/lib/types/database';

export type CoffeeConfidenceStatus =
  | 'verified'
  | 'recent'
  | 'partial'
  | 'stale'
  | 'unavailable';

export interface LatestRoasterScrapeStatus {
  status: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  products_found?: number | null;
  products_upserted?: number | null;
  error_message?: string | null;
}

export interface CoffeeConfidenceOptions {
  now?: Date | string | number;
  verifiedWithinHours?: number;
  recentWithinDays?: number;
  staleAfterDays?: number;
}

export interface CoffeeConfidence {
  status: CoffeeConfidenceStatus;
  checkedAt: string | null;
  isFresh: boolean;
  isComplete: boolean;
  latestScrapeStatus: string | null;
  reasons: string[];
}

const DEFAULT_RECENT_WITHIN_DAYS = 7;
const DEFAULT_STALE_AFTER_DAYS = 21;
const DEFAULT_VERIFIED_WITHIN_HOURS = 72;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SUCCESS_SCRAPE_STATUSES = new Set(['success', 'succeeded', 'completed']);
const FAILED_SCRAPE_STATUSES = new Set(['failed', 'error', 'errored']);
const PARTIAL_SCRAPE_STATUSES = new Set(['partial', 'degraded']);

export function deriveCoffeeConfidence(
  coffee: Pick<
    Coffee,
    | 'is_available'
    | 'origin_country'
    | 'process'
    | 'roast_level'
    | 'price_per_100g'
    | 'last_scraped_at'
    | 'last_seen_at'
  >,
  latestRoasterScrape?: LatestRoasterScrapeStatus | null,
  options: CoffeeConfidenceOptions = {}
): CoffeeConfidence {
  const now = toDate(options.now) ?? new Date();
  const verifiedWithinHours = options.verifiedWithinHours ?? DEFAULT_VERIFIED_WITHIN_HOURS;
  const recentWithinDays = options.recentWithinDays ?? DEFAULT_RECENT_WITHIN_DAYS;
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const coffeeCheckedAt = coffee.last_seen_at ?? coffee.last_scraped_at ?? null;
  const latestScrapeCheckedAt =
    latestRoasterScrape?.completed_at ?? latestRoasterScrape?.started_at ?? null;
  const checkedAt = coffeeCheckedAt ?? latestScrapeCheckedAt;
  const checkedDate = toDate(checkedAt);
  const ageMs = checkedDate ? now.getTime() - checkedDate.getTime() : null;
  const ageDays = ageMs != null ? ageMs / DAY_MS : null;
  const scrapeStatus = latestRoasterScrape?.status?.toLowerCase() ?? null;
  const isVerifiedFresh =
    ageMs != null && ageMs >= 0 && ageMs <= verifiedWithinHours * HOUR_MS;
  const isFresh = ageDays != null && ageDays <= recentWithinDays;
  const isStale = ageDays == null || ageDays > staleAfterDays;
  const isComplete = hasCoreMetadata(coffee);
  const reasons: string[] = [];

  if (!coffee.is_available) {
    reasons.push('coffee_unavailable');
    return confidence('unavailable', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
  }

  if (!checkedDate) {
    reasons.push('missing_freshness_timestamp');
  } else if (isStale) {
    reasons.push('freshness_timestamp_stale');
  } else if (isFresh) {
    reasons.push('freshness_timestamp_recent');
  }

  if (!isComplete) {
    reasons.push('metadata_incomplete');
  }

  if (scrapeStatus && SUCCESS_SCRAPE_STATUSES.has(scrapeStatus)) {
    reasons.push('latest_roaster_scrape_success');
  } else if (scrapeStatus && FAILED_SCRAPE_STATUSES.has(scrapeStatus)) {
    reasons.push('latest_roaster_scrape_failed');
  } else if (scrapeStatus && PARTIAL_SCRAPE_STATUSES.has(scrapeStatus)) {
    reasons.push('latest_roaster_scrape_partial');
  }

  if (latestRoasterScrape && (latestRoasterScrape.products_found ?? 1) === 0) {
    reasons.push('latest_roaster_scrape_found_no_products');
  }

  if (scrapeStatus && FAILED_SCRAPE_STATUSES.has(scrapeStatus) && !checkedDate) {
    return confidence('unavailable', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
  }

  if (isStale || (scrapeStatus && FAILED_SCRAPE_STATUSES.has(scrapeStatus) && !isFresh)) {
    return confidence('stale', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
  }

  if (
    !isComplete ||
    (scrapeStatus && PARTIAL_SCRAPE_STATUSES.has(scrapeStatus)) ||
    (scrapeStatus && FAILED_SCRAPE_STATUSES.has(scrapeStatus)) ||
    (latestRoasterScrape && (latestRoasterScrape.products_found ?? 1) === 0)
  ) {
    return confidence('partial', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
  }

  if (scrapeStatus && SUCCESS_SCRAPE_STATUSES.has(scrapeStatus) && isVerifiedFresh) {
    return confidence('verified', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
  }

  return confidence('recent', checkedAt, isFresh, isComplete, scrapeStatus, reasons);
}

function confidence(
  status: CoffeeConfidenceStatus,
  checkedAt: string | null,
  isFresh: boolean,
  isComplete: boolean,
  latestScrapeStatus: string | null,
  reasons: string[]
): CoffeeConfidence {
  return {
    status,
    checkedAt,
    isFresh,
    isComplete,
    latestScrapeStatus,
    reasons,
  };
}

function hasCoreMetadata(
  coffee: Pick<Coffee, 'origin_country' | 'process' | 'roast_level' | 'price_per_100g'>
) {
  return Boolean(
    coffee.origin_country &&
      coffee.process &&
      coffee.roast_level &&
      coffee.price_per_100g != null
  );
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
