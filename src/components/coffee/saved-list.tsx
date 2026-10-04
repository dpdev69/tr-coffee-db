'use client';

import { deviceStore } from '@/lib/device-store';

/**
 * "Listem": saved coffees live only on this device, under kahvedrop:saved:v1 as
 * [{ slug, priceMinor, weightG, currency, inStock, savedAt }], newest first. The package fields are the
 * card's package when it was saved, so the list can say what changed for that same package.
 */
export const SAVED_KEY = 'kahvedrop:saved:v1';
export const MAX_SAVED = 50;
const store = deviceStore(SAVED_KEY);
const SLUG = /^[a-z0-9_-]{1,240}$/i;

export interface SavedCoffee { slug: string; priceMinor: number | null; weightG: number | null; currency: string | null; inStock: boolean | null; savedAt: string }
export type SavedPackage = Pick<SavedCoffee, 'priceMinor' | 'weightG' | 'currency' | 'inStock'>;

const count = (value: unknown) => (Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null);
export function parseSaved(value: string): SavedCoffee[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((item): SavedCoffee[] => {
      if (!item || typeof item !== 'object') return [];
      const { slug, priceMinor, weightG, currency, inStock, savedAt } = item as Record<string, unknown>;
      if (typeof slug !== 'string' || !SLUG.test(slug) || seen.has(slug) || typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt))) return [];
      seen.add(slug);
      return [{ slug, priceMinor: count(priceMinor), weightG: count(weightG), currency: typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : null, inStock: typeof inStock === 'boolean' ? inStock : null, savedAt }];
    }).slice(0, MAX_SAVED);
  } catch { return []; }
}
export function useSaved() { return parseSaved(store.useValue()); }
export function removeSaved(slug: string) { store.set(JSON.stringify(parseSaved(store.get()).filter(item => item.slug !== slug))); }
function toggleSaved(slug: string, offer: SavedPackage) {
  const current = parseSaved(store.get());
  store.set(JSON.stringify(current.some(item => item.slug === slug)
    ? current.filter(item => item.slug !== slug)
    : [{ slug, ...offer, savedAt: new Date().toISOString() }, ...current].slice(0, MAX_SAVED)));
}

const icon = (filled: boolean) => <svg width="18" height="18" viewBox="0 0 18 18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M4 2h10v14l-5-3.5L4 16z" /></svg>;

/** Bookmark toggle. Hooks for motion: .save-toggle, [aria-pressed=true]. */
export function SaveToggle({ slug, name, offer, label = false, className = '' }: { slug: string; name: string; offer: SavedPackage; label?: boolean; className?: string }) {
  const saved = useSaved().some(item => item.slug === slug);
  return <button type="button" className={`save-toggle ${label ? 'save-toggle-label' : ''} ${className}`} aria-pressed={saved}
    aria-label={label ? undefined : saved ? `${name} listemden çıkar` : `${name} listeme ekle`} onClick={() => toggleSaved(slug, offer)}>
    {icon(saved)}{label ? (saved ? 'Listende' : 'Listeme ekle') : null}
  </button>;
}
