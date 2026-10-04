import { pageMetadata } from '@/lib/page-metadata';
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { DiscoveryEmpty, DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getRoasterDetail } from '../../../../shared/v2/catalog';

const loadRoaster = cache(async (slug: string) => {
  try { return { result: await getRoasterDetail(await getCatalogDatabase(), slug), unavailable: false }; }
  catch (error) { unstable_rethrow(error); return { result: null, unavailable: true }; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { result } = await loadRoaster((await params).slug);
  return result ? pageMetadata(`${result.roaster.name} kahveleri`, `${result.roaster.name} çekirdeklerini, paketlerini ve fiyatlarını keşfet.`, `/kavurucu/${result.roaster.slug}`) : { ...pageMetadata('Kavurucu bulunamadı', 'Bu kavurucu bulunamadı. Türkiye’nin bağımsız kavurucularını keşfet.', '/kavurucular'), robots: { index: false } };
}
export default async function RoasterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { result, unavailable } = await loadRoaster((await params).slug);
  if (unavailable) return <div className="page-shell section-space"><DataSourceNotice title="Kavurucu bilgileri şu an yüklenemiyor." message="Biraz sonra yeniden deneyebilirsin." actionHref="/kavurucular" actionLabel="Kavuruculara dön" /></div>;
  if (!result) notFound();
  const { roaster, catalog } = result;
  return <div className="page-shell section-space"><Link href="/kavurucular" className="text-sm underline underline-offset-4">← Kavurucular</Link><p className="eyebrow mt-8">{roaster.city || 'Bağımsız kavurucu'}</p><h1 className="mt-3 font-display text-5xl">{roaster.name}</h1><p className="mb-9 mt-4 text-sm leading-7 text-muted">Satışta {roaster.coffeeCount} kahve, {roaster.offerCount} paket. Sipariş kavurucunun sitesinde tamamlanır.</p>
    {catalog.coffees.length ? <DiscoveryGrid coffees={catalog.coffees} /> : <DiscoveryEmpty title="Şu an satışta doğrulanmış bir kahve yok.">Kavurucunun sayfasını koruyoruz. Yeniden satışa çıkan kahveler burada yer alacak.</DiscoveryEmpty>}
    {catalog.total > catalog.coffees.length ? <div className="mt-8 text-center"><Link className="button-dark" href={`/kahveler?roaster=${encodeURIComponent(roaster.slug)}`}>Tüm {catalog.total} kahveyi gör →</Link></div> : null}
  </div>;
}
