/** Provisional identity. Configure the owned public domain at production cutover. */
const name = process.env.NEXT_PUBLIC_BRAND_NAME || 'KahveDrop';
const description = "Türkiye'nin bağımsız kavurucularından damak tadına uygun kahveleri keşfet. Tatları, kökenleri ve kavurucunun paket fiyatlarını karşılaştır.";
export const brand = {
  name,
  domain: process.env.NEXT_PUBLIC_SITE_URL || 'https://coffeedb-v2-web-staging.hellobasalt.workers.dev',
  title: `${name} · Damak tadına göre kahve keşfet`,
  description,
  newsletterName: 'Haftalık Drop',
  newsletterPromise: 'Yeni çıkan kahveler ve gerçekten iyi fırsatlar, haftada bir.',
  emailSourceName: process.env.NEXT_PUBLIC_EMAIL_SOURCE_NAME || name,
  analyticsSource: process.env.NEXT_PUBLIC_ANALYTICS_SOURCE || 'kahvedrop',
  logoPath: process.env.NEXT_PUBLIC_BRAND_LOGO || '/brand-mark.svg',
  social: { title: `${name} · Damak tadına göre kahve keşfet`, description, image: '/opengraph-image' },
  production: process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'production',
} as const;
