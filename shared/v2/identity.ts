import type { SourceCoffee, SourceOffer } from './types';

const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl)$/i;
export function canonicalizeUrl(input: string, allowedHosts?: readonly string[]): string {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid source URL');
  if (allowedHosts?.length && !allowedHosts.some(host => host.toLowerCase() === url.hostname.toLowerCase())) {
    throw new Error('Untrusted source host');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

/** SHA-256 over length-safe JSON encoding. Independent of mutable names, price, parser and timestamps. */
export async function stableId(namespace: string, ...parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([namespace, ...parts])));
  return `${namespace}_${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function productIdentity(product: Pick<SourceCoffee, 'sourceProductId' | 'canonicalUrl'>): string {
  return product.sourceProductId?.trim() ? `source:${product.sourceProductId.trim()}` : `url:${canonicalizeUrl(product.canonicalUrl)}`;
}
export function offerIdentity(offer: SourceOffer): string {
  if (offer.sourceVariantId?.trim()) return `source:${offer.sourceVariantId.trim()}`;
  if (offer.identityKey?.trim()) return `options:${offer.identityKey.trim()}`;
  // An explicit variant URL can identify an offer. Weight/title/price alone never can.
  const url = new URL(canonicalizeUrl(offer.purchaseUrl));
  if ([...url.searchParams.keys()].some(key => /^(variant|variation_id|attribute_.+)$/i.test(key))) return `url:${url}`;
  return `single:${url}`;
}
export function toMinorUnits(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100) throw new Error('Invalid price');
  return Math.round((value + Number.EPSILON) * 100);
}
export function validWeight(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid bag weight');
  return value;
}
export function validCurrency(value: string | null): string | null {
  if (value === null) return null;
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid currency');
  return currency;
}
/** Lira per 100g, only where the observed currency really is TRY. */
export function unitPriceTry(priceMinor: number | null, weightG: number | null, currency: string | null): number | null {
  if (priceMinor === null || weightG === null || currency !== 'TRY' || !Number.isSafeInteger(priceMinor) || priceMinor < 0 || !Number.isSafeInteger(weightG) || weightG <= 0) return null;
  return Math.round(priceMinor / weightG * 100) / 100;
}
export function stableSlug(name: string, id: string): string {
  const base = name.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'kahve';
  return `${base}-${id.slice(-12)}`;
}
