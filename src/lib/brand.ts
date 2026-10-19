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
  // One signup, two sends. newsletterName/Promise describe the weekly digest (scripts/v2-digest.mts reads them).
  newsletterName: 'Haftalık Drop',
  newsletterPromise: 'Fiyatı düşen ve yeni gelen kahveler, haftada bir.',
  monthlyName: `${name} Mektup`,
  signupPromise: 'Ayın favori kahveleri, sahneden haberler ve etkinlikler ayda bir. Fiyatı düşenler ve yeni gelenler haftada bir. İstediğin an çıkarsın.',
  emailSourceName: process.env.NEXT_PUBLIC_EMAIL_SOURCE_NAME || name,
  analyticsSource: process.env.NEXT_PUBLIC_ANALYTICS_SOURCE || 'kahvedrop',
  logoPath: process.env.NEXT_PUBLIC_BRAND_LOGO || '/brand-mark.svg',
  social: { title: `${name} · Damak tadına göre kahve keşfet`, description, image: '/opengraph-image' },
  production,
} as const;

/**
 * The studio that makes KahveDrop. The footer's "Basalt'tan diğerleri" column uses it; structured data uses studioOrganization below.
 * Follows the shared Basalt footer spec: live products only, Turkish products first, never this product, X and YouTube last.
 */
export const studio = {
  name: 'Basalt',
  url: 'https://hellobasalt.dev/',
  supportEmail: 'support@hellobasalt.dev',
  x: 'https://x.com/hellobasalt',
  youtube: 'https://www.youtube.com/@hellobasalt',
  products: [
    { label: "Göçmeden, Türkiye'ye açık remote işler", url: 'https://gocmeden.hellobasalt.dev/' },
    { label: 'Kaç Papel?, fiyat hafızası oyunu', url: 'https://kacpapel.app/' },
    { label: 'Upright, ücretsiz fare uygulaması (Mac)', url: 'https://upright.hellobasalt.dev/' },
    { label: 'Lull, yakında', url: 'https://lull.hellobasalt.dev/' },
    { label: 'Cosmic Post, uzay fotoğrafı hatıraları', url: 'https://cosmicpost.lol/' },
    { label: 'ByeWall, arşivlenmiş sayfaları bul', url: 'https://byewall.hellobasalt.dev/' },
    { label: 'Outcrop, yazılım üreticileri için SEO', url: 'https://outcrop.hellobasalt.dev/' },
  ],
} as const;

/**
 * The shared Basalt Studio node, identical on every Basalt site, so search engines and AI assistants
 * join the products to one parent company. KahveDrop's own Organization points at it as parentOrganization.
 */
export const studioOrganization = {
  '@type': 'Organization',
  '@id': 'https://hellobasalt.dev/#org',
  name: 'Basalt Studio',
  alternateName: 'Basalt',
  url: 'https://hellobasalt.dev/',
  sameAs: ['https://x.com/hellobasalt', 'https://www.youtube.com/@hellobasalt'],
} as const;

/** Wording shown beside the checkbox and the version stored in Kit with the signup. Change the text only together with the version. */
export const newsletterConsent = {
  version: '2026-10-v1',
  text: 'Aylık bülteni ve haftalık fiyat özetini almayı kabul ediyorum. Aydınlatma metnini okudum.',
  linkText: 'Aydınlatma metnini',
} as const;
