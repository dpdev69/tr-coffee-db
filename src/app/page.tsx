import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { CoffeeScene } from '@/components/v2/coffee-scene';
import { DiscoveryEmpty, DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { brand } from '@/lib/brand';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getCatalogCounts, listCatalog, type CatalogCoffee } from '../../shared/v2/catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { absolute: brand.title }, description: brand.description, alternates: { canonical: '/' } };

function FeedSection({ title, href, coffees }: { title: string; href: string; coffees: CatalogCoffee[] }) {
  if (!coffees.length) return null;
  return <section className="section-space border-t border-[#dedfd7]"><div className="section-heading"><h2>{title}</h2><Link href={href} className="text-link">Tümünü gör ↗</Link></div><DiscoveryGrid coffees={coffees} source="home" /></section>;
}

export default async function HomePage() {
  let data: { counts: Awaited<ReturnType<typeof getCatalogCounts>>; catalog: CatalogCoffee[]; drops: CatalogCoffee[]; restocked: CatalogCoffee[] } | null = null;
  try {
    const db = await getCatalogDatabase();
    // Server request time defines the verified-event window.
    // eslint-disable-next-line react-hooks/purity
    const since = new Date(Math.floor(Date.now() / 300000) * 300000 - 7 * 86400000).toISOString();
    const [counts, catalog, drops, restocked] = await Promise.all([
      getCatalogCounts(db), listCatalog(db, { sort: 'newest', perPage: 4 }),
      listCatalog(db, { event: 'PRICE_DROP', since, perPage: 4 }),
      listCatalog(db, { event: 'RESTOCKED', since, perPage: 4 }),
    ]);
    data = { counts, catalog: catalog.coffees, drops: drops.coffees, restocked: restocked.coffees };
  } catch (error) { unstable_rethrow(error); }
  return <div className="page-shell studio-home">
    <section className="studio-hero">
      <CoffeeScene className="studio-background" />
      <div className="studio-hero-copy">
        <p className="eyebrow">Türkiye’nin bağımsız kahve rehberi</p>
        <h1>İyi bir kahve.<br /><em>Senin damak tadın.</em></h1>
        <p className="studio-intro">Her çekirdeğin bir hikâyesi, her fincanın bir karakteri var. Sana uygun kahveyi keşfet, doğrudan kavurucusundan al.</p>
        <div className="studio-actions"><Link href="/quiz" className="button-dark">Kahvemi bul <span aria-hidden="true">↗</span></Link><Link href="/kahveler" className="text-link">Kataloğu keşfet →</Link></div>
        <p className="studio-small">4 kısa soru · Damak tadına göre keşif</p>
      </div>

    </section>
    <nav className="studio-paths" aria-label="Kahveni keşfet">
      <Link href="/quiz"><span className="studio-path-number">01</span><div><strong>Damak tadını keşfet</strong><p>Kısa bir testle başla.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/yeni"><span className="studio-path-number">02</span><div><strong>Yeni kahvelere bak</strong><p>Kataloğun son keşifleri.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/kahveler"><span className="studio-path-number">03</span><div><strong>Kendi kahveni seç</strong><p>Tat, köken ve paket fiyatı.</p></div><span aria-hidden="true">↗</span></Link>
    </nav>
    {data ? <>
      <section className="section-space studio-latest">
        <div className="section-heading"><div><p className="eyebrow">Keşif defteri</p><h2>Yeni keşifler.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-[#625e57]">Farklı kavuruculardan, farklı karakterlerde çekirdekler. Bir sonraki favorini bul.</p></div><Link href="/yeni" className="text-link">Tümünü keşfet ↗</Link></div>
        {data.catalog.length ? <DiscoveryGrid coffees={data.catalog} source="home" /> : <DiscoveryEmpty>Henüz satışta bir kahve yok. Yeni paketler eklendiğinde burada bulacaksın.</DiscoveryEmpty>}
        <div className="studio-counts"><span><strong>{data.counts.coffees.toLocaleString('tr-TR')}</strong> kahve</span><span><strong>{data.counts.roasters}</strong> kavurucu</span><p>Tek bir yerde. Kendi fiyatlarıyla.</p></div>
      </section>
      <FeedSection title="Fiyatı düşenler." href="/firsatlar?event=PRICE_DROP" coffees={data.drops} />
      <FeedSection title="Tekrar raflarda." href="/yeni?event=RESTOCKED" coffees={data.restocked} />
    </> : <section className="section-space"><DataSourceNotice title="Kahveler şu an yüklenemiyor." message="Katalog bağlantısına ulaşamadık. Yeniden deneyebilir veya damak tadını keşfetmek için testi çözebilirsin." actionHref="/kahveler" actionLabel="Kataloğu yeniden aç" /></section>}
    <section className="studio-journal"><div><p className="eyebrow">Kahve molası</p><h2>Güzel kahve,<br /><em>küçük bir ritüel.</em></h2><p>Çekirdeğini seçtin. Şimdi doğru oranı bul, suyunu hazırla ve kendi fincanını demle.</p><Link href="/guide#calculator" className="text-link">Demleme rehberine git ↗</Link></div><NewsletterForm source="home-bottom" /></section>
  </div>;
}
