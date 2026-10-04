import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { DiscoveryEmpty, DiscoveryGrid } from '@/components/v2/discovery-card';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { brand } from '@/lib/brand';
import { JsonLd } from '@/components/layout/json-ld';
import { absoluteUrl } from '@/lib/site';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { RoasterInitial } from '@/components/v2/discovery-detail';
import { getCatalogCounts, listCatalog, listRoasters, type CatalogCoffee, type CatalogRoaster } from '../../shared/v2/catalog';

// Matches the 5-minute D1 read cache: the edge may serve a page this stale, never older.
export const revalidate = 300;
export const metadata: Metadata = { title: { absolute: brand.title }, description: brand.description, alternates: { canonical: '/' } };

const HOW_IT_WORKS = [
  ['Her gün tararız', 'Kavurucuların mağazalarını her gün okuruz. Satıştan kalkan kahve listeden düşer.'],
  ['Olduğu gibi yazarız', 'Köken, işlem, varyete ve kavrum kavurucunun sayfasından gelir; çıkarım yaptıysak belirtiriz. Bilmediğimizi boş bırakırız.'],
  ['Kavurucuya göndeririz', 'Burada satış yok. Beğendiğin kahveyi kavurucunun kendi sitesinden alırsın.'],
] as const;

function FeedSection({ title, href, coffees }: { title: string; href: string; coffees: CatalogCoffee[] }) {
  if (!coffees.length) return null;
  return <section className="section-space border-t border-line"><div className="section-heading"><h2>{title}</h2><Link href={href} className="text-link">Tümünü gör ↗</Link></div><DiscoveryGrid coffees={coffees} source="home" /></section>;
}

export default async function HomePage() {
  let data: { counts: Awaited<ReturnType<typeof getCatalogCounts>>; catalog: CatalogCoffee[]; drops: CatalogCoffee[]; restocked: CatalogCoffee[]; roasters: CatalogRoaster[] } | null = null;
  try {
    const db = await getCatalogDatabase();
    // Server request time defines the verified-event window.
    // eslint-disable-next-line react-hooks/purity
    const since = new Date(Math.floor(Date.now() / 300000) * 300000 - 7 * 86400000).toISOString();
    const [counts, catalog, drops, restocked, roasters] = await Promise.all([
      getCatalogCounts(db), listCatalog(db, { sort: 'newest', perPage: 4 }),
      listCatalog(db, { event: 'PRICE_DROP', since, perPage: 4 }),
      listCatalog(db, { event: 'RESTOCKED', since, perPage: 4 }),
      listRoasters(db),
    ]);
    data = { counts, catalog: catalog.coffees, drops: drops.coffees, restocked: restocked.coffees, roasters };
  } catch (error) { unstable_rethrow(error); }
  return <div className="page-shell studio-home">
    <JsonLd data={{ '@type': 'Organization', name: brand.name, url: absoluteUrl('/'), logo: absoluteUrl(brand.logoPath), description: brand.description }} />
    <section className="studio-hero">
      <div className="studio-hero-copy">
        <p className="eyebrow">Türkiye’nin bağımsız kahve rehberi</p>
        <h1>İyi bir kahve.<br /><em>Senin damak tadın.</em></h1>
        <p className="studio-intro">Her çekirdeğin bir hikâyesi, her fincanın bir karakteri var. Sana uygun kahveyi keşfet, doğrudan kavurucusundan al.</p>
        <div className="studio-actions"><Link href="/quiz" className="button-dark button-lg">Kahvemi bul</Link><Link href="/kahveler" className="button-light button-lg">Kataloğu keşfet</Link></div>
        <p className="studio-small">4 kısa soru · Damak tadına göre keşif</p>
      </div>
      {/* Mount point for the hero scene (three.js, owned by the animation pass). Intentionally empty. */}
      <div className="hero-scene" data-scene-slot="home-hero" aria-hidden="true" />
    </section>
    <nav className="studio-paths" aria-label="Kahveni keşfet">
      <Link href="/quiz"><span className="studio-path-number">01</span><div><strong>Damak tadını keşfet</strong><p>Kısa bir testle başla.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/yeni"><span className="studio-path-number">02</span><div><strong>Yeni kahvelere bak</strong><p>Kataloğun son keşifleri.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/kahveler"><span className="studio-path-number">03</span><div><strong>Kendi kahveni seç</strong><p>Tat, köken ve paket fiyatı.</p></div><span aria-hidden="true">↗</span></Link>
    </nav>
    <section className="mt-10 rounded-[18px] border border-line bg-surface p-6 sm:p-10" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="mb-6 font-display text-[30px] sm:text-[34px]">Nasıl çalışır</h2>
      <ol className="grid gap-8 md:grid-cols-3">{HOW_IT_WORKS.map(([title, body], index) => <li key={title} className="flex flex-col gap-2"><span className="font-display text-[40px] leading-none text-warm">{index + 1}</span><span className="font-display text-[23px]">{title}</span><span className="text-[15px] leading-relaxed text-muted">{body}</span></li>)}</ol>
    </section>
    {data ? <>
      <section className="section-space studio-latest">
        <div className="section-heading"><div><p className="eyebrow">Keşif defteri</p><h2>Yeni keşifler.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted">Farklı kavuruculardan, farklı karakterlerde çekirdekler. Bir sonraki favorini bul.</p></div><Link href="/yeni" className="text-link">Tümünü keşfet ↗</Link></div>
        {data.catalog.length ? <DiscoveryGrid coffees={data.catalog} source="home" /> : <DiscoveryEmpty>Henüz satışta bir kahve yok. Yeni paketler eklendiğinde burada bulacaksın.</DiscoveryEmpty>}
        <div className="studio-counts"><span><strong>{data.counts.coffees.toLocaleString('tr-TR')}</strong> kahve</span><span><strong>{data.counts.roasters}</strong> kavurucu</span><p>Tek bir yerde. Kendi fiyatlarıyla.</p></div>
      </section>
      <FeedSection title="Fiyatı düşenler." href="/firsatlar" coffees={data.drops} />
      <FeedSection title="Tekrar raflarda." href="/yeni?event=RESTOCKED" coffees={data.restocked} />
      {data.roasters.length ? <section className="section-space"><div className="section-heading"><h2>Kavurucular.</h2><Link href="/kavurucular" className="text-link">{data.roasters.length} kavurucunun hepsi →</Link></div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">{[...data.roasters].sort((a, b) => b.coffeeCount - a.coffeeCount).slice(0, 8).map(roaster => <li key={roaster.id}><Link href={`/kavurucu/${roaster.slug}`} className="flex min-h-11 items-center gap-3.5 rounded-[14px] border border-line bg-surface px-[18px] py-4 hover:border-accent"><RoasterInitial name={roaster.name} size="sm" /><span><span className="block font-display text-lg">{roaster.name}</span><span className="text-[13px] text-muted">{roaster.city || 'Bağımsız kavurucu'}</span></span></Link></li>)}</ul>
      </section> : null}
    </> : <section className="section-space"><DataSourceNotice title="Kahveler şu an yüklenemiyor." message="Katalog bağlantısına ulaşamadık. Yeniden deneyebilir veya damak tadını keşfetmek için testi çözebilirsin." actionHref="/kahveler" actionLabel="Kataloğu yeniden aç" /></section>}
    <section className="studio-journal"><div><p className="eyebrow">Kahve molası</p><h2>Güzel kahve,<br /><em>küçük bir ritüel.</em></h2><p>Çekirdeğini seçtin. Şimdi doğru oranı bul, suyunu hazırla ve kendi fincanını demle.</p><Link href="/guide#calculator" className="text-link">Demleme rehberine git ↗</Link></div><NewsletterForm source="home-bottom" /></section>
  </div>;
}
