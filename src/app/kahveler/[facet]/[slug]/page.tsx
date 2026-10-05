import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, unstable_rethrow } from 'next/navigation';
import { JsonLd, breadcrumbList } from '@/components/layout/json-ld';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { findLanding, landingFacts, landingHeading, landingPhrase, type Landing } from '@/lib/catalog-landing';
import { listingMetadata } from '@/lib/page-metadata';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

type Props = { params: Promise<{ facet: string; slug: string }>; searchParams: Promise<DiscoverySearchParams> };

/** The catalog with one origin or process preset: same filter, same cards, its own address and copy. */
const loadFacts = cache(async (landing: Landing) => {
  try { return await landingFacts(await getCatalogDatabase(), landing); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return null; }
});
async function resolve(params: Props['params']) {
  const { facet, slug } = await params;
  const landing = findLanding(facet, slug);
  return landing ? { landing, facts: await loadFacts(landing) } : null;
}
const preset = (landing: Landing): DiscoverySearchParams => landing.facet === 'koken' ? { origin: landing.value } : { process: landing.value };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const resolved = await resolve(params);
  // notFound() here would answer 200 on vinext; the page throws it and gets the 404 status.
  if (!resolved) return { title: 'Sayfa bulunamadı', robots: { index: false } };
  const { landing, facts } = resolved;
  const phrase = landingPhrase(landing);
  const description = facts?.coffees
    ? `${facts.roasters} kavurucudan ${phrase} ${facts.coffees} kahve: tadım notları, kavrum ve paket fiyatları tek listede. Siparişini doğrudan kavurucudan ver.`
    : `${phrase.charAt(0).toLocaleUpperCase('tr-TR')}${phrase.slice(1)} kahveler: tadım notları, kavrum ve paket fiyatları. Siparişini doğrudan kavurucudan ver.`;
  const metadata = listingMetadata(`${landing.label}${landing.facet === 'koken' ? '' : ' işlemli'} kahve çekirdekleri`, description, landing.path, await searchParams);
  // A known origin or process with nothing on sale today keeps its address (coffee pages link to it) but stays out of the index.
  return facts && facts.coffees === 0 ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function LandingPage({ params, searchParams }: Props) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { landing, facts } = resolved;
  const query = await searchParams;
  dropTrackingParams(landing.path, query);
  const heading = landingHeading(landing);
  return <div className="page-shell section-space">
    <JsonLd data={breadcrumbList([['Kahveler', '/kahveler'], [heading, landing.path]])} />
    <nav aria-label="İçerik yolu" className="mb-3 text-sm"><Link href="/kahveler" className="inline-flex min-h-11 items-center text-accent hover:underline">← Tüm kahveler</Link></nav>
    <div className="section-heading"><div><p className="eyebrow">{landing.facet === 'koken' ? 'Köken' : 'İşlem'}</p><h1 className="mt-3 font-display text-5xl">{heading}</h1>
      {facts?.coffees ? <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Şu an {facts.roasters} kavurucudan {landingPhrase(landing)} {facts.coffees} kahve listede. {landing.facet === 'koken' ? 'Köken' : 'İşlem'} bilgisi kavurucunun sayfasından gelir; kavurucu belirtmediyse ürün açıklamasından çıkarılmış olabilir.</p> : null}</div></div>
    <DiscoveryCatalog params={query} path={landing.path} preset={preset(landing)} />
    {signupsEnabled() && <NewsletterForm source="catalog" variant="card" className="mt-12" title="Yeni gelenleri kaçırma" description="Yeni gelenleri ve fiyatı düşenleri haftada bir, ayın seçkisini ayda bir gönderelim." />}
  </div>;
}
