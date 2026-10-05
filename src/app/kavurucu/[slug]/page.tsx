import { pageMetadata, roasterDescription } from '@/lib/page-metadata';
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { DiscoveryEmpty, DiscoveryGrid } from '@/components/v2/discovery-card';
import { RoasterInitial } from '@/components/v2/discovery-detail';
import { JsonLd, breadcrumbList, itemList } from '@/components/layout/json-ld';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getRoasterDetail } from '../../../../shared/v2/catalog';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { roasterSiteUrl } from '../../../../shared/v2/outbound';

// Matches the 5-minute D1 read cache: the edge may serve a page this stale, never older.
export const revalidate = 300;
const loadRoaster = cache(async (slug: string) => {
  try {
    const db = await getCatalogDatabase();
    // The site link is rendered only when the same check the redirect makes passes now.
    const [result, site] = await Promise.all([getRoasterDetail(db, slug), roasterSiteUrl(db, slug)]);
    return { result, site, hasSite: Boolean(site), unavailable: false };
  }
  catch (error) { unstable_rethrow(error); return { result: null, site: null, hasSite: false, unavailable: true }; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { result } = await loadRoaster((await params).slug);
  if (!result) return { ...pageMetadata('Kavurucu bulunamadı', 'Bu kavurucu bulunamadı. Türkiye’nin bağımsız kavurucularını keşfet.', '/kavurucular'), robots: { index: false } };
  const metadata = pageMetadata(`${result.roaster.name} kahveleri`, roasterDescription(result.roaster, result.catalog.coffees), `/kavurucu/${result.roaster.slug}`);
  // An inactive roaster, or one with nothing on sale, keeps its page for old links but leaves the index (and the sitemap).
  return result.roaster.coffeeCount ? metadata : { ...metadata, robots: { index: false, follow: true } };
}
export default async function RoasterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { result, site, hasSite, unavailable } = await loadRoaster((await params).slug);
  if (unavailable) return <div className="page-shell section-space"><DataSourceNotice title="Kavurucu bilgileri şu an yüklenemiyor." message="Biraz sonra yeniden deneyebilirsin." actionHref="/kavurucular" actionLabel="Kavuruculara dön" /></div>;
  if (!result) notFound();
  const { roaster, catalog } = result;
  return <div className="page-shell section-space pt-4">
    <JsonLd data={breadcrumbList([['Kavurucular', '/kavurucular'], [roaster.name, `/kavurucu/${roaster.slug}`]])} />
    {/* The roaster's own site, as the validated redirect resolves it, without our referral tags. */}
    <JsonLd data={{ '@type': 'Organization', name: roaster.name, ...(roaster.city ? { address: { '@type': 'PostalAddress', addressLocality: roaster.city } } : {}), ...(site ? { url: new URL(site).origin } : {}) }} />
    {catalog.coffees.length ? <JsonLd data={itemList(catalog.coffees.map(coffee => [coffee.name, `/kahve/${coffee.slug}`]), { total: catalog.total })} /> : null}
    <nav aria-label="İçerik yolu" className="mb-3 text-sm"><Link href="/kavurucular" className="inline-flex min-h-11 items-center text-accent hover:underline">← Kavurucular</Link></nav>
    <section className="mb-10 flex flex-wrap items-center gap-x-10 gap-y-6"><RoasterInitial name={roaster.name} size="lg"/><div className="min-w-0 flex-[1_1_360px]"><h1 className="mb-2 font-display text-[clamp(36px,4.4vw,56px)] leading-[1.05]">{roaster.name}</h1><p className="text-[17px] text-muted">{roaster.city || 'Bağımsız kavurucu'} · Satışta {roaster.coffeeCount} kahve, {roaster.offerCount} paket. Sipariş kavurucunun sitesinde tamamlanır.</p></div>{hasSite ? <a href={`/go/kavurucu/${roaster.slug}`} rel="nofollow" className="button-light">Kavurucunun sitesi <span aria-hidden="true">↗</span></a> : null}</section>
    <h2 className="sr-only">{roaster.name} kahveleri</h2>
    {catalog.coffees.length ? <DiscoveryGrid coffees={catalog.coffees} /> : <DiscoveryEmpty title="Şu an satışta doğrulanmış bir kahve yok.">Kavurucunun sayfasını koruyoruz. Yeniden satışa çıkan kahveler burada yer alacak.</DiscoveryEmpty>}
    {catalog.total > catalog.coffees.length ? <div className="mt-8 text-center"><Link className="button-dark" href={`/kahveler?roaster=${encodeURIComponent(roaster.slug)}`}>Tüm {catalog.total} kahveyi gör →</Link></div> : null}
    <NewsletterForm source="roaster" variant="card" className="mt-12" title="Bu kavurucudan yeni kahve gelince" description="Haftalık özet ve aylık bültende haber veririz." />
  </div>;
}
