import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { JsonLd, breadcrumbList, siteOrganization } from '@/components/layout/json-ld';
import { DiscoveryGrid } from '@/components/v2/discovery-card';
import { BREW_STARTERS } from '@/lib/brew-calculator';
import { MIN_COFFEES, comparisonCards, comparisonFacts, findComparison, type ComparisonData } from '@/lib/comparisons';
import { BREW_GUIDE_UPDATED } from '@/lib/content-dates';
import { pageMetadata } from '@/lib/page-metadata';
import { BEAN_GUIDE_PATH, BREW_GUIDE_PATH, FILTER_PAIR, FILTER_SIDE, faqPage, howTo, leading, lira, sideFacts, trDay, type Faq, type HowToStep } from '@/lib/rehber';
import { absoluteUrl } from '@/lib/site';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';
import type { CatalogCoffee } from '../../../../shared/v2/catalog';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;

const TITLE = 'Filtre kahve nasıl yapılır?';
const DESCRIPTION = 'Filtre kahve nasıl yapılır: 1:15–1:17 oran, öğütüm, 92–96 °C su ve V60, Chemex, French press, makine ve soğuk demleme için süreler. Adım adım tarif.';
export const metadata: Metadata = pageMetadata('Filtre kahve nasıl yapılır? Oran, öğütüm, süre', DESCRIPTION, BREW_GUIDE_PATH, { type: 'article' });

/** Per method: ratio, an example dose, grind and time. Starting points, not rules; the FAQ and steps say the same. */
const METHODS = [
  { name: 'V60 ve benzeri demlikler', ratio: '1:15–1:17', example: '15 g kahve, 250 g su', grind: 'Orta-ince, sofra tuzu gibi', time: '2,5–3,5 dakika' },
  { name: 'Chemex', ratio: '1:15–1:17', example: '30 g kahve, 500 g su', grind: 'Orta-iri, iri kum gibi', time: '3,5–4,5 dakika' },
  { name: 'French press', ratio: 'Yaklaşık 1:15', example: '30 g kahve, 450 g su', grind: 'İri, deniz tuzu gibi', time: '4 dakika demlenir, sonra piston indirilir' },
  { name: 'Filtre kahve makinesi', ratio: '1:15–1:17', example: '60–65 g kahve, 1 litre su', grind: 'Orta, kum gibi', time: 'Makine belirler; çoğunda 4–8 dakika' },
  { name: 'Soğuk demleme (cold brew)', ratio: '1:8, konsantre', example: '100 g kahve, 800 g soğuk su', grind: 'İri', time: 'Buzdolabında 12–18 saat' },
] as const;

const STEPS: HowToStep[] = [
  { name: 'Suyu ısıt', text: 'Suyu kaynat ve yaklaşık 30 saniye beklet; 92–96 °C aralığına iner. Termometren varsa ölç. Klorlu musluk suyu yerine filtre edilmiş ya da içme suyu kullan.' },
  { name: 'Kahveyi tart ve öğüt', text: '250 g su için 15 g kahve tart (1:17). Kahveyi demlemeden hemen önce, sofra tuzu inceliğinde öğüt.' },
  { name: 'Filtreyi ıslat', text: 'Kağıt filtreyi demliğe yerleştir, sıcak suyla durula ve bu suyu dök. Kağıt tadı azalır, demlik ve fincan ısınır.' },
  { name: 'Ön demleme yap', text: 'Kahveyi filtreye koy, yüzeyini düzle. Kahvenin iki katı kadar su (yaklaşık 30 g) dök ve 30–45 saniye bekle. Taze kahve bu sırada kabarır ve gazını bırakır.' },
  { name: 'Kalan suyu dök', text: 'Kalan suyu ortadan dışa doğru yavaş dairelerle, iki üç seferde dök ve toplam 250 g’a ulaş. Suyu doğrudan kağıdın kenarına dökme.' },
  { name: 'Süzülmesini bekle ve tat', text: 'Demleme 2,5–3,5 dakikada biter. Fincan ekşi ve sulu geldiyse bir dahaki sefere biraz daha ince, acı ve buruk geldiyse biraz daha iri öğüt. Her seferinde tek bir şeyi değiştir.' },
];

const FAQ: (Faq & { link?: { href: string; label: string } })[] = [
  { question: 'Filtre kahve ölçüsü nasıl olmalı?',
    answer: 'Başlangıç için 1 gram kahveye 15–17 gram su kullan. 250 ml’lik bir fincan için 15 g, 1 litrelik bir sürahi için 60–65 g kahve yeter. Tartı yoksa bir su bardağı (yaklaşık 200 ml) için 2 silme yemek kaşığı öğütülmüş kahveyle başla; bu yaklaşık 10–14 g eder, öğütüme göre değişir.' },
  { question: 'Filtre kahve kaç dakikada demlenir?',
    answer: 'Yönteme göre değişir: V60’ta 2,5–3,5 dakika, Chemex’te 3,5–4,5 dakika, French press’te 4 dakika. Filtre kahve makinesi süreyi kendisi belirler; çoğu 4–8 dakikada bitirir. Soğuk demleme buzdolabında 12–18 saat sürer.' },
  { question: 'Filtre kahve için su kaç derece olmalı?',
    answer: '92–96 °C. Termometren yoksa suyu kaynatıp yaklaşık 30 saniye beklet. Çok sıcak su fincanı acılaştırabilir, fazla soğumuş su ise ekşi ve sulu bir fincan verir.' },
  { question: 'Filtre kahve için kahve ne kadar ince öğütülmeli?',
    answer: 'V60 için sofra tuzu inceliğinde (orta-ince), filtre kahve makinesi için kum inceliğinde (orta), Chemex için biraz daha iri, French press ve soğuk demleme için iri öğüt. Fincan ekşi geliyorsa daha ince, acı geliyorsa daha iri öğüt.' },
  { question: 'Soğuk filtre kahve nasıl yapılır?',
    answer: 'İki yolu var. Soğuk demleme (cold brew): 100 g iri öğütülmüş kahveyi 800 g soğuk suyla karıştır, kapalı bir kapta buzdolabında 12–18 saat beklet ve kağıt filtreden süz; konsantre olduğu için 1’e 1 su ya da sütle seyrelt. Buzlu filtre: V60 tarifini kullan, suyun yaklaşık üçte birini buz olarak sürahiye koy, kalanını sıcak dök; kahve buzun üstüne damlayıp hemen soğur.' },
  { question: 'Filtre kahve makinesinde oran değişir mi?',
    answer: 'Hayır, aynı 1:15–1:17 oranı geçerli: 1 litre su için 60–65 g kahve. Haznedeki fincan çizgileri yerine suyu ve kahveyi tartmak daha tutarlı sonuç verir. Demlenen kahveyi ısıtıcı plakada uzun süre bekletme; tadı ağırlaşır.' },
  { question: 'Filtre kahve için hangi çekirdek seçilmeli?',
    answer: 'Kavurucusunun filtre için önerdiği, açık ya da orta kavrulmuş, taze çekirdeklerle başla. Meyvemsi ve çiçeksi bir fincan istiyorsan Etiyopya ve Kenya, daha tatlı ve çikolatalı bir fincan istiyorsan Brezilya ve Kolombiya çekirdeklerine bak.',
    link: { href: BEAN_GUIDE_PATH, label: 'Filtre kahve çekirdeği seçimi: tadına göre' } },
];

async function loadFilterCoffees(): Promise<{ data: ComparisonData | null; coffees: CatalogCoffee[] }> {
  // Both are derived once per refresh for /karsilastir; reading them costs 2 rows each. Without them the guide still stands.
  try {
    const db = await getCatalogDatabase();
    const data = await comparisonFacts(db);
    const pair = findComparison(FILTER_PAIR);
    const side = sideFacts(data, FILTER_SIDE);
    if (!pair || !side) return { data, coffees: [] };
    const cards = await comparisonCards(db, pair, data);
    return { data, coffees: side.shown.flatMap(id => cards[id] ?? []) };
  } catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return { data: null, coffees: [] }; }
}

const linkClass = 'text-accent underline underline-offset-4';

export default async function BrewGuidePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  dropTrackingParams(BREW_GUIDE_PATH, await searchParams);
  const { data, coffees } = await loadFilterCoffees();
  const filter = sideFacts(data, FILTER_SIDE);
  const tastes = filter ? leading(filter.tastes, filter.stated.taste) : null;
  return <div className="page-shell section-space pt-4">
    <JsonLd data={{ '@type': 'Article', headline: TITLE, description: DESCRIPTION, inLanguage: 'tr-TR', url: absoluteUrl(BREW_GUIDE_PATH), mainEntityOfPage: absoluteUrl(BREW_GUIDE_PATH),
      author: siteOrganization(), publisher: siteOrganization(), datePublished: BREW_GUIDE_UPDATED, dateModified: BREW_GUIDE_UPDATED }} />
    <JsonLd data={howTo('V60 ile filtre kahve nasıl yapılır?', 'Bir fincan filtre kahve: 15 g kahve, 250 g su, 92–96 °C, 2,5–3,5 dakika.', BREW_GUIDE_PATH, STEPS,
      { supply: ['15 g kahve çekirdeği', '250 g su', 'Kağıt filtre'], tool: ['V60 ya da benzeri bir demlik', 'Kahve değirmeni', 'Mutfak tartısı', 'Su ısıtıcısı'], totalTime: 'PT5M' })} />
    <JsonLd data={faqPage(FAQ)} />
    <JsonLd data={breadcrumbList([['Kahve rehberi', '/guide'], [TITLE, BREW_GUIDE_PATH]])} />
    <nav aria-label="İçerik yolu" className="mb-3 text-sm"><Link href="/guide" className="inline-flex min-h-11 items-center text-accent hover:underline">← Kahve rehberi</Link></nav>
    <header className="max-w-3xl">
      <p className="eyebrow">Demleme rehberi</p>
      <h1 className="mt-3 font-display text-title">{TITLE}</h1>
      <div className="mt-6 rounded-xl border border-line bg-tint p-5">
        <h2 className="text-sm font-semibold text-ink">Kısa cevap</h2>
        <p className="mt-2 text-[17px] leading-8">1 gram kahveye 15–17 gram su kullan: bir fincan için 15 g kahve, 250 g su. Kahveyi demlemeden hemen önce orta incelikte öğüt, suyu kaynatıp yaklaşık 30 saniye bekleterek 92–96 °C’ye getir. V60’ta demleme 2,5–3,5 dakika, Chemex’te 3,5–4,5 dakika, French press’te 4 dakika sürer; makine süreyi kendisi ayarlar.</p>
      </div>
      <p className="mt-3 text-sm text-muted">Son güncelleme: <time dateTime={BREW_GUIDE_UPDATED}>{trDay(BREW_GUIDE_UPDATED)}</time>. Oranı gramına göre hesaplamak için <Link href="/guide#calculator" className={linkClass}>demleme hesaplayıcısı</Link>.</p>
    </header>

    <article className="guide-copy mt-10 max-w-3xl">
      <h2 id="olcu">Filtre kahve ölçüsü ve oranı</h2>
      <p>Filtre kahvede ölçü, kuru kahvenin ağırlığı ile dökülen suyun ağırlığı arasındaki orandır. 1:15 daha yoğun, 1:17 daha hafif bir fincan verir. 1:16 ile başla, sonra damak tadına göre ayarla. Ölçmek için mutfak tartısı en güvenilir yoldur: suyun gramı mililitresine eşittir.</p>
      <div className="my-6 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="versus-table" role="table">
          <colgroup><col className="w-[30%]" /><col /><col /></colgroup>
          <caption className="sr-only">Demleme yöntemine göre oran, öğütüm ve süre</caption>
          <thead><tr role="row"><th scope="col" role="columnheader"><span className="sr-only">Yöntem</span></th><th scope="col" role="columnheader">Oran</th><th scope="col" role="columnheader">Öğütüm ve süre</th></tr></thead>
          <tbody>{METHODS.map(method => <tr role="row" key={method.name}>
            <th scope="row" role="rowheader">{method.name}</th>
            <td role="cell">{method.ratio}<span className="block text-xs text-muted">{method.example}</span></td>
            <td role="cell">{method.grind}<span className="block text-xs text-muted">{method.time}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p>Su sıcaklığı her sıcak yöntemde aynı: 92–96 °C. Çekirdek de önemli: kavrum tarihinden sonraki birkaç hafta içindeki taze çekirdek ve demlemeden hemen önce öğütülmüş kahve, aynı tarifle belirgin biçimde daha canlı bir fincan verir.</p>

      <h2 id="v60">Adım adım: V60 ile filtre kahve</h2>
      <p>Bir fincan için 15 g kahve ve 250 g su. Gerekenler: V60 ya da benzeri bir demlik, kağıt filtre, değirmen, tartı ve su ısıtıcısı.</p>
      <ol className="my-4 space-y-4 pl-0">{STEPS.map((step, index) => <li key={step.name} id={`adim-${index + 1}`} className="grid grid-cols-[2rem_1fr] gap-3">
        <span className="font-display text-2xl leading-none text-warm">{index + 1}</span>
        <span><strong className="block text-ink">{step.name}</strong><span className="text-[16px] leading-7 text-muted">{step.text}</span></span>
      </li>)}</ol>

      <h2 id="chemex">Chemex</h2>
      <p>Adımlar V60 ile aynı; Chemex’in filtresi daha kalın olduğu için öğütümü biraz daha iri tut. 30 g kahve ve 500 g su ile ön demlemeyi 45 saniye yap, kalan suyu üç dört seferde dök. Toplam süre 3,5–4,5 dakika. Süzülme çok uzun sürüyorsa öğütümü irileştir.</p>

      <h2 id="french-press">French press</h2>
      <p>30 g kahveyi iri öğüt ve 450 g sıcak suyu üzerine dök. Bir kez karıştır, kapağı kapat ve 4 dakika beklet. Pistonu yavaşça indir ve kahveyi hemen başka bir kaba aktar: telvenin üstünde bekleyen kahve acılaşır. Fincanın dibinde biraz tortu kalması normaldir.</p>

      <h2 id="makine">Filtre kahve makinesi</h2>
      <p>Makinede de oran aynı: 1 litre su için 60–65 g kahve, orta (kum inceliğinde) öğütüm. Haznedeki fincan çizgileri yerine suyu ve kahveyi tart. Demlenen kahveyi ısıtıcı plakada uzun süre bekletme; içeceğin kadarını demle ya da termos sürahiye aktar. Makineyi ve hazneyi düzenli temizle; kireç ve eski kahve yağı tadı bozar.</p>

      <h2 id="soguk">Soğuk filtre kahve</h2>
      <p><strong className="text-ink">Soğuk demleme (cold brew):</strong> 100 g iri öğütülmüş kahveyi 800 g soğuk suyla karıştır. Kapalı bir kapta buzdolabında 12–18 saat beklet, sonra kağıt filtreden süz. Çıkan kahve konsantredir; 1’e 1 su ya da sütle seyrelt. Kapalı kapta buzdolabında birkaç gün saklanabilir.</p>
      <p><strong className="text-ink">Buzlu filtre:</strong> Hemen içmek istiyorsan V60 tarifini kullan, ama suyun yaklaşık üçte birini buz olarak sürahiye koy: 15 g kahve, 170 g sıcak su ve 80 g buz. Öğütümü biraz incelt; kahve buzun üstüne damlar ve hemen soğur.</p>

      <h2 id="sorunlar">Fincan istediğin gibi olmadıysa</h2>
      <p><strong className="text-ink">Ekşi, sulu, ince:</strong> kahve az demlenmiş. Daha ince öğüt, suyu daha sıcak tut ya da oranı 1:15’e yaklaştır.</p>
      <p><strong className="text-ink">Acı, buruk, ağızda kuruluk:</strong> kahve fazla demlenmiş. Daha iri öğüt ya da demleme süresini kısalt.</p>
      <p>Bir seferde yalnızca tek bir şeyi değiştir; böylece hangi değişikliğin fincanı iyileştirdiğini anlarsın.</p>
    </article>

    <section className="mt-12" aria-labelledby="cekirdekler">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="cekirdekler" className="font-display text-heading">Filtre için önerilen çekirdekler</h2>
        <Link href="/kahveler?brewMethod=filter" prefetch={false} className="text-link">Tümünü gör →</Link>
      </div>
      {filter && data && filter.coffees >= MIN_COFFEES ? <p className="mb-6 max-w-3xl text-[16px] leading-7 text-muted">{trDay(data.at)} itibarıyla KahveDrop kataloğunda kavurucusunun filtre demleme için önerdiği {filter.coffees} çekirdek var ({filter.roasters} kavurucudan).{tastes ? ` Tat ailesi belirtilenlerde en sık görülenler: ${tastes}.` : ''}{filter.price250 ? ` Ortanca 250 g paket fiyatı: ${lira(filter.price250.median)}.` : ''}</p>
        : <p className="mb-6 max-w-3xl text-[16px] leading-7 text-muted">Kavurucuların filtre demleme için önerdiği çekirdekleri katalogda bulabilirsin.</p>}
      {coffees.length ? <DiscoveryGrid coffees={coffees} source="guide" /> : null}
      <p className="mt-6 max-w-3xl text-[15px] leading-7 text-muted">Hangi çekirdeği seçeceğine karar veremediysen: <Link href={BEAN_GUIDE_PATH} className={linkClass}>filtre kahve çekirdeğini tadına göre seç</Link> ya da <Link href={`/karsilastir/${FILTER_PAIR}`} prefetch={false} className={linkClass}>espresso ve filtre çekirdeklerini yan yana</Link> gör.</p>
    </section>

    <section className="mt-12 max-w-3xl" aria-labelledby="sss">
      <h2 id="sss" className="mb-4 font-display text-heading">Sık sorulanlar</h2>
      <div className="guide-copy">{FAQ.map(item => <details key={item.question}>
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
        {item.link ? <p><Link href={item.link.href} className={linkClass}>{item.link.label}</Link></p> : null}
      </details>)}</div>
    </section>

    <p className="mt-10 max-w-3xl border-t border-line pt-5 text-sm leading-7 text-muted">
      Kaynaklar: <a href={BREW_STARTERS.filter.source} target="_blank" rel="noopener noreferrer" className={linkClass}>{BREW_STARTERS.filter.sourceName} ↗</a>, <a href={BREW_STARTERS.french_press.source} target="_blank" rel="noopener noreferrer" className={linkClass}>{BREW_STARTERS.french_press.sourceName} ↗</a>. Tarifler başlangıç noktasıdır; kavurucunun çekirdeğe özel önerisi varsa onu da dene.
    </p>
  </div>;
}
