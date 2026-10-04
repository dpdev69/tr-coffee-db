'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { formatMoney } from '@/lib/coffee-display';
import { deviceStore, SAVED_KEY } from '@/lib/device-store';
import type { PublicCatalogCoffee } from '../../../shared/v2/public-catalog';

/**
 * "Listem": saved coffees live only on this device, under kahvedrop:saved:v1 as
 * [{ slug, priceMinor, weightG, currency, inStock, savedAt }], newest first. The package fields are the
 * card's package when it was saved, so the list can say what changed for that same package.
 */
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

/** Bookmark toggle; styled by .save-toggle in globals.css. */
export function SaveToggle({ slug, name, offer, label = false, className = '' }: { slug: string; name: string; offer: SavedPackage; label?: boolean; className?: string }) {
  const saved = useSaved().some(item => item.slug === slug);
  return <button type="button" className={`save-toggle ${label ? 'save-toggle-label' : ''} ${className}`} aria-pressed={saved}
    aria-label={label ? undefined : saved ? `${name} listemden çıkar` : `${name} listeme ekle`} onClick={() => toggleSaved(slug, offer)}>
    {icon(saved)}{label ? (saved ? 'Listende' : 'Listeme ekle') : null}
  </button>;
}

/** One item of GET /api/saved. */
export interface SavedItem { slug: string; availability: 'listed' | 'sold_out' | 'gone'; restockedAt: string | null; coffee: PublicCatalogCoffee }
type Offer = PublicCatalogCoffee['offers'][number];
export type SavedStatus =
  | { kind: 'drop' | 'up'; offer: Offer; before: number }
  | { kind: 'same' | 'restocked' | 'listed'; offer: Offer }
  | { kind: 'sold_out'; offer?: Offer }
  | { kind: 'gone' };

/** Compares the saved package with the same package now (same weight and currency); another size is shown without a verdict. */
export function savedStatus(saved: SavedCoffee, item: SavedItem | undefined): SavedStatus {
  if (!item || item.availability === 'gone') return { kind: 'gone' };
  const samePackage = item.coffee.offers.filter(offer => offer.weightG === saved.weightG && offer.currency === saved.currency);
  const offer = samePackage.find(o => o.inStock === true) ?? item.coffee.offers.find(o => o.inStock === true);
  if (item.availability === 'sold_out' || !offer) return { kind: 'sold_out', offer: samePackage[0] ?? item.coffee.offers[0] };
  const comparable = offer.weightG === saved.weightG && offer.currency === saved.currency && saved.priceMinor !== null && offer.priceMinor !== null;
  if (comparable && offer.priceMinor! < saved.priceMinor!) return { kind: 'drop', offer, before: saved.priceMinor! };
  if (saved.inStock === false || (item.restockedAt !== null && item.restockedAt > saved.savedAt)) return { kind: 'restocked', offer };
  if (comparable && offer.priceMinor! > saved.priceMinor!) return { kind: 'up', offer, before: saved.priceMinor! };
  return { kind: comparable ? 'same' : 'listed', offer };
}

/** Current data for the saved slugs; null while loading, 'error' when the endpoint fails. */
export function useSavedItems(saved: SavedCoffee[]): Map<string, SavedItem> | null | 'error' {
  const key = saved.map(item => item.slug).join(',');
  const [state, setState] = useState<{ key: string; value: Map<string, SavedItem> | 'error' } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const query = new URLSearchParams(key.split(',').map(slug => ['slug', slug]));
    fetch(`/api/saved?${query}`, { signal: controller.signal })
      .then(response => (response.ok ? response.json() as Promise<{ items?: SavedItem[] }> : Promise.reject(new Error(String(response.status)))))
      .then(data => setState({ key, value: new Map((data.items ?? []).map(item => [item.slug, item])) }))
      .catch(() => { if (!controller.signal.aborted) setState({ key, value: 'error' }); });
    return () => controller.abort();
  }, [key]);
  return state?.key === key ? state.value : null;
}

const STATUS_TEXT: Record<SavedStatus['kind'], string> = { drop: 'Fiyatı düştü', restocked: 'Yeniden stokta', same: 'Fiyat aynı', up: 'Fiyatı arttı', listed: 'Satışta', sold_out: 'Stokta yok', gone: 'Artık satışta değil' };
const money = (minor: number | null | undefined, currency: string | null | undefined) => (minor != null && minor > 0 ? formatMoney(minor / 100, currency ?? 'TRY') : null);

/** One saved coffee with what changed since saving. */
export function SavedRow({ saved, item, compact = false }: { saved: SavedCoffee; item: SavedItem | undefined; compact?: boolean }) {
  const status = savedStatus(saved, item);
  const coffee = item?.coffee;
  const name = coffee?.name ?? 'Bu kahve artık listede yok';
  const highlight = status.kind === 'drop' || status.kind === 'restocked';
  const price = status.kind === 'gone' ? null : status.kind === 'sold_out' ? 'Tükendi' : money(status.offer.priceMinor, status.offer.currency);
  const body = <>
    {compact ? null : <span aria-hidden="true" className="inline-flex h-16 w-16 flex-none items-center justify-center rounded-[14px] bg-tint font-display text-[22px] text-warm">{(coffee?.roaster.name ?? '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>}
    <span className="min-w-0 flex-[1_1_180px]">
      <span className="block font-display text-lg leading-tight text-ink">{name}</span>
      {coffee ? <span className="block text-[13px] text-muted">{coffee.roaster.name}</span> : null}
      {compact ? null : <span className={highlight ? 'mt-1 inline-block rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-accent-deep' : 'mt-1 inline-block text-xs font-semibold text-muted'}>{STATUS_TEXT[status.kind]}</span>}
    </span>
    <span className="whitespace-nowrap text-right tabular-nums">
      {'before' in status ? <span className="block text-[13px] text-muted line-through">{money(status.before, saved.currency)}</span> : null}
      {price ? <span className="text-base font-semibold text-ink">{price}</span> : null}
    </span>
  </>;
  const className = compact ? 'flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-3' : 'flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-3.5 hover:border-accent';
  return coffee
    ? <Link href={`/kahve/${coffee.slug}`} prefetch={false} className={className}>{body}</Link>
    : <div className={className}>{body}</div>;
}

const noSubscription = () => () => {};
/** False during the server render and hydration, true after: tells "nothing saved" apart from "not read yet". */
export function useHydrated() { return useSyncExternalStore(noSubscription, () => true, () => false); }
export const DEVICE_NOTE = 'Listen bu cihazda saklanır. Hesap açman gerekmez.';

export function SavedListView() {
  const hydrated = useHydrated();
  const saved = useSaved();
  const items = useSavedItems(saved);
  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;
  if (!saved.length) return <div className="rounded-[18px] border border-line bg-surface p-6">
    <p className="text-[15px]">Listen boş. Bir kahvenin kartındaki işaretle onu buraya ekleyebilirsin; fiyatı düşerse burada görürsün.</p>
    <Link href="/kahveler" className="text-link mt-3 inline-flex min-h-11 items-center">Kahvelere göz at →</Link>
    <p className="mt-2 text-[13px] text-muted">{DEVICE_NOTE}</p>
  </div>;
  const statuses = items && items !== 'error' ? saved.map(entry => savedStatus(entry, items.get(entry.slug)).kind) : [];
  const counted = (kind: SavedStatus['kind']) => statuses.filter(value => value === kind).length;
  const summary = [counted('drop') ? `${counted('drop')} tanesinin fiyatı düştü` : '', counted('restocked') ? `${counted('restocked')} tanesi yeniden stokta` : '', counted('sold_out') ? `${counted('sold_out')} tanesi tükendi` : ''].filter(Boolean).join(', ');
  return <div className="flex flex-col gap-3.5">
    <p className="text-[15px] text-muted" role="status">{saved.length} kahve.{summary ? ` ${summary.charAt(0).toLocaleUpperCase('tr-TR')}${summary.slice(1)}.` : ''}</p>
    {items === 'error' ? <p className="rounded-xl bg-tint p-4 text-sm">Güncel fiyatları şu an alamadık. Biraz sonra yeniden dene; listen yerinde duruyor.</p> : null}
    <ul className="flex flex-col gap-3">{saved.map(entry => <li key={entry.slug} className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{items === null ? <div className="h-[94px] rounded-[18px] bg-tint" /> : items === 'error' ? <div className="rounded-[18px] border border-line bg-surface p-4 font-mono text-sm text-muted">{entry.slug}</div> : <SavedRow saved={entry} item={items.get(entry.slug)} />}</div>
      <button type="button" className="save-toggle flex-none" aria-pressed="true" aria-label={`${items && items !== 'error' ? items.get(entry.slug)?.coffee.name ?? 'Bu kahveyi' : 'Bu kahveyi'} listemden çıkar`} onClick={() => removeSaved(entry.slug)}>×</button>
    </li>)}</ul>
    <p className="text-[13px] leading-normal text-muted">{DEVICE_NOTE}</p>
  </div>;
}
