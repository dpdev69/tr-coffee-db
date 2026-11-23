import { canonicalizeUrl } from '../identity';
import type { CoffeeEvent, Json } from '../types';
import type { CatalogOffer, CoffeeRow, EventRow } from './types';
import { parseJson } from './util';

export function eventFromRow(row: EventRow): CoffeeEvent {
  return {
    id: row.id,
    coffeeId: row.coffee_id,
    offerId: row.offer_id,
    type: row.type,
    createdAt: row.created_at,
    before: parseJson<Json>(row.before_json, null),
    after: parseJson<Json>(row.after_json, null),
    idempotencyKey: row.idempotency_key,
    observationId: row.observation_id,
  };
}

export function trustedSourceUrl(row: CoffeeRow): string | null {
  const hosts = parseJson<string[]>(row.trusted_hosts_json, []);
  if (!hosts.length) return null;
  try {
    return canonicalizeUrl(row.canonical_url, hosts);
  } catch {
    return null;
  }
}

/** "Koyu 2.5KG" → "Koyu"; a name that is only a size stays as it is. */
export function withoutTrailingSize(name: string): string {
  return name.replace(/[\s,/|(–—-]*\d+(?:[.,]\d+)?\s*(?:kg|kilo|gr|gram|g)\b\.?\)?$/iu, '').trim() || name;
}

/** Rows arrive in display order (in stock, cheapest first); the first variant of each package keeps its purchase link. */
export function collapsePackages(offers: CatalogOffer[]): CatalogOffer[] {
  const packages = new Map<string, CatalogOffer>();
  for (const offer of offers) {
    const key = [offer.weightG, offer.priceMinor, offer.currency, offer.inStock].join('|');
    const existing = packages.get(key);
    if (!existing) {
      packages.set(key, offer);
      continue;
    }
    // The variant label (grind/roast option) no longer describes the merged package; the weight does.
    packages.set(key, { ...existing, label: null, variantOfferIds: [...existing.variantOfferIds, offer.id] });
  }
  return [...packages.values()];
}
