'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
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
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const setSort = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', value);
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
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
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const hasFilters = searchParams.toString().length > 0;

  return (
    <aside className="space-y-6">
      {/* Sort */}
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Sırala</h3>
        <select
          value={searchParams.get('sort') ?? 'newest'}
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
          onClick={clearAll}
          className="text-xs font-medium text-amber-700 hover:text-amber-800"
        >
          Tüm filtreleri temizle
        </button>
      )}

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
    </aside>
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
