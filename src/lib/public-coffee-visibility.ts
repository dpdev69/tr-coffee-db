import { getCurrentCatalogCutoffIso } from '@/lib/catalog-rules';

export const PUBLIC_COFFEE_SPECIALTY_STATUS = 'specialty';

export const PUBLIC_COFFEE_VISIBILITY = {
  isPublicColumn: 'is_public',
  specialtyStatusColumn: 'specialty_status',
  isAvailableColumn: 'is_available',
  freshnessColumn: 'last_seen_at',
} as const;

type PublicCoffeeVisibilityQuery<TSelf> = {
  eq(column: string, value: unknown): TSelf;
  gte(column: string, value: string): TSelf;
};

type PublicCoffeeCandidate = {
  is_public?: boolean | null;
  specialty_status?: string | null;
};

export function isPublicCoffee(coffee: PublicCoffeeCandidate) {
  return (
    coffee.is_public === true &&
    coffee.specialty_status === PUBLIC_COFFEE_SPECIALTY_STATUS
  );
}

export function applyPublicCoffeeVisibility<T extends PublicCoffeeVisibilityQuery<T>>(
  query: T,
  currentCutoff = getCurrentCatalogCutoffIso()
): T {
  return query
    .eq(PUBLIC_COFFEE_VISIBILITY.isPublicColumn, true)
    .eq(PUBLIC_COFFEE_VISIBILITY.specialtyStatusColumn, PUBLIC_COFFEE_SPECIALTY_STATUS)
    .eq(PUBLIC_COFFEE_VISIBILITY.isAvailableColumn, true)
    .gte(PUBLIC_COFFEE_VISIBILITY.freshnessColumn, currentCutoff);
}
