'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BREW_METHOD_LABELS,
  PROCESS_LABELS,
  ROAST_LABELS,
  FLAVOR_CATEGORIES,
  FLAVOR_CATEGORY_LABELS,
  SORT_OPTIONS,
} from '@/lib/constants/filter-options';

export function SidebarFilters({
  countries,
  roasters,
}: {
  countries: string[];
  roasters: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.getAll(key);

      if (current.includes(value)) {
        params.delete(key);
        current.filter((v) => v !== value).forEach((v) => params.append(key, v));
      } else {
        params.append(key, value);
      }

      params.delete('page');
      pushParams(params);
    },
    [pushParams, searchParams]
  );

  const setSort = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'newest') {
        params.delete('sort');
      } else {
        params.set('sort', value);
      }
      params.delete('page');
      pushParams(params);
    },
    [pushParams, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
    setMobileFiltersOpen(false);
  }, [router, pathname]);

  const isActive = (key: string, value: string) =>
    searchParams.getAll(key).includes(value);

  const isToggleActive = (key: string) => {
    const value = searchParams.get(key);
    return value === 'true' || value === '1';
  };

  const toggleBooleanFilter = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const currentValue = searchParams.get(key);
      const nextValue = currentValue !== 'true' && currentValue !== '1';

      if (nextValue) {
        params.set(key, 'true');
      } else {
        params.delete(key);
      }

      params.delete('page');
      pushParams(params);
    },
    [pushParams, searchParams]
  );

  useEffect(() => {
    if (!mobileFiltersOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileFiltersOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    searchParams.forEach((_value, key) => {
      if (key !== 'page' && key !== 'sort') {
        count += 1;
      }
    });

    return count;
  }, [searchParams]);

  const hasFilters = searchParams.toString().length > 0;
  const sortValue = searchParams.get('sort') ?? 'newest';
  const renderFilterSections = () => (
    <>
      {/* Origin */}
      {countries.length > 0 && (
        <FilterGroup title="Köken">
          <FilterCheckbox
            label="Yalnızca tek köken"
            checked={isToggleActive('singleOrigin')}
            onChange={() => toggleBooleanFilter('singleOrigin')}
          />
          {countries.map((country) => (
            <FilterCheckbox
              key={country}
              label={country}
              checked={isActive('origin', country)}
              onChange={() => updateFilter('origin', country)}
            />
          ))}
        </FilterGroup>
      )}

      {/* Process */}
      <FilterGroup title="İşleme">
        {Object.entries(PROCESS_LABELS).map(([value, label]) => (
          <FilterCheckbox
            key={value}
            label={label}
            checked={isActive('process', value)}
            onChange={() => updateFilter('process', value)}
          />
        ))}
      </FilterGroup>

      {/* Roast Level */}
      <FilterGroup title="Kavurma Seviyesi">
        {Object.entries(ROAST_LABELS).map(([value, label]) => (
          <FilterCheckbox
            key={value}
            label={label}
            checked={isActive('roastLevel', value)}
            onChange={() => updateFilter('roastLevel', value)}
          />
        ))}
      </FilterGroup>

      {/* Flavor Category */}
      <FilterGroup title="Tat">
        {FLAVOR_CATEGORIES.map((cat) => (
          <FilterCheckbox
            key={cat}
            label={FLAVOR_CATEGORY_LABELS[cat]}
            checked={isActive('flavorCategory', cat)}
            onChange={() => updateFilter('flavorCategory', cat)}
          />
        ))}
      </FilterGroup>

      {/* Brew Method */}
      <FilterGroup title="Demleme Yöntemi">
        {Object.entries(BREW_METHOD_LABELS).map(([value, label]) => (
          <FilterCheckbox
            key={value}
            label={label}
            checked={isActive('brewMethod', value)}
            onChange={() => updateFilter('brewMethod', value)}
          />
        ))}
      </FilterGroup>

      {/* Roaster */}
      {roasters.length > 0 && (
        <FilterGroup title="Kavurucu">
          {roasters.map((r) => (
            <FilterCheckbox
              key={r.slug}
              label={r.name}
              checked={isActive('roaster', r.slug)}
              onChange={() => updateFilter('roaster', r.slug)}
            />
          ))}
        </FilterGroup>
      )}
    </>
  );

  return (
    <>
      <div className="lg:hidden">
        <div className="sticky top-16 z-30 -mx-4 border-y border-stone-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Sıralama</span>
              <select
                value={sortValue}
                onChange={(e) => setSort(e.target.value)}
                className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="mobile-coffee-filters"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
            >
              <FilterIcon />
              Filtreler
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-[70] bg-stone-950/40 backdrop-blur-sm"
            role="presentation"
            onClick={() => setMobileFiltersOpen(false)}
          >
            <section
              id="mobile-coffee-filters"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-coffee-filters-title"
              className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
                <div>
                  <h2
                    id="mobile-coffee-filters-title"
                    className="text-base font-bold text-stone-900"
                  >
                    Filtreler
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Seçimler anında uygulanır.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
                  aria-label="Filtre panelini kapat"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="max-h-[calc(86dvh-132px)] space-y-6 overflow-y-auto px-4 py-5">
                {renderFilterSections()}
              </div>

              <div className="flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!hasFilters}
                  className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex-1 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
                >
                  Bitti
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      <aside className="hidden space-y-6 lg:block">
        {/* Sort */}
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Sırala</h3>
          <select
            value={sortValue}
            onChange={(e) => setSort(e.target.value)}
            className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-amber-700 hover:text-amber-800"
          >
            Tüm filtreleri temizle
          </button>
        )}

        {renderFilterSections()}
      </aside>
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-stone-600 hover:bg-stone-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
      />
      {label}
    </label>
  );
}

function FilterIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 6h9.75M10.5 6a2.25 2.25 0 1 1-4.5 0m4.5 0a2.25 2.25 0 1 0-4.5 0M3.75 6H6m4.5 12h9.75m-9.75 0a2.25 2.25 0 1 1-4.5 0m4.5 0a2.25 2.25 0 1 0-4.5 0m-2.25 0H6m9-6h5.25M15 12a2.25 2.25 0 1 1-4.5 0m4.5 0a2.25 2.25 0 1 0-4.5 0M3.75 12h6.75"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
