'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BREW_METHOD_LABELS,
  PROCESS_LABELS,
  ROAST_LABELS,
  FLAVOR_CATEGORIES,
  FLAVOR_CATEGORY_LABELS,
  SORT_OPTIONS,
} from '@/lib/constants/filter-options';
import {
  BEHAVIORAL_FILTERS,
  type BehavioralFilterOption,
} from '@/lib/behavioral-filters';

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
  const [roasterQuery, setRoasterQuery] = useState('');
  const [showAllRoasters, setShowAllRoasters] = useState(false);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.getAll(key);

      if (current.includes(value)) {
        params.delete(key);
        current
          .filter((v) => v !== value)
          .forEach((v) => params.append(key, v));
      } else {
        params.append(key, value);
      }

      params.delete('page');
      pushParams(params);
    },
    [pushParams, searchParams],
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
    [pushParams, searchParams],
  );

  const closeMobileFilters = useCallback(() => {
    setMobileFiltersOpen(false);
    window.requestAnimationFrame(() => mobileFilterButtonRef.current?.focus());
  }, []);

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
    closeMobileFilters();
  }, [router, pathname, closeMobileFilters]);

  const isActive = (key: string, value: string) =>
    searchParams.getAll(key).includes(value);

  const isToggleActive = (key: string) => {
    const value = searchParams.get(key);
    return value === 'true' || value === '1';
  };

  const isBehavioralFilterActive = (filter: BehavioralFilterOption) =>
    filter.params.every(({ key, value }) =>
      searchParams.getAll(key).includes(value),
    );

  const toggleBehavioralFilter = useCallback(
    (filter: BehavioralFilterOption) => {
      const params = new URLSearchParams(searchParams.toString());
      const shouldRemove = filter.params.every(({ key, value }) =>
        params.getAll(key).includes(value),
      );

      for (const { key, value } of filter.params) {
        const current = params.getAll(key);
        params.delete(key);

        const nextValues = shouldRemove
          ? current.filter((item) => item !== value)
          : current.includes(value)
            ? current
            : [...current, value];

        for (const nextValue of nextValues) {
          params.append(key, nextValue);
        }
      }

      params.delete('page');
      pushParams(params);
    },
    [pushParams, searchParams],
  );

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
    [pushParams, searchParams],
  );

  useEffect(() => {
    if (!mobileFiltersOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileFilterCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileFilters();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements(mobileDialogRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (!mobileDialogRef.current?.contains(activeElement)) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMobileFilters, mobileFiltersOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    searchParams.forEach((_value, key) => {
      if (isVisibleFilterParam(key)) {
        count += 1;
      }
    });

    return count;
  }, [searchParams]);

  const hasFilters = useMemo(() => {
    for (const key of searchParams.keys()) {
      if (isVisibleFilterParam(key)) return true;
    }
    return false;
  }, [searchParams]);
  const sortValue = searchParams.get('sort') ?? 'newest';
  const selectedRoasterSlugs = useMemo(
    () => new Set(searchParams.getAll('roaster')),
    [searchParams],
  );
  const normalizedRoasterQuery = roasterQuery.trim().toLocaleLowerCase('tr-TR');
  const filteredRoasters = useMemo(() => {
    if (!normalizedRoasterQuery) return roasters;

    return roasters.filter((roaster) =>
      `${roaster.name} ${roaster.slug}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalizedRoasterQuery),
    );
  }, [normalizedRoasterQuery, roasters]);
  const visibleRoasters = useMemo(() => {
    if (normalizedRoasterQuery || showAllRoasters) return filteredRoasters;

    return filteredRoasters.filter(
      (roaster, index) => index < 12 || selectedRoasterSlugs.has(roaster.slug),
    );
  }, [
    filteredRoasters,
    normalizedRoasterQuery,
    selectedRoasterSlugs,
    showAllRoasters,
  ]);
  const renderFilterSections = () => (
    <>
      {/* Behavioral preference */}
      <FilterGroup title="Kullanım / Tercih">
        {BEHAVIORAL_FILTERS.map((filter) => (
          <FilterCheckbox
            key={filter.key}
            label={filter.label}
            description={filter.description}
            checked={isBehavioralFilterActive(filter)}
            onChange={() => toggleBehavioralFilter(filter)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Kafein tercihi">
        <FilterCheckbox
          label="Yalnızca kafeinsiz"
          checked={isToggleActive('isDecaf')}
          onChange={() => toggleBooleanFilter('isDecaf')}
        />
      </FilterGroup>

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
        {Object.entries(PROCESS_LABELS)
          .filter(([value]) => value !== 'unknown')
          .map(([value, label]) => (
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
        {Object.entries(ROAST_LABELS)
          .filter(([value]) => value !== 'unknown')
          .map(([value, label]) => (
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
      <FilterGroup
        title="Demleme Yöntemi"
        helper="Kavurucunun önerdiği yöntemler. Bilgi paylaşılmayan kahveler bu filtrede görünmez."
      >
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
        <FilterGroup
          title="Kavurucu"
          helper="Listede yazmaya başlayarak kavurucu bulabilirsin."
        >
          <label className="block">
            <span className="sr-only">Kavurucu ara</span>
            <input
              type="search"
              value={roasterQuery}
              onChange={(event) => setRoasterQuery(event.target.value)}
              placeholder="Kavurucu ara"
              className="mb-2 h-10 w-full rounded-lg border border-[#1f1d1b]/20 bg-white px-3 text-sm text-[#1f1d1b] placeholder:text-[#5d5853]/70 focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
            />
          </label>
          {visibleRoasters.map((r) => (
            <FilterCheckbox
              key={r.slug}
              label={r.name}
              checked={isActive('roaster', r.slug)}
              onChange={() => updateFilter('roaster', r.slug)}
            />
          ))}
          {visibleRoasters.length === 0 && (
            <p className="rounded-lg bg-[#f6f1e8] px-3 py-2 text-xs text-[#5d5853]">
              Bu aramayla kavurucu bulunamadı.
            </p>
          )}
          {!normalizedRoasterQuery &&
            filteredRoasters.length > visibleRoasters.length && (
              <button
                type="button"
                onClick={() => setShowAllRoasters(true)}
                className="mt-2 text-xs font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
              >
                Tüm kavurucuları göster ({filteredRoasters.length})
              </button>
            )}
          {!normalizedRoasterQuery &&
            showAllRoasters &&
            filteredRoasters.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllRoasters(false)}
                className="mt-2 text-xs font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
              >
                Listeyi kısalt
              </button>
            )}
        </FilterGroup>
      )}
    </>
  );

  return (
    <>
      <div className="lg:hidden">
        <div className="sticky top-24 z-30 -mx-4 border-y border-[#1f1d1b]/10 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Sıralama</span>
              <select
                value={sortValue}
                onChange={(e) => setSort(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#1f1d1b]/20 bg-white px-3 text-sm font-medium text-[#1f1d1b] focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
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
              ref={mobileFilterButtonRef}
              onClick={() => setMobileFiltersOpen(true)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="mobile-coffee-filters"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#1f1d1b] px-4 text-sm font-semibold text-white transition-colors hover:bg-black"
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
            className="fixed inset-0 z-[70] bg-[#1f1d1b]/45 backdrop-blur-sm"
            role="presentation"
            onClick={closeMobileFilters}
          >
            <section
              id="mobile-coffee-filters"
              ref={mobileDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-coffee-filters-title"
              className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-[24px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#1f1d1b]/10 px-4 py-4">
                <div>
                  <h2
                    id="mobile-coffee-filters-title"
                    className="text-base font-bold text-[#1f1d1b]"
                  >
                    Filtreler
                  </h2>
                  <p className="mt-0.5 text-xs text-[#5d5853]">
                    Seçimler anında uygulanır.
                  </p>
                </div>
                <button
                  type="button"
                  ref={mobileFilterCloseRef}
                  onClick={closeMobileFilters}
                  className="rounded-full p-2 text-[#1f1d1b]/60 transition-colors hover:bg-[#f6f1e8] hover:text-[#1f1d1b]"
                  aria-label="Filtre panelini kapat"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="max-h-[calc(86dvh-132px)] space-y-6 overflow-y-auto px-4 py-5">
                {renderFilterSections()}
              </div>

              <div className="flex items-center gap-3 border-t border-[#1f1d1b]/10 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!hasFilters}
                  className="flex-1 rounded-lg border border-[#1f1d1b] px-4 py-2.5 text-sm font-semibold text-[#1f1d1b] transition-colors hover:bg-[#f6f1e8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={closeMobileFilters}
                  className="flex-1 rounded-lg bg-[#1f1d1b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
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
          <h3 className="text-sm font-semibold text-[#1f1d1b]">Sırala</h3>
          <select
            aria-label="Kahveleri sırala"
            value={sortValue}
            onChange={(e) => setSort(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#1f1d1b]/20 bg-white px-3 py-2 text-sm text-[#1f1d1b] focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
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
            className="text-xs font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
          >
            Tüm filtreleri temizle
          </button>
        )}

        {renderFilterSections()}
      </aside>
    </>
  );
}

function isVisibleFilterParam(key: string) {
  return !['page', 'priceMax', 'priceMin', 'sort'].includes(key);
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('hidden') && element.getClientRects().length > 0,
  );
}

function FilterGroup({
  helper,
  title,
  children,
}: {
  helper?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1f1d1b]">{title}</h3>
      {helper && (
        <p className="mt-1 text-xs leading-5 text-[#5d5853]">{helper}</p>
      )}
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-2 text-sm text-[#1f1d1b]/75 hover:bg-[#f6f1e8]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 rounded border-[#1f1d1b]/25 text-[#1f1d1b] focus:ring-[#1f1d1b]"
      />
      <span>
        <span className="block">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-[#5d5853]">
            {description}
          </span>
        )}
      </span>
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}
