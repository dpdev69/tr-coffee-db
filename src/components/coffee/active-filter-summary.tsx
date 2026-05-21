import Link from 'next/link';
import { getActiveCoffeeFilterChips } from '@/lib/coffee-filters';
import type { CoffeeFilters } from '@/lib/queries/coffees';

export function ActiveFilterSummary({
  filters,
  total,
}: {
  filters: CoffeeFilters;
  total: number;
}) {
  const activeFilterChips = getActiveCoffeeFilterChips(filters);
  const hasActiveFilters = activeFilterChips.length > 0;
  const processFilterHidesUnknown =
    filters.process?.some((process) => process !== 'unknown') &&
    !filters.process.includes('unknown');
  const roastFilterHidesUnknown =
    filters.roastLevel?.some((roastLevel) => roastLevel !== 'unknown') &&
    !filters.roastLevel.includes('unknown');
  const hidesUnclassifiedMetadata =
    processFilterHidesUnknown || roastFilterHidesUnknown;

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
          {hidesUnclassifiedMetadata && (
            <p className="mt-2 text-xs text-amber-800">
              İşleme veya kavrum bilgisi eksik kahveler bu filtrede gizlenir. Geniş sonuç için Belirtilmemiş seçeneğini de ekleyin.
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
          {activeFilterChips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.removeHref}
              scroll={false}
              aria-label={`${chip.label} filtresini kaldır`}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 py-0.5 pl-2 pr-1 text-xs font-medium text-stone-600 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              <span className="truncate">{chip.label}</span>
              <span
                aria-hidden="true"
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-sm leading-none text-stone-400 transition-colors group-hover:bg-amber-100 group-hover:text-amber-800"
              >
                ×
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
