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
    <section className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:mb-6 sm:rounded-2xl sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {total} kahve bulundu
          </p>
          <p className="mt-1 hidden text-sm text-stone-500 sm:block">
            {hasActiveFilters
              ? 'Bu liste seçtiğiniz filtrelere ve test tercihlerinize göre daraltıldı.'
              : 'Kataloğu daraltmak için filtreleri kullanın ya da kısa testi çözün.'}
          </p>
          {(filters.priceMin != null || filters.priceMax != null) && (
            <p className="mt-2 text-xs text-stone-500">
              Bütçe filtresi, farklı paket boyutlarını aynı zeminde karşılaştırmak için 100 g fiyatını kullanır.
            </p>
          )}
        </div>

        {hasActiveFilters && (
          <Link
            href="/coffees"
            className="shrink-0 text-sm font-medium text-amber-700 transition-colors hover:text-amber-800"
          >
            Tümünü temizle
          </Link>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          {activeLabels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </div>
      )}
    </section>
  );
}
