const TURKEY_TIME_ZONE = 'Europe/Istanbul';
const DAY_IN_MS = 86_400_000;
const turkeyDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: TURKEY_TIME_ZONE,
  year: 'numeric',
});

export function formatVerifiedAt(value: string | null, now = new Date()) {
  if (!value) return 'Doğrulama bekliyor';

  const verifiedAt = new Date(value);
  if (Number.isNaN(verifiedAt.getTime())) return 'Doğrulama bekliyor';

  const startOfToday = startOfTurkeyDay(now);
  const startOfVerifiedDay = startOfTurkeyDay(verifiedAt);
  if (startOfToday === null || startOfVerifiedDay === null) return 'Doğrulama bekliyor';

  const daysAgo = Math.max(
    0,
    Math.floor((startOfToday - startOfVerifiedDay) / DAY_IN_MS)
  );

  if (daysAgo === 0) return 'Bugün doğrulandı';
  if (daysAgo === 1) return 'Dün doğrulandı';
  return `${daysAgo} gün önce doğrulandı`;
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
    ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 ? 1 : 0)} kg`
    : `${weightGrams} g`;
}

function startOfTurkeyDay(date: Date) {
  const parts = turkeyDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
