export const SITE_NAME = 'TR CoffeeDB';

export const SITE_DESCRIPTION =
  "Türkiye'deki bağımsız kavurucuların güncel nitelikli kahvelerini tek yerde karşılaştırın. Köken, işleme, kavrum, tat ve 100 g fiyatıyla filtreleyin; satın alma doğrudan kavurucuda tamamlanır.";

export const SITE_KEYWORDS = [
  'nitelikli kahve',
  'Türkiye kahve kavurucuları',
  'kahve karşılaştırma',
  'kahve çekirdeği',
  'bağımsız kavurucu',
  'specialty coffee Turkey',
  'kahve fiyati',
  '100 g kahve fiyati',
];

export const SITE_URL = getSiteUrl();

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    'https://tr-coffee-db.vercel.app';

  const withProtocol = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  return new URL(withProtocol);
}
