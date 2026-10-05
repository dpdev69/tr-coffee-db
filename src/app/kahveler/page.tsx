import { catalogLanding, listingMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';
import { LandingLinks, listLandings, type LandingWithFacts } from '@/lib/catalog-landing';

export async function generateMetadata({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }): Promise<Metadata> {
  return listingMetadata('Kahveler', 'Türkiye’nin nitelikli kahvelerini köken, işlem, tat ve paket fiyatıyla keşfet. Siparişini doğrudan kavurucudan ver.', '/kahveler', await searchParams, catalogLanding);
}
export default async function CoffeesPage({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }) {
  const params = await searchParams;
  dropTrackingParams('/kahveler', params);
  let landings: LandingWithFacts[] = [];
  try { landings = await listLandings(await getCatalogDatabase()); } catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); }
  return <div className="page-shell section-space"><div className="section-heading"><div><p className="eyebrow">Katalog</p><h1 className="mt-3 font-display text-title">Bir sonraki kahven.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Tatla başla, paketleri karşılaştır. İlgini çekeni doğrudan kavurucuda incele.</p></div></div><DiscoveryCatalog params={await searchParams} /><LandingLinks landings={landings} />{signupsEnabled() && <NewsletterForm source="catalog" variant="card" className="mt-12" title="Aradığın kahve bugün yoksa" description="Yeni gelenleri ve fiyatı düşenleri haftada bir, ayın seçkisini ayda bir gönderelim." />}</div>;
}
