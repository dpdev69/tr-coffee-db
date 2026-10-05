import type { Coffee } from '@/lib/types/database';
import { isKnownCountry } from '../../shared/v2/country-labels';

/*
 * Display-only rules for text a roaster wrote. They never add or reword anything: they calm casing,
 * tidy option prefixes and drop store tags that are not tasting notes. When a rule is unsure, the text stays as written.
 */
const TURKISH_LETTER = /[İŞĞÜÖÇışğüöç]/;
const LOWER = /\p{Ll}/u;
/** Turkish words seen in names without any other Turkish letter, whose I is ı. Everything else with a bare I reads as Latin i (origins, farms, varieties). */
const DOTLESS_WORDS = new Set(['HARMANI', 'KIRMIZI', 'SARI', 'ACI', 'KISA', 'YAKIN', 'KARMA', 'ALTIN', 'AYLIK']);
/**
 * Lowercases a word typed in capitals.
 * Words with digits (SL28, G1), vowel-less codes (SWP, CM), grades (AA, EP) and Roman numerals keep their capitals.
 */
function lowerWord(word: string): string {
  if (!/\p{L}/u.test(word) || /\d/.test(word) || (/^\p{Lu}{1,3}$/u.test(word) && !/[AEIİOÖUÜ]/.test(word)) || /^(?:A[AB]|EP|PB|[IVX]+)$/.test(word)) return word;
  if (TURKISH_LETTER.test(word) || DOTLESS_WORDS.has(word)) return word.toLocaleLowerCase('tr-TR');
  return word.toLowerCase();
}
/** Lowercases each word after its first letter (kept as typed); `firstOnly` keeps only the very first letter, for sentence case. */
function calm(text: string, firstOnly = false): string {
  let first = true;
  return text.normalize('NFC').split(/([^\p{L}\p{N}]+)/u).map((part, index) => {
    if (index % 2 || !part) return part;
    const lowered = lowerWord(part), keep = first || !firstOnly;
    first = false;
    return lowered === part || !keep ? lowered : part.charAt(0) + lowered.slice(1);
  }).join('');
}
const capitalize = (word: string) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
const shouting = (text: string) => !LOWER.test(text) && /\p{Lu}{3}/u.test(text);

/** A name written in capitals, in title case with codes kept (“25/26 KENYA AA SL28” → “25/26 Kenya AA SL28”). */
export function displayCoffeeName(name: string): string {
  return shouting(name) ? calm(name) : name;
}

const NOT_A_NOTE = /(?:^|\s)(?:kahve|kahvesi|kahveler|coffee)$|mağaza|^(?:filtre|espresso|filtre bazlı|espresso bazlı|türkiye|specialty|nitelikli)$/i;
/** Tasting notes as shown: store tags (“Filtre Kahve”, “Etiyopya”, “FİZİKSEL MAĞAZA”) dropped, capitals calmed, first letter capital, no repeats. */
export function displayNotes(notes: readonly string[]): string[] {
  const seen = new Set<string>();
  return notes.flatMap(raw => {
    let note = raw.replace(/\s+/g, ' ').trim();
    if (!note || NOT_A_NOTE.test(note.toLocaleLowerCase('tr-TR')) || isKnownCountry(note)) return [];
    if (shouting(note)) note = calm(note, true);
    note = capitalize(note);
    const key = note.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return [];
    seen.add(key);
    return [note];
  });
}

const WEIGHT_ONLY = /^(\d+(?:[.,]\d+)?)\s*(g|gr|gram|kg|kilo)?\.?$/i;
/** “GRAMAJ: 250”, “Miktar: 250 Gr”, “1 Kg.” become “250 g” / “1 kg” when they say only the known weight; anything else stays. */
export function displayPackageLabel(label: string, weightG: number | null): string {
  const text = label.replace(/^\s*(?:gramaj|miktar|ağırlık|agirlik|boyut|weight|size)\s*:\s*/i, '').trim();
  const match = WEIGHT_ONLY.exec(text);
  const grams = match ? Number(match[1].replace(',', '.')) * (/^k/i.test(match[2] ?? '') ? 1000 : 1) : null;
  if (weightG && grams === weightG) return formatPackageWeight(weightG);
  return text || label;
}

const TURKEY_TIME_ZONE = 'Europe/Istanbul';
const DAY_IN_MS = 86_400_000;
const turkeyDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: TURKEY_TIME_ZONE,
  year: 'numeric',
});

export function formatVerifiedAt(value: string | null, now = new Date()) {
  if (!value) return 'Kontrol tarihi bilinmiyor';

  const verifiedAt = new Date(value);
  if (Number.isNaN(verifiedAt.getTime())) return 'Kontrol tarihi bilinmiyor';

  const startOfToday = startOfTurkeyDay(now);
  const startOfVerifiedDay = startOfTurkeyDay(verifiedAt);
  if (startOfToday === null || startOfVerifiedDay === null) return 'Kontrol tarihi bilinmiyor';

  const daysAgo = Math.max(
    0,
    Math.floor((startOfToday - startOfVerifiedDay) / DAY_IN_MS)
  );

  if (daysAgo === 0) return 'Bugün kontrol edildi';
  if (daysAgo === 1) return 'Dün kontrol edildi';
  return `${daysAgo} gün önce kontrol edildi`;
}

export function getSourceHost(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function formatPackageWeight(weightGrams: number) {
  return weightGrams >= 1000
    ? `${weightGrams / 1000} kg`
    : `${weightGrams} g`;
}

export function getUnitPrice(
  coffee: Pick<Coffee, 'price_amount' | 'weight_grams' | 'price_currency'>
) {
  const { price_amount: price, weight_grams: weight, price_currency: currency } = coffee;
  if (
    currency !== 'TRY' ||
    price == null ||
    weight == null ||
    !Number.isFinite(price) ||
    !Number.isFinite(weight) ||
    price <= 0 ||
    weight <= 0
  ) {
    return null;
  }

  const unitPrice = (price / weight) * 100;
  return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null;
}

export function formatMoney(value: number, currency = 'TRY') {
  if (!Number.isFinite(value)) return '—';

  const amount = value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return `${amount} ${currency === 'TRY' ? 'TL' : currency}`;
}

function startOfTurkeyDay(date: Date) {
  const parts = turkeyDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
