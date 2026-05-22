export function formatVerifiedAt(value: string | null, now = new Date()) {
  if (!value) return 'Doğrulama bekliyor';

  const verifiedAt = new Date(value);
  if (Number.isNaN(verifiedAt.getTime())) return 'Doğrulama bekliyor';

  const startOfToday = startOfDay(now);
  const startOfVerifiedDay = startOfDay(verifiedAt);
  const daysAgo = Math.max(
    0,
    Math.floor((startOfToday.getTime() - startOfVerifiedDay.getTime()) / 86_400_000)
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
