'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';

const STORAGE_KEY = 'coffeedb:compare:v1';
const CHANGE_EVENT = 'coffeedb:compare-change';
const MAX_COFFEES = 3;
let memorySnapshot = '';
let useMemoryFallback = false;

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
function getSnapshot() {
  if (useMemoryFallback) return memorySnapshot;
  try {
    memorySnapshot = window.localStorage.getItem(STORAGE_KEY) ?? '';
    return memorySnapshot;
  } catch {
    useMemoryFallback = true;
    return memorySnapshot;
  }
}
function getServerSnapshot() {
  return '';
}
function parseSelection(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (item): item is string =>
                typeof item === 'string' && /^[a-z0-9_-]{1,240}$/i.test(item),
            ),
          ),
        ].slice(0, MAX_COFFEES)
      : [];
  } catch {
    return [];
  }
}
function setSelection(slugs: string[]) {
  memorySnapshot = JSON.stringify(parseSelection(JSON.stringify(slugs)));
  try {
    window.localStorage.setItem(STORAGE_KEY, memorySnapshot);
    useMemoryFallback = false;
  } catch {
    // A denied write must not let an older stored value replace this tab's selection.
    useMemoryFallback = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
function useSelection() {
  return parseSelection(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  );
}

export function CompareToggle({ slug, name }: { slug: string; name: string }) {
  const selection = useSelection();
  const selected = selection.includes(slug);
  const full = selection.length >= MAX_COFFEES && !selected;
  return (
    <button
      type="button"
      className="compare-toggle"
      aria-pressed={selected}
      aria-label={
        selected
          ? `${name} karşılaştırmadan çıkar`
          : `${name} karşılaştırmaya ekle`
      }
      disabled={full}
      title={
        full ? 'En fazla 3 kahve. Önce seçtiklerinden birini çıkar.' : undefined
      }
      onClick={() => {
        const current = parseSelection(getSnapshot());
        setSelection(
          current.includes(slug)
            ? current.filter((value) => value !== slug)
            : [...current, slug].slice(0, MAX_COFFEES),
        );
      }}
    >
      <span aria-hidden="true">{selected ? '✓' : '+'}</span>
      {selected ? 'Seçildi' : full ? '3 kahve seçili' : 'Karşılaştır'}
    </button>
  );
}

export function CompareRemoveLink({
  name,
  href,
  remainingSlugs,
}: {
  name: string;
  href: string;
  remainingSlugs: string[];
}) {
  // Reload the URL-backed server table after removal. A Link transition combined
  // with the external-store update can retain the previous comparison columns.
  return (
    <a
      href={href}
      className="compare-toggle"
      aria-label={`${name} karşılaştırmadan çıkar`}
      onClick={(event) => {
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          setSelection(remainingSlugs);
        }
      }}
    >
      <span aria-hidden="true">×</span>Çıkar
    </a>
  );
}

export function CompareCatalogLink({
  slugs,
  className,
  children,
}: {
  slugs: string[];
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      href="/coffees"
      className={className}
      onNavigate={() => setSelection(slugs)}
    >
      {children}
    </Link>
  );
}

export function CompareDock() {
  const pathname = usePathname();
  const selection = useSelection();
  if (pathname === '/compare' || !selection.length) return null;
  const query = new URLSearchParams();
  selection.forEach((slug) => query.append('coffee', slug));
  return (
    <aside className="compare-dock" aria-label="Kahve karşılaştırma listesi">
      <div role="status">
        <p>
          {selection.length} / {MAX_COFFEES} kahve seçili
        </p>
        <small>
          {selection.length === 1
            ? 'Yan yana görmek için bir kahve daha ekle.'
            : 'Paket, 100 g fiyatı ve tatları yan yana gör.'}
        </small>
      </div>
      <Link href={`/compare?${query.toString()}`}>
        Karşılaştır <span aria-hidden="true">↗</span>
      </Link>
      <button
        type="button"
        onClick={() => setSelection([])}
        aria-label="Karşılaştırma listesini temizle"
      >
        ×
      </button>
    </aside>
  );
}
