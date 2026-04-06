import Link from 'next/link';
import { Tag } from '@/components/ui/tag';
import { getActiveCoffeeFilterLabels } from '@/lib/coffee-filters';
import type { CoffeeFilters } from '@/lib/queries/coffees';

export function ActiveFilterSummary({
  filters,
  total,
}: {
  filters: CoffeeFilters;
  total: number;
}) {
  const activeLabels = getActiveCoffeeFilterLabels(filters);
  const hasActiveFilters = activeLabels.length > 0;

  return (
    <section className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {total} kahve bulundu
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {hasActiveFilters
              ? 'Bu sonuçlar mevcut filtrelerinizi ve test tercihlerinizi yansıtıyor.'
              : 'Kataloğu daraltmak için filtreleri ya da testi kullanın.'}
          </p>
          {(filters.priceMin != null || filters.priceMax != null) && (
            <p className="mt-2 text-xs text-stone-500">
              Bütçe filtreleri, farklı paket boyutlarını adil biçimde karşılaştırmak için 100 g normalize fiyatı kullanır.
            </p>
          )}
        </div>

        {hasActiveFilters && (
          <Link
            href="/coffees"
            className="text-sm font-medium text-amber-700 transition-colors hover:text-amber-800"
          >
            Tümünü temizle
          </Link>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeLabels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </div>
      )}
    </section>
  );
}
