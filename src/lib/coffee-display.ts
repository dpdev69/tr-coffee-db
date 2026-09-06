import type { Coffee } from '@/lib/types/database';

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
