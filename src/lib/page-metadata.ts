import type { Metadata } from 'next';
import { brand } from './brand';
import { absoluteUrl } from './site';
import { trustedCoffeeImageUrl } from './coffee-image';
import { formatMoney, formatPackageWeight } from './coffee-display';
import { ROAST_LABELS } from './constants/filter-options';
import { getFirstSearchParamValue, normalizeCityFilterValue, type SearchParamValue } from './filter-contract';
import { originLanding, processLanding } from './catalog-landing';
import { canonicalCountry, isKnownCountry } from '../../shared/v2/country-labels';
import { coffeeOrigin, coffeeProcess, featureText, preferredOffer, tasteSummary } from '@/components/v2/discovery-card';
import type { CatalogCoffee, CatalogRoaster } from '../../shared/v2/catalog';

type SocialImage = { url: string; alt: string; width?: number; height?: number };
/** The site card (src/app/opengraph-image.tsx), named explicitly so no page falls back to a host the framework guesses. */
export const SITE_CARD: SocialImage = { url: absoluteUrl(brand.social.image), alt: brand.title, width: 1200, height: 630 };
/** Past this, search results cut the title; the brand suffix goes first. */
const TITLE_LIMIT = 60;

/** Keep search and social previews specific to the page being shared. */
export function pageMetadata(title: string, description: string, path: string, { type = 'website', image = SITE_CARD }: { type?: 'website' | 'article' | 'product'; image?: SocialImage } = {}): Metadata {
  const socialTitle = `${title} | ${brand.name}`;
  return {
    title: socialTitle.length > TITLE_LIMIT ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    // Open Graph defines `product`; Next's types list only the generic kinds.
    openGraph: { title: socialTitle, description, url: path, siteName: brand.name, locale: 'tr_TR', type: type as 'website', images: [image] },
    twitter: { card: 'summary_large_image', title: socialTitle, description, images: [image] },
  };
}

/** The query keys a catalog listing reads; anything else (utm_*, fbclid) does not change the page. */
const LISTING_KEYS = new Set(['search', 'origin', 'process', 'taste', 'roaster', 'priceMin', 'priceMax', 'farm', 'producer', 'variety', 'altitude', 'roast', 'brewMethod', 'sort', 'event']);
/** A single origin or process value on the catalog has its own landing page. */
export const catalogLanding = (key: string, value: string) => (key === 'origin' ? originLanding(value) : key === 'process' ? processLanding(value) : null)?.path ?? null;

/**
 * Catalog-style listings. The unfiltered list and each of its later pages are their own canonical;
 * one origin or one process points at its landing page; every other filter, sort or feed switch
 * stays crawlable (follow) but out of the index, with the unfiltered list as canonical.
 */
export function listingMetadata(title: string, description: string, path: string, params: Record<string, SearchParamValue>, landing?: (key: string, value: string) => string | null): Metadata {
  const pageValue = Number(getFirstSearchParamValue(params.page));
  const page = Number.isInteger(pageValue) && pageValue > 1 ? pageValue : 1;
  const applied = Object.entries(params).flatMap(([key, value]) => !LISTING_KEYS.has(key) ? []
    : (Array.isArray(value) ? value : [value]).flatMap(item => item?.trim() && !(key === 'sort' && item.trim() === 'newest') ? [[key, item.trim()] as const] : []));
  const target = applied.length === 0 ? path : applied.length === 1 && landing ? landing(...applied[0]) : null;
  if (!target) return { ...pageMetadata(title, description, path), robots: { index: false, follow: true } };
  return pageMetadata(page > 1 ? `${title} · Sayfa ${page}` : title, description, page > 1 ? `${target}?page=${page}` : target);
}

const list = (items: string[]) => new Intl.ListFormat('tr', { type: 'conjunction' }).format(items);
const lower = (value: string) => value.toLocaleLowerCase('tr-TR');
const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase('tr-TR') + value.slice(1);

/**
 * Title, description and share image from the facts the coffee page shows, and only those:
 * a missing origin, process, roast, note or price is left out, never guessed.
 */
export function coffeeMetadata(coffee: CatalogCoffee) {
  const raw = coffee.rawMetadata;
  const origin = coffeeOrigin(coffee), process = coffeeProcess(coffee);
  const roastKey = raw.roast ?? featureText(coffee, 'roast_classification', 'roast_level')[0];
  // Only the roast scale reads as "açık kavrumlu"; free text such as "filter, espresso" stays on the page, out of the sentence.
  const roast = roastKey && roastKey !== 'unknown' ? ROAST_LABELS[roastKey] ?? null : null;
  const traits = [origin && `${origin} kökenli`, process && `${lower(process)} işlemli`, roast && `${lower(roast)} kavrumlu`].filter((trait): trait is string => Boolean(trait));
  // Same notes the page lists: the roaster's own, else normalized ones, else the taste families.
  const notes = raw.tastingNotes?.length ? raw.tastingNotes : featureText(coffee, 'flavor_notes_normalized');
  const families = notes.length ? [] : tasteSummary(coffee).map(lower);
  const offer = preferredOffer(coffee);
  const price = offer?.priceMinor != null && offer.priceMinor > 0 && offer.currency
    ? `${offer.weightG ? `${formatPackageWeight(offer.weightG)} paketi` : 'Paket fiyatı'} ${formatMoney(offer.priceMinor / 100, offer.currency)}${offer.inStock === false ? '; şu an tükendi' : ''}.` : null;
  const description = [
    `${coffee.roaster.name} kavurucusundan ${coffee.name}.`,
    traits.length ? `${capitalize(list(traits))}.` : null,
    notes.length ? `Tadım notları: ${list(notes.slice(0, 3))}.` : families.length ? `Tat profili: ${list(families)}.` : null,
    price,
  ].filter(Boolean).join(' ');
  // The origin joins the title when the name does not already say it and the title still fits.
  const named = (value: string) => (normalizeCityFilterValue(coffee.name) ?? '').includes(normalizeCityFilterValue(value) ?? '\u0000');
  const withOrigin = origin && isKnownCountry(origin) && !named(origin) && !named(canonicalCountry(origin)) ? `${coffee.name} · ${origin} · ${coffee.roaster.name}` : null;
  const title = withOrigin && `${withOrigin} | ${brand.name}`.length <= TITLE_LIMIT ? withOrigin : `${coffee.name} · ${coffee.roaster.name}`;
  const imageUrl = raw.imageUrl ? trustedCoffeeImageUrl(raw.imageUrl)?.href : undefined;
  return { title, description: price || traits.length || notes.length || families.length ? description : `${description} Paketlerini incele, siparişini doğrudan kavurucudan ver.`,
    image: imageUrl ? { url: imageUrl, alt: `${coffee.name} · ${coffee.roaster.name}` } : SITE_CARD };
}

/** What the roaster page shows: city, how many coffees are on sale, and the commonest origins among them. */
export function roasterDescription(roaster: Pick<CatalogRoaster, 'name' | 'city' | 'coffeeCount'>, coffees: CatalogCoffee[]) {
  const who = `${roaster.name}${roaster.city ? ` (${roaster.city})` : ''}`;
  if (!roaster.coffeeCount) return `${who} kavurucusunun şu an satışta doğrulanmış bir kahvesi yok. Yeniden satışa çıkan kahveleri bu sayfada gösteriyoruz.`;
  const counts = new Map<string, number>();
  for (const coffee of coffees) { const origin = coffeeOrigin(coffee); if (origin && isKnownCountry(origin)) counts.set(origin, (counts.get(origin) ?? 0) + 1); }
  const origins = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr')).slice(0, 3).map(([origin]) => origin);
  return `${who} kavurucusunun satıştaki ${roaster.coffeeCount} kahvesi${origins.length ? `; kökenler arasında ${list(origins)} var` : ''}. Paketlerini ve fiyatlarını incele, siparişini doğrudan kavurucudan ver.`;
}
