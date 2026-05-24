export const SITE_NAME = 'TR CoffeeDB';

export const SITE_DESCRIPTION =
  "Türkiye'deki bağımsız kavurucuların güncel nitelikli kahvelerini tek yerde keşfedin. Köken, işleme, kavrum, tat notu ve kavurucunun verdiği fiyatla filtreleyin; beğendiğiniz çekirdekte kavurucunun sitesine geçin.";

export const SITE_KEYWORDS = [
  'nitelikli kahve',
  'Türkiye kahve kavurucuları',
  'kahve keşif rehberi',
  'kahve çekirdeği',
  'bağımsız kavurucu',
  'specialty coffee Turkey',
  'kahve fiyati',
  'kahve katalog fiyati',
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
