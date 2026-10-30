import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { JsonLd, breadcrumbList, siteOrganization } from '@/components/layout/json-ld';
import { LandingLinks, listLandings, originLanding, type LandingWithFacts } from '@/lib/catalog-landing';
import { MIN_COFFEES, comparisonFacts, comparisonQuestion, findComparison, sideLabel, type ComparisonData, type SideRef } from '@/lib/comparisons';
import { BEAN_GUIDE_UPDATED } from '@/lib/content-dates';
import { pageMetadata } from '@/lib/page-metadata';
import { BEAN_GUIDE_PATH, BREW_GUIDE_PATH, FILTER_PAIR, FILTER_SIDE, MIN_STATED, faqPage, leading, lira, sideFacts, trDay, type Faq } from '@/lib/rehber';
import { absoluteUrl } from '@/lib/site';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;

const TITLE = 'En iyi filtre kahve çekirdeği: tadına göre seç';
const DESCRIPTION = 'En iyi filtre kahve çekirdeği hangisi? Marka sıralamıyoruz: Etiyopya, Kenya, Kolombiya ve Brezilya çekirdeklerini tada, kavruma ve paket fiyatına göre seç.';
export const metadata: Metadata = pageMetadata(TITLE, DESCRIPTION, BEAN_GUIDE_PATH, { type: 'article' });

const origin = (value: string): SideRef => ({ kind: 'origin', value });
/** Taste groups. The copy is the usual reputation of each origin; the numbers under it are today's coffees, which can differ. */
const GROUPS = [
  { id: 'meyvemsi', title: 'Meyvemsi ve çiçeksi bir fincan: Etiyopya ve Kenya',
    intro: 'Doğu Afrika çekirdekleri genellikle canlı asiditeleri, meyve (çilek, yaban mersini, narenciye) ve çiçek (yasemin, bergamot) notalarıyla anılır. Bu notalar açık ya da orta kavrumda, V60 ve Chemex gibi berrak fincan veren yöntemlerde daha kolay seçilir.',
    origins: [origin('Ethiopia'), origin('Kenya')],
    tastes: [['Fruity', 'Meyvemsi'], ['Floral', 'Çiçeksi']], compare: 'kenya-vs-etiyopya' },
  { id: 'cikolata', title: 'Çikolata, karamel ve kuruyemiş: Brezilya, Kolombiya ve Guatemala',
    intro: 'Latin Amerika çekirdekleri genellikle daha tatlı, gövdeli ve yumuşak içimli fincanlarla anılır: çikolata, karamel, kuruyemiş. Filtre kahveye yeni başlayanlar ve sütle içenler için iyi bir başlangıçtır. Nitelikli kavurucular aynı ülkelerden meyvemsi lotlar da seçer; satıştaki çekirdeklerin tat dağılımı aşağıda.',
    origins: [origin('Brazil'), origin('Colombia'), origin('Guatemala')],
    tastes: [['Chocolate', 'Çikolata'], ['Sweet', 'Tatlı, karamel'], ['Nutty', 'Kuruyemiş']], compare: 'kolombiya-vs-brezilya' },
] as const;

const ROASTS = [['light', 'Açık kavrum'], ['medium_light', 'Orta-açık kavrum'], ['medium', 'Orta kavrum']] as const;

const FAQ: (Faq & { link?: { href: string; label: string } })[] = [
  { question: 'En iyi filtre kahve hangisi?',
    answer: 'Herkes için tek bir en iyi filtre kahve yok. Meyvemsi ve çiçeksi bir fincan seviyorsan Etiyopya ve Kenya, çikolatalı ve tatlı bir fincan seviyorsan Brezilya ve Kolombiya çekirdekleriyle başla; filtre için açık ya da orta kavrum seç ve kavrum tarihi yakın bir paket al. KahveDrop markaları sıralamaz, satıştaki çekirdekleri tada ve kökene göre gösterir.' },
  { question: 'Filtre kahve için hangi çekirdek kullanılır?',
    answer: 'Filtre kahve için çoğunlukla açık ya da orta kavrulmuş arabica çekirdekler kullanılır. Kavurucular ürün sayfasında hangi demleme yöntemini önerdiğini yazar; filtre ya da pour over önerisi olan bir çekirdekle başlamak işini kolaylaştırır.' },
  { question: 'Filtre kahve markaları hangileri?',
    answer: 'Markette öğütülmüş filtre kahve satan büyük markaların yanında, Türkiye’de kendi çekirdeğini kavurup satan çok sayıda bağımsız kavurucu var. KahveDrop yalnızca bu bağımsız kavurucuların kendi sitelerinde sattığı çekirdekleri listeler; market markaları katalogda yok.',
    link: { href: '/kavurucular', label: 'Katalogdaki kavurucular' } },
  { question: 'Çekirdek mi almalıyım, öğütülmüş mü?',
    answer: 'Mümkünse çekirdek al ve demlemeden hemen önce öğüt; öğütülmüş kahve aromasını daha çabuk kaybeder. Değirmenin yoksa birçok kavurucu siparişte kahveyi demleme yöntemine göre öğütüyor; bunu kavurucunun ürün sayfasında kontrol et.' },
  { question: 'Filtre kahve çekirdeği fiyatları neden bu kadar farklı?',
    answer: 'Fiyat kökene, işleme, lotun ne kadar az bulunduğuna ve paket gramajına göre değişir. Paketleri etiket fiyatıyla değil gramajıyla birlikte karşılaştır ve kargo ücretini ayrıca hesaba kat.',
    link: { href: '/veri', label: 'Gramaja göre paket fiyatları: veri özeti' } },
];

async function loadData(): Promise<{ data: ComparisonData | null; landings: LandingWithFacts[] }> {
  // Both are derived once per refresh (comparison facts for /karsilastir, landing facts for /kahveler); 2 rows a read.
  try {
    const db = await getCatalogDatabase();
    const [data, landings] = await Promise.all([comparisonFacts(db), listLandings(db)]);
    return { data, landings };
  } catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return { data: null, landings: [] }; }
}

const linkClass = 'text-accent underline underline-offset-4';
const listingLink = (params: Record<string, string>) => `/kahveler?${new URLSearchParams(params).toString()}`;

function OriginFacts({ side, data }: { side: SideRef; data: ComparisonData | null }) {
  const facts = sideFacts(data, side), label = sideLabel(side), href = side.kind === 'origin' ? originLanding(side.value)?.path ?? '/kahveler' : '/kahveler';
  const tastes = facts ? leading(facts.tastes, facts.stated.taste) : null;
  return <li className="rounded-xl border border-line bg-surface p-5">
    <h3 className="font-display text-2xl">{label}</h3>
    {facts && facts.coffees >= MIN_COFFEES ? <p className="mt-2 text-[15px] leading-7 text-muted">
      Satışta {facts.coffees} çekirdek ({facts.roasters} kavurucudan).
      {tastes ? ` Tat ailesi belirtilen ${facts.stated.taste} çekirdekte en sık: ${tastes}.` : ''}
      {facts.price250 ? ` Ortanca 250 g paket fiyatı: ${lira(facts.price250.median)}.` : ''}
    </p> : <p className="mt-2 text-[15px] leading-7 text-muted">Satıştaki çekirdekleri katalogda gör.</p>}
    <Link href={href} prefetch={false} className="text-link">{label} kahveleri →</Link>
  </li>;
}

export default async function BeanGuidePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  dropTrackingParams(BEAN_GUIDE_PATH, await searchParams);
  const { data, landings } = await loadData();
  const filter = sideFacts(data, FILTER_SIDE);
  const roasts = filter && filter.stated.roast >= MIN_STATED ? leading(filter.roasts, filter.stated.roast) : null;
  return <div className="page-shell section-space pt-4">
    <JsonLd data={{ '@type': 'Article', headline: TITLE, description: DESCRIPTION, inLanguage: 'tr-TR', url: absoluteUrl(BEAN_GUIDE_PATH), mainEntityOfPage: absoluteUrl(BEAN_GUIDE_PATH),
      author: siteOrganization(), publisher: siteOrganization(), datePublished: BEAN_GUIDE_UPDATED, dateModified: BEAN_GUIDE_UPDATED }} />
    <JsonLd data={faqPage(FAQ)} />
    <JsonLd data={breadcrumbList([['Kahve rehberi', '/guide'], [TITLE, BEAN_GUIDE_PATH]])} />
    <nav aria-label="İçerik yolu" className="mb-3 text-sm"><Link href="/guide" className="inline-flex min-h-11 items-center text-accent hover:underline">← Kahve rehberi</Link></nav>
    <header className="max-w-3xl">
      <p className="eyebrow">Çekirdek seçimi</p>
      <h1 className="mt-3 font-display text-title">{TITLE}</h1>
      <div className="mt-6 rounded-xl border border-line bg-tint p-5">
        <h2 className="text-sm font-semibold text-ink">Kısa cevap</h2>
        <p className="mt-2 text-[17px] leading-8">Herkes için tek bir en iyi filtre kahve yok; en iyisi sevdiğin tada uyan, taze kavrulmuş çekirdek. Meyvemsi ve çiçeksi bir fincan için Etiyopya ve Kenya, çikolatalı ve tatlı bir fincan için Brezilya ve Kolombiya ile başla. Filtre için açık ya da orta kavrum seç.</p>
      </div>
      <p className="mt-3 text-sm text-muted">Son güncelleme: <time dateTime={BEAN_GUIDE_UPDATED}>{trDay(BEAN_GUIDE_UPDATED)}</time>.{data ? <> Rakamlar <time dateTime={data.at}>{trDay(data.at)}</time> itibarıyla KahveDrop kataloğundan; katalog her gece kavurucuların kendi sitelerinden yenilenir.</> : null}</p>
    </header>

    <section className="guide-copy mt-10 max-w-3xl" aria-labelledby="siralama">
      <h2 id="siralama">Neden marka sıralaması yok?</h2>
      <p>Bu sayfada “en iyi” diye bir sıralama yok. Bir çekirdeğin sana iyi gelmesi damak tadına, demleme yöntemine ve çekirdeğin tazeliğine bağlı; bunu tek bir puanla ölçemeyiz. Bunun yerine Türkiye’deki bağımsız kavurucuların satıştaki çekirdeklerini tada, kökene ve kavruma göre ayırıyor, kavurucunun kendi sitesindeki paket fiyatını gösteriyoruz. Seçimi sen yaparsın; satın alma kavurucunun sitesinde olur, KahveDrop satış yapmaz.</p>
      {filter && filter.coffees >= MIN_COFFEES ? <p>Katalogda kavurucusunun filtre demleme için önerdiği {filter.coffees} çekirdek var ({filter.roasters} kavurucudan). <Link href={listingLink({ brewMethod: 'filter' })} prefetch={false} className={linkClass}>Hepsini gör</Link>.</p> : null}
    </section>

    {GROUPS.map(group => {
      const pair = findComparison(group.compare);
      return <section key={group.id} className="mt-12" aria-labelledby={group.id}>
        <h2 id={group.id} className="max-w-3xl font-display text-heading">{group.title}</h2>
        <p className="mt-4 max-w-3xl text-[16px] leading-7 text-muted">{group.intro}</p>
        <ul className={`mt-6 grid gap-4 ${group.origins.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{group.origins.map(side => <OriginFacts key={sideLabel(side)} side={side} data={data} />)}</ul>
        <ul className="mt-5 flex flex-wrap gap-2">
          {group.tastes.map(([key, label]) => <li key={key}><Link href={listingLink({ taste: key, brewMethod: 'filter' })} prefetch={false} className="filter-option">{label} · filtre için</Link></li>)}
          {pair ? <li><Link href={`/karsilastir/${pair.slug}`} prefetch={false} className="filter-option">{comparisonQuestion(pair)}</Link></li> : null}
        </ul>
      </section>;
    })}

    <section className="guide-copy mt-12 max-w-3xl" aria-labelledby="kavrum">
      <h2 id="kavrum">Kavrum derecesi: filtre için açık ya da orta</h2>
      <p>Filtre için kavurucular çoğunlukla açık ya da orta kavrumu önerir. Açık kavrumda kökenin meyve ve çiçek notaları öne çıkar; orta kavrumda tatlılık ve gövde artar. Koyu kavrum daha çok espresso, Türk kahvesi ve sütlü içecekler için seçilir; filtrede acı ve isli tatlar baskın gelebilir. Kavrum etiketi kavurucular arasında aynı şeyi ifade etmeyebilir; tadım notlarıyla birlikte oku.</p>
      {filter && roasts ? <p>Filtre için önerilen {filter.coffees} çekirdekten {filter.stated.roast} tanesi kavrum derecesini belirtiyor; bunlarda en sık: {roasts}. Çoğu kavurucu kavrum derecesini yazmıyor, bu yüzden tadım notları daha güvenilir bir ipucu.</p> : null}
      <ul className="my-4 flex flex-wrap gap-2">{ROASTS.map(([key, label]) => <li key={key}><Link href={listingLink({ roast: key })} prefetch={false} className="filter-option">{label}</Link></li>)}</ul>
    </section>

    <section className="guide-copy mt-12 max-w-3xl" aria-labelledby="paket">
      <h2 id="paket">Paketi okurken dört şeye bak</h2>
      <p><strong className="text-ink">Kavrum tarihi.</strong> Filtre kahve, kavrumdan sonraki birkaç hafta içinde en canlı halindedir. Son kullanma tarihi değil, kavrum tarihi yazan paketi seç.</p>
      <p><strong className="text-ink">Demleme önerisi.</strong> Kavurucu çekirdeği filtre ya da pour over için önerdiyse kavrumu ve profili bu yönteme göre seçmiştir.</p>
      <p><strong className="text-ink">Tadım notları.</strong> Notlar bir çağrışımı anlatır, içerik listesi değildir. “Çikolata” notu olan kahveye çikolata eklenmemiştir.</p>
      <p><strong className="text-ink">Gramaj ve fiyat.</strong> 250 g ile 1 kg paketi etiket fiyatından kıyaslama; gramajı ve ne kadar kahve içtiğini birlikte düşün, kargo ücretini ayrıca hesaba kat.</p>
      <p>Çekirdeği seçtikten sonra oran, öğütüm ve süre için: <Link href={BREW_GUIDE_PATH} className={linkClass}>Filtre kahve nasıl yapılır?</Link> Hangi tadı sevdiğinden emin değilsen <Link href="/quiz" className={linkClass}>kahve testini</Link> çöz.</p>
    </section>

    <section className="mt-12 max-w-3xl" aria-labelledby="sss">
      <h2 id="sss" className="mb-4 font-display text-heading">Sık sorulanlar</h2>
      <div className="guide-copy">{FAQ.map(item => <details key={item.question}>
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
        {item.link ? <p><Link href={item.link.href} prefetch={false} className={linkClass}>{item.link.label}</Link></p> : null}
      </details>)}</div>
    </section>

    {landings.length ? <LandingLinks landings={landings} /> : null}
    <p className="mt-8 text-sm leading-7 text-muted">Espresso için mi filtre için mi seçeceğini bilmiyorsan: <Link href={`/karsilastir/${FILTER_PAIR}`} prefetch={false} className={linkClass}>espresso ve filtre çekirdekleri yan yana</Link>.</p>
  </div>;
}
