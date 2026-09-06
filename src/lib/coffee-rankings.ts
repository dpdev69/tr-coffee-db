import { getCurrentCatalogCutoffIso } from '@/lib/catalog-rules';
import { calculateTraceabilityScore } from '@/lib/coffee-journey';
import { applyPublicCatalogCoffeeVisibility } from '@/lib/queries/coffees';
import { createClient } from '@/lib/supabase/server';
import type { CoffeeLot, CoffeeWithRoaster, ValidationStatus } from '@/lib/types/database';

export interface RankedCoffee extends CoffeeWithRoaster {
  traceabilityScore: number;
  lotValidationStatus: ValidationStatus;
}

export interface CoffeeRankings {
  traceability: RankedCoffee[];
  qualityEvidence: RankedCoffee[];
  accessiblePrice: RankedCoffee[];
  marketInterest: RankedCoffee[];
}

type CoffeeWithLot = CoffeeWithRoaster & {
  coffee_lots?: Pick<CoffeeLot, 'traceability_score' | 'validation_status'> | null;
};

export async function getCoffeeRankings(limit = 8): Promise<CoffeeRankings> {
  const supabase = await createClient();
  const cutoff = getCurrentCatalogCutoffIso();
  const pageSize = 1000;
  const rows: CoffeeWithLot[] = [];
  let useFallback = false;

  for (let from = 0; ; from += pageSize) {
    let enrichedQuery = supabase
      .from('coffees')
      .select(
        '*, roasters!inner(name, slug, city), coffee_lots(traceability_score, validation_status)'
      );
    enrichedQuery = applyPublicCatalogCoffeeVisibility(enrichedQuery, cutoff);
    const result = await enrichedQuery.range(from, from + pageSize - 1);

    if (result.error) {
      useFallback = true;
      break;
    }

    const page = (result.data ?? []) as unknown as CoffeeWithLot[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  if (useFallback) {
    console.info('Lot ranking fields unavailable; calculating rankings from catalog metadata', {
      message: 'coffee_lots relationship is unavailable',
    });

    rows.length = 0;
    for (let from = 0; ; from += pageSize) {
      let fallbackQuery = supabase
        .from('coffees')
        .select('*, roasters!inner(name, slug, city)');
      fallbackQuery = applyPublicCatalogCoffeeVisibility(fallbackQuery, cutoff);
      const result = await fallbackQuery.range(from, from + pageSize - 1);
      if (result.error) throw result.error;

      const page = (result.data ?? []) as CoffeeWithLot[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }

  return rankCoffees(rows, limit);
}

export function rankCoffees(rows: CoffeeWithLot[], limit = 8): CoffeeRankings {
  const ranked = rows.map<RankedCoffee>((coffee) => ({
    ...coffee,
    traceabilityScore:
      coffee.coffee_lots?.traceability_score ?? calculateTraceabilityScore(coffee),
    lotValidationStatus: coffee.coffee_lots?.validation_status ?? 'observed',
  }));

  return {
    traceability: [...ranked]
      .sort((a, b) =>
        b.traceabilityScore - a.traceabilityScore ||
        (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '')
      )
      .slice(0, limit),
    qualityEvidence: ranked
      .filter((coffee) => coffee.sca_score != null)
      .sort((a, b) =>
        (b.sca_score ?? 0) - (a.sca_score ?? 0) ||
        b.traceabilityScore - a.traceabilityScore
      )
      .slice(0, limit),
    accessiblePrice: ranked
      .filter(
        (coffee) =>
          coffee.price_per_100g != null &&
          coffee.price_per_100g > 0 &&
          coffee.traceabilityScore >= 40
      )
      .sort((a, b) =>
        (a.price_per_100g ?? Number.POSITIVE_INFINITY) -
          (b.price_per_100g ?? Number.POSITIVE_INFINITY) ||
        b.traceabilityScore - a.traceabilityScore
      )
      .slice(0, limit),
    marketInterest: ranked
      .filter((coffee) => Number.isFinite(coffee.click_count) && coffee.click_count > 0)
      .sort((a, b) =>
        b.click_count - a.click_count || b.traceabilityScore - a.traceabilityScore
      )
      .slice(0, limit),
  };
}
