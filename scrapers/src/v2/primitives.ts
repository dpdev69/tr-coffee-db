import { load } from 'cheerio';
import { parsePackageWeight } from '../adapters/package-selection.js';
import { normalizeRoasterProductUrl } from '../url-policy.js';
import type { RoasterConfig } from '../types.js';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected an array.');
  return value;
}
export function optionalList(value: unknown): unknown[] { return value == null ? [] : list(value); }
export function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
export function sourceId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (value == null) return null;
  throw new Error('Unsafe or malformed source identifier.');
}
export function requiredText(value: unknown): string {
  const result = text(value);
  if (!result) throw new Error('Required source text is missing.');
  return result;
}
export function bool(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null; }
export function stock(value: unknown): boolean | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value > 0 : null;
}
export function weight(label: string): number | null {
  const value = parsePackageWeight(label);
  return value != null && Number.isSafeInteger(value) && value > 0 ? value : null;
}
/** Intake uses lira; round through integer kuruş. Missing stays unknown; malformed is a run error. */
export function money(value: unknown, inputMinorUnit = 0): number | null {
  if (value == null || value === '') return null;
  if (!Number.isInteger(inputMinorUnit) || inputMinorUnit < 0 || inputMinorUnit > 6) throw new Error('Invalid currency minor unit.');
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim()))) throw new Error('Malformed price.');
  const amount = Number(value);
  const minor = Math.round(amount * 100 / 10 ** inputMinorUnit);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(minor) || minor <= 0) throw new Error('Price must be finite and positive.');
  return minor / 100;
}
export function canonicalUrl(value: unknown, config: RoasterConfig, base = config.shopUrl): string {
  const safe = normalizeRoasterProductUrl(requiredText(value), config, base);
  if (!safe) throw new Error('Product URL is outside the roaster allowlist.');
  const url = new URL(safe);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|referrer)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}
export function plainHtml(value: unknown) { return load(text(value)).text().replace(/\s+/g, ' ').trim(); }
export function names(value: unknown): string[] {
  return optionalList(value).map(item => typeof item === 'string' ? item : text(record(item).name)).filter(Boolean);
}
export function collect(value: unknown, predicate: (item: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown>[] {
  if (depth > 30) throw new Error('Source payload nesting limit exceeded.');
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => collect(item, predicate, depth + 1));
  const item = record(value);
  return [...(predicate(item) ? [item] : []), ...Object.values(item).flatMap(nested => collect(nested, predicate, depth + 1))];
}
