import { pageMetadata } from '@/lib/page-metadata';
import { DetailViewTracker } from '@/components/v2/product-tracking';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, unstable_rethrow } from 'next/navigation';
import { DiscoveryDetail } from '@/components/v2/discovery-detail';
import { DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getCoffeeDetail, getSimilarCoffees } from '../../../../shared/v2/catalog';

const loadCoffee = cache(async (slug: string) => {
  try { return { coffee: await getCoffeeDetail(await getCatalogDatabase(), slug), unavailable: false }; }
  catch (error) { unstable_rethrow(error); return { coffee: null, unavailable: true }; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { coffee } = await loadCoffee((await params).slug);
  return coffee ? pageMetadata(`${coffee.name} · ${coffee.roaster.name}`, `${coffee.name} için kavurucunun paketlerini, fiyatlarını ve çekirdek bilgilerini keşfet.`, `/kahve/${coffee.slug}`) : { ...pageMetadata('Kahve bulunamadı', 'Bu kahve artık katalogda bulunmuyor. Diğer çekirdekleri keşfet.', '/kahveler'), robots: { index: false } };
}
export default async function CoffeePage({ params }: { params: Promise<{ slug: string }> }) {
  const { coffee, unavailable } = await loadCoffee((await params).slug);
  if (unavailable) return <div className="page-shell section-space"><DataSourceNotice title="Kahve bilgileri şu an yüklenemiyor." message="Fiyat ve stok bilgisini doğrulayamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/kahveler" actionLabel="Kataloğa dön" /></div>;
  if (!coffee) notFound();
  let similar: Awaited<ReturnType<typeof getSimilarCoffees>> = [];
  try { similar = await getSimilarCoffees(await getCatalogDatabase(), coffee); }
  catch (error) { unstable_rethrow(error); }
  return <div className="page-shell section-space">
    <DetailViewTracker coffeeId={coffee.id} />
    <DiscoveryDetail coffee={coffee} />
    {similar.length > 0 ? <section className="mt-14"><p className="eyebrow">Keşfe devam</p><h2 className="mt-2 font-display text-3xl">Benzer çekirdekler.</h2><p className="mb-6 mt-3 text-sm text-[#625e57]">Paylaşılan köken, işlem veya tat bilgilerine göre seçildi.</p><DiscoveryGrid coffees={similar} source="similar" /></section> : null}
  </div>;
}
