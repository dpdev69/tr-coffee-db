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

  return (
    <section className="mb-4 rounded-2xl border border-[#1f1d1b]/10 bg-white p-3 sm:mb-6 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f1d1b]">
            {total} kahve bulundu
          </p>
          <p className="mt-1 hidden text-sm text-[#5d5853] sm:block">
            {hasActiveFilters
              ? 'Bu liste seçtiğiniz filtrelere ve tercihlerinize göre daraltıldı.'
              : 'Katalog stokta görünen, yayına açık specialty kahvelerle sınırlıdır.'}
          </p>
        </div>

        {hasActiveFilters && (
          <Link
            href="/coffees"
            className="shrink-0 text-sm font-semibold text-[#1f1d1b] underline-offset-4 transition-colors hover:underline"
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
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#1f1d1b]/10 bg-[#f6f1e8] py-0.5 pl-2 pr-1 text-xs font-medium text-[#1f1d1b]/75 transition-colors hover:bg-[#ecff64] hover:text-[#1f1d1b] focus:outline-none focus:ring-2 focus:ring-[#1f1d1b] focus:ring-offset-2"
            >
              <span className="truncate">{chip.label}</span>
              <span
                aria-hidden="true"
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-sm leading-none text-[#1f1d1b]/45 transition-colors group-hover:bg-white group-hover:text-[#1f1d1b]"
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
