import { brand } from './brand';

export const SITE_NAME = brand.name;

export const SITE_DESCRIPTION = brand.description;

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
    brand.domain;

  const withProtocol = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  return new URL(withProtocol);
}
