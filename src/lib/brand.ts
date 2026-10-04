/** Provisional identity. Configure the owned public domain at production cutover. */
const name = process.env.NEXT_PUBLIC_BRAND_NAME || 'KahveDrop';
const description = "Türkiye'nin bağımsız kavurucularından damak tadına uygun kahveleri keşfet. Tatları, kökenleri ve kavurucunun paket fiyatlarını karşılaştır.";
// Workers read the runtime wrangler var; NEXT_PUBLIC_ remains for non-Workers builds.
const production = (process.env.DEPLOYMENT_STAGE || process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE) === 'production';
// Production must never silently advertise the staging host as its canonical origin.
if (production && !process.env.NEXT_PUBLIC_SITE_URL) throw new Error('NEXT_PUBLIC_SITE_URL is required when DEPLOYMENT_STAGE=production.');
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
  production,
} as const;
