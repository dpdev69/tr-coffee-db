'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { deviceStore } from '@/lib/device-store';
import { BREW_METHOD_LABELS, FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';
import { DEVICE_NOTE, SavedRow, savedStatus, useSaved, useSavedItems } from '@/components/coffee/saved-list';
import { DiscoveryGrid } from './discovery-card';
import { parseQuizAnswers, quizQuery } from '@/lib/quiz-filters';
import type { CatalogCoffee } from '../../../shared/v2/catalog';
import type { PublicCatalogCoffee } from '../../../shared/v2/public-catalog';
import type { RawMetadata } from '../../../shared/v2/types';

/* ---------- Since your last visit ---------- */

/** kahvedrop:visit:v1 = { previous: ISO | null, lastSeen: ISO }. */
const visits = deviceStore('kahvedrop:visit:v1');
const SESSION_GAP = 30 * 60000;
/**
 * A visit becomes "last" only once it is over: within a session (views less than 30 minutes apart) the
 * comparison point stays put; after a longer gap the previous session's last view becomes it.
 */
export function advanceVisit(stored: string, now: number): { previous: string | null; next: string } {
  let state: { previous?: unknown; lastSeen?: unknown } = {};
  try { state = JSON.parse(stored) ?? {}; } catch { /* first visit or unreadable */ }
  const valid = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now ? value : null;
  const lastSeen = valid(state.lastSeen);
  const previous = lastSeen && now - Date.parse(lastSeen) > SESSION_GAP ? lastSeen : valid(state.previous);
  return { previous, next: JSON.stringify({ previous, lastSeen: new Date(now).toISOString() }) };
}

type Counts = { NEW: number; PRICE_DROP: number; RESTOCKED: number };
type Day = Counts & { day: string };
const istanbulDay = (time: number) => new Date(time + 3 * 3600000).toISOString().slice(0, 10);
/** Sums the daily buckets from the visit's Istanbul day on; a visit earlier today counts today's bucket. No visit = the past 7 days; older than the buckets reach (30 days) = all of them. */
export function countSince(days: Day[], previous: string | null, now: number): Counts {
  const from = istanbulDay(previous ? Date.parse(previous) : now - 7 * 86400000);
  const counts: Counts = { NEW: 0, PRICE_DROP: 0, RESTOCKED: 0 };
  for (const day of days) if (day.day >= from) for (const type of Object.keys(counts) as Array<keyof Counts>) counts[type] += day[type];
  return counts;
}
const CHANGES: Array<[keyof Counts, string, string]> = [['NEW', 'yeni kahve', '/yeni'], ['PRICE_DROP', 'fiyat düşüşü', '/firsatlar'], ['RESTOCKED', 'yeniden stokta', '/yeni?event=RESTOCKED']];

/** Same structure from first paint (placeholders until counts arrive), so nothing below it moves. */
export function SinceLastVisit() {
  const [state, setState] = useState<{ returning: boolean; counts: Counts | null } | null>(null);
  useEffect(() => {
    const now = Date.now();
    const { previous, next } = advanceVisit(visits.get(), now);
    visits.set(next);
    fetch('/api/since')
      .then(response => (response.ok ? response.json() as Promise<{ days?: Day[] }> : null))
      .then(data => setState({ returning: Boolean(previous), counts: data?.days ? countSince(data.days, previous, now) : null }))
      .catch(() => setState({ returning: Boolean(previous), counts: null }));
  }, []);
  return <section className="mb-10 mt-8 flex flex-wrap content-start items-center gap-x-4 gap-y-3 sm:min-h-16" aria-live="polite" aria-busy={!state}>
    <h2 className="mr-2 w-full font-display text-[26px] sm:w-auto">{state ? (state.returning ? 'Son ziyaretinden beri' : 'Son 7 günde') : ' '}</h2>
    {CHANGES.map(([type, label, href]) => <Link key={type} href={href} prefetch={false} className="inline-flex min-h-11 items-baseline gap-2 rounded-full border border-line bg-surface px-[18px] py-2.5 text-[15px] text-ink hover:border-accent">
      <span className="font-display text-[22px] font-semibold text-accent">{state?.counts ? state.counts[type].toLocaleString('tr-TR') : '·'}</span>{label}
    </Link>)}
  </section>;
}

/* ---------- Listem panel ---------- */

/** Rendered only when something is saved; the page's inline script reserves its cell before hydration. */
export function SavedPanel() {
  const saved = useSaved();
  const items = useSavedItems(saved);
  useEffect(() => {
    // Keep the reserved cell in step when the last coffee is removed in another tab.
    if (saved.length) document.documentElement.dataset.savedList = ''; else delete document.documentElement.dataset.savedList;
  }, [saved.length]);
  if (!saved.length) return null;
  const ready = items && items !== 'error' ? items : null;
  const ranked = ready ? [...saved].sort((a, b) => Number(savedStatus(b, ready.get(b.slug)).kind === 'drop') - Number(savedStatus(a, ready.get(a.slug)).kind === 'drop')) : saved;
  const drops = ready ? saved.filter(entry => savedStatus(entry, ready.get(entry.slug)).kind === 'drop').length : 0;
  return <section className="flex h-full flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-6 sm:p-8" aria-labelledby="saved-panel-title">
    <div className="flex items-baseline justify-between gap-3"><h2 id="saved-panel-title" className="font-display text-[26px]">Listem</h2><Link href="/listem" className="text-link inline-flex min-h-11 items-center text-sm">Tümü ({saved.length}) →</Link></div>
    {drops ? <p className="mb-1.5 rounded-xl bg-chip px-3.5 py-2.5 text-[15px] text-accent-deep">Listendeki {drops} kahvenin fiyatı düştü.</p> : null}
    {items === 'error' ? <p className="text-sm text-muted">Güncel fiyatları şu an alamadık.</p> : ranked.slice(0, 3).map(entry => ready ? <SavedRow key={entry.slug} saved={entry} item={ready.get(entry.slug)} compact /> : <div key={entry.slug} className="h-[68px] border-b border-line" />)}
    <p className="mt-auto pt-2.5 text-[13px] text-muted">{DEVICE_NOTE}</p>
  </section>;
}

/* ---------- Taste profile and new arrivals ---------- */

/** Written by the quiz: kahvedrop:taste = {"brew":[],"taste":[],"roast":[],"process":[],"savedAt":"…"}. Read only here. */
const tasteStore = deviceStore('kahvedrop:taste');
type Profile = Record<'brew' | 'taste' | 'roast' | 'process', string[]>;
export function parseProfile(value: string): Profile | null {
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const list = (key: string) => (Array.isArray(raw?.[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === 'string' && /^[a-z_]{1,40}$/i.test(item)).slice(0, 10) : []);
    const profile = { brew: list('brew'), taste: list('taste'), roast: list('roast'), process: list('process') };
    return Object.values(profile).some(values => values.length) ? profile : null;
  } catch { return null; }
}
const label = (labels: Record<string, string>, value: string) => labels[value] ?? labels[Object.keys(labels).find(key => key.toLowerCase() === value.toLowerCase()) ?? ''];
export function profileWords(profile: Profile): string {
  const words = (values: string[], labels: Record<string, string>, suffix = '') => values.map(value => label(labels, value)).filter(Boolean).map(text => `${text.toLocaleLowerCase('tr-TR')}${suffix}`).join(', ');
  return [words(profile.taste, FLAVOR_CATEGORY_LABELS), words(profile.roast, ROAST_LABELS, ' kavrum'), words(profile.process, PROCESS_LABELS), words(profile.brew, BREW_METHOD_LABELS)].filter(Boolean).join(' · ');
}

/** /api/quiz/match returns /api/catalog items; the card reads only what they carry. */
function fromPublic(item: PublicCatalogCoffee): CatalogCoffee {
  return { id: item.id, name: item.name, slug: item.slug, canonicalUrl: '', sourceUrl: null, sourceProductId: null, roaster: item.roaster, rawMetadata: item.facts as RawMetadata, features: [], latestEvents: [],
    offers: item.offers.map(offer => ({ ...offer, coffeeId: item.id, sourceVariantId: null, unitPriceTry: null, firstSeenAt: '', lastSeenAt: '', lastPriceChangeAt: null, variantOfferIds: [offer.id] })),
    firstSeenAt: '', lastSeenAt: '', discontinuedAt: null, stale: false };
}
const usable = (item: unknown): item is PublicCatalogCoffee => {
  const value = item as PublicCatalogCoffee;
  return Boolean(value && typeof value.id === 'string' && typeof value.slug === 'string' && typeof value.name === 'string' && value.roaster && typeof value.roaster.name === 'string' && value.facts && Array.isArray(value.offers));
};
/** Isolated so the contract lives in one place: any failure means null, and the caller keeps plain new arrivals. */
async function fetchMatches(profile: Profile, signal: AbortSignal): Promise<CatalogCoffee[] | null> {
  try {
    // The canonical address (src/lib/canonical-address.ts): one edge entry per answer set; 4 is the endpoint's default limit.
    const query = quizQuery(parseQuizAnswers(profile));
    const response = await fetch(query ? `/api/quiz/match?${query}` : '/api/quiz/match', { signal });
    if (!response.ok) return null;
    const data = await response.json() as { coffees?: unknown; items?: unknown };
    const list = Array.isArray(data.coffees) ? data.coffees : Array.isArray(data.items) ? data.items : [];
    const coffees = list.filter(usable).slice(0, 4).map(fromPublic);
    return coffees.length ? coffees : null;
  } catch { return null; }
}

/** Server-rendered new arrivals stay as `children` unless matches for a saved profile arrive. */
export function TasteArrivals({ children }: { children: ReactNode }) {
  const profile = parseProfile(tasteStore.useValue());
  const key = profile ? JSON.stringify(profile) : '';
  const [matches, setMatches] = useState<{ key: string; coffees: CatalogCoffee[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetchMatches(JSON.parse(key) as Profile, controller.signal).then(coffees => { if (coffees) setMatches({ key, coffees }); });
    return () => controller.abort();
  }, [key]);
  const personal = matches?.key === key && key ? matches.coffees : null;
  const words = profile ? profileWords(profile) : '';
  return <>
    <p className="mb-2.5 flex min-h-11 flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-muted">
      {profile ? <><span className="font-semibold tracking-[0.04em] text-warm">DAMAK PROFİLİN</span>{words ? <span>{words}</span> : null}<Link href="/quiz" className="text-link inline-flex min-h-11 items-center">Değiştir</Link></>
        : <><span>Damak tadını henüz bilmiyoruz.</span><Link href="/quiz" className="text-link inline-flex min-h-11 items-center">4 soruda bul, sana en yakın kahveleri gösterelim →</Link></>}
    </p>
    <div className="section-heading"><div><h2>{personal ? 'Damağına en yakın kahveler.' : 'Yeni gelenler.'}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted">{personal ? 'Testteki cevaplarına göre seçtik; profilin bu cihazda kalır.' : 'Farklı kavuruculardan, farklı karakterlerde çekirdekler. Bir sonraki favorini bul.'}</p></div><Link href="/yeni" className="text-link">Tümünü keşfet ↗</Link></div>
    {personal ? <DiscoveryGrid coffees={personal} source="home" /> : children}
  </>;
}
