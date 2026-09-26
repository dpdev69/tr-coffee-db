import type { RawProduct, RoasterConfig } from '../types.js';
import type { SourceCrawl } from './types.js';
import { canonicalUrl } from './primitives.js';

export interface ComparisonDifference {
  identity: string;
  kind: 'only_legacy' | 'only_v2' | 'identity_change' | 'price' | 'stock' | 'offer_comparison_ambiguous';
  legacy: unknown;
  v2: unknown;
}
/** Compare caller-provided snapshots. Never runs a legacy scraper or writes either DB. */
export function compareSnapshots(legacy: RawProduct[], next: SourceCrawl, config: RoasterConfig) {
  const differences: ComparisonDifference[] = [];
  const seen = new Set<number>();
  for (const old of legacy) {
    const oldUrl = canonicalUrl(old.productUrl, config);
    const index = next.products.findIndex(product => product.sourceProductId === old.externalId || product.canonicalUrl === oldUrl);
    if (index < 0) {
      differences.push({ identity: old.externalId, kind: 'only_legacy', legacy: old.productUrl, v2: null });
      continue;
    }
    const current = next.products[index];
    seen.add(index);
    if (current.sourceProductId !== old.externalId) differences.push({ identity: old.externalId, kind: 'identity_change', legacy: old.externalId, v2: current.sourceProductId });
    const candidates = old.weightGrams != null ? current.offers.filter(offer => offer.weightG === old.weightGrams && offer.currency === old.currency) : [];
    // Legacy selected-SKU IDs were not persisted. Equal weight alone cannot prove the same SKU.
    const exact = candidates.filter(offer => old.variants?.some(variant => variant.id === offer.sourceVariantId && variant.price === old.price && variant.weightGrams === old.weightGrams));
    if (exact.length !== 1) {
      differences.push({ identity: old.externalId, kind: 'offer_comparison_ambiguous', legacy: { price: old.price, weightG: old.weightGrams }, v2: candidates.map(offer => ({ id: offer.sourceVariantId, price: offer.price, weightG: offer.weightG })) });
      continue;
    }
    if (exact[0].price !== old.price) differences.push({ identity: old.externalId, kind: 'price', legacy: old.price, v2: exact[0].price });
    if (exact[0].inStock !== old.isAvailable) differences.push({ identity: old.externalId, kind: 'stock', legacy: old.isAvailable, v2: exact[0].inStock });
  }
  next.products.forEach((product, index) => {
    if (!seen.has(index)) differences.push({ identity: product.sourceProductId ?? product.canonicalUrl, kind: 'only_v2', legacy: null, v2: product.canonicalUrl });
  });
  return { roasterSlug: config.slug, v2Complete: next.complete, legacyProducts: legacy.length, v2Products: next.products.length,
    v2Offers: next.products.reduce((sum, product) => sum + product.offers.length, 0), differences,
    caveat: 'Snapshot differences need source review. Legacy collapsed prices are not historical same-SKU observations.' };
}
