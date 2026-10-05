import { coffeeMetadata, pageMetadata } from '@/lib/page-metadata';
import { DetailViewTracker } from '@/components/v2/product-tracking';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, unstable_rethrow } from 'next/navigation';
import { DiscoveryDetail } from '@/components/v2/discovery-detail';
import { DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getCoffeeDetail, getSimilarCoffees } from '../../../../shared/v2/catalog';
import { JsonLd, breadcrumbList, productJsonLd } from '@/components/layout/json-ld';
import { NewsletterForm } from '@/components/v2/newsletter-form';

// Matches the 5-minute D1 read cache: the edge may serve a page this stale, never older.
export const revalidate = 300;
const loadCoffee = cache(async (slug: string) => {
  try { return { coffee: await getCoffeeDetail(await getCatalogDatabase(), slug), unavailable: false }; }
  catch (error) { unstable_rethrow(error); return { coffee: null, unavailable: true }; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { coffee } = await loadCoffee((await params).slug);
  if (!coffee) return { ...pageMetadata('Kahve bulunamadı', 'Bu kahve artık katalogda bulunmuyor. Diğer çekirdekleri keşfet.', '/kahveler'), robots: { index: false } };
  const { title, description, image } = coffeeMetadata(coffee);
  return pageMetadata(title, description, `/kahve/${coffee.slug}`, { type: 'product', image });
}
export default async function CoffeePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { coffee, unavailable } = await loadCoffee(slug);
  if (unavailable) return <div className="page-shell section-space"><DataSourceNotice title="Kahve bilgileri şu an yüklenemiyor." message="Fiyat ve stok bilgisini doğrulayamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/kahveler" actionLabel="Kataloğa dön" /></div>;
  if (!coffee) notFound();
  // A grouped child coffee resolves to its parent; send people and crawlers to the parent's URL.
  if (coffee.slug !== slug) permanentRedirect(`/kahve/${encodeURIComponent(coffee.slug)}`);
  let similar: Awaited<ReturnType<typeof getSimilarCoffees>> = [];
  try { similar = await getSimilarCoffees(await getCatalogDatabase(), coffee); }
  catch (error) { unstable_rethrow(error); }
  return <div className="page-shell section-space">
    <DetailViewTracker coffeeId={coffee.id} />
    <JsonLd data={productJsonLd(coffee)} />
    <JsonLd data={breadcrumbList([['Kahveler', '/kahveler'], [coffee.roaster.name, `/kavurucu/${coffee.roaster.slug}`], [coffee.name, `/kahve/${coffee.slug}`]])} />
    <DiscoveryDetail coffee={coffee} />
    {similar.length > 0 ? <section className="mt-14"><p className="eyebrow">Keşfe devam</p><h2 className="mt-2 font-display text-3xl">Benzer çekirdekler.</h2><p className="mb-6 mt-3 text-sm text-muted">Paylaşılan köken, işlem veya tat bilgilerine göre seçildi.</p><DiscoveryGrid coffees={similar} source="similar" /></section> : null}
    <NewsletterForm source="detail" variant="card" className="mt-14" title="Bu kahvenin fiyatı düşerse" description="Haftalık fiyat özetinde ve aylık bültende haber veririz." />
  </div>;
}
