import { coffeeMetadata, pageMetadata } from '@/lib/page-metadata';
import { DetailViewTracker } from '@/components/v2/product-tracking';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, unstable_rethrow } from 'next/navigation';
import { DiscoveryDetail } from '@/components/v2/discovery-detail';
import { DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';
import { getCoffeeDetail, getSimilarCoffees } from '../../../../shared/v2/catalog';
import { JsonLd, breadcrumbList, productJsonLd } from '@/components/layout/json-ld';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { ComparisonLinks, coffeeSides } from '@/components/v2/comparison-links';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;
const loadCoffee = cache(async (slug: string) => {
  try { return { coffee: await getCoffeeDetail(await getCatalogDatabase(), slug), unavailable: false }; }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return { coffee: null, unavailable: true }; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { coffee } = await loadCoffee((await params).slug);
  if (!coffee) return { ...pageMetadata('Kahve bulunamadı', 'Bu kahve artık katalogda bulunmuyor. Diğer çekirdekleri keşfet.', '/kahveler'), robots: { index: false } };
  const { title, description, image } = coffeeMetadata(coffee);
  return pageMetadata(title, description, `/kahve/${coffee.slug}`, { type: 'product', image });
}
export default async function CoffeePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  dropTrackingParams(`/kahve/${encodeURIComponent(slug)}`, await searchParams);
  const { coffee, unavailable } = await loadCoffee(slug);
  if (unavailable) return <div className="page-shell section-space"><DataSourceNotice title="Kahve bilgileri şu an yüklenemiyor." message="Fiyat ve stok bilgisini doğrulayamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/kahveler" actionLabel="Kataloğa dön" /></div>;
  if (!coffee) notFound();
  // A grouped child coffee resolves to its parent; send people and crawlers to the parent's URL.
  if (coffee.slug !== slug) permanentRedirect(`/kahve/${encodeURIComponent(coffee.slug)}`);
  let similar: Awaited<ReturnType<typeof getSimilarCoffees>> = [];
  try { similar = await getSimilarCoffees(await getCatalogDatabase(), coffee); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); }
  return <div className="page-shell section-space">
    <DetailViewTracker coffeeId={coffee.id} />
    <JsonLd data={productJsonLd(coffee)} />
    <JsonLd data={breadcrumbList([['Kahveler', '/kahveler'], [coffee.roaster.name, `/kavurucu/${coffee.roaster.slug}`], [coffee.name, `/kahve/${coffee.slug}`]])} />
    <DiscoveryDetail coffee={coffee} />
    {similar.length > 0 ? <section className="mt-14"><p className="eyebrow">Keşfe devam</p><h2 className="mt-2 font-display text-subtitle">Benzer çekirdekler.</h2><p className="mb-6 mt-3 text-sm text-muted">Paylaşılan köken, işlem veya tat bilgilerine göre seçildi.</p><DiscoveryGrid coffees={similar} source="similar" /></section> : null}
    <ComparisonLinks side={coffeeSides(coffee)} className="mt-14" />
    {signupsEnabled() && <NewsletterForm source="detail" variant="card" className="mt-14" title="Bu kahvenin fiyatı düşerse" description="Haftalık fiyat özetinde ve aylık bültende haber veririz." />}
  </div>;
}
