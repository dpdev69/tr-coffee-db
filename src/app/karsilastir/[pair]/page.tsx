import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, unstable_rethrow } from 'next/navigation';
import { JsonLd, breadcrumbList, itemList } from '@/components/layout/json-ld';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { DiscoveryEmpty, DiscoveryGrid } from '@/components/v2/discovery-card';
import { formatMoney } from '@/lib/coffee-display';
import type { CatalogCoffee } from '../../../../shared/v2/catalog';
import { COMPARISONS, GROUP_LABELS, comparisonCards, comparisonFacts, comparisonQuestion, comparisonTitle, findComparison, indexable, sideHref, sideKey, sideLabel, type Comparison, type ComparisonData, type Share, type SideFacts, type SideRef } from '@/lib/comparisons';
import { pageMetadata } from '@/lib/page-metadata';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 21600;
type Props = { params: Promise<{ pair: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

const loadFacts = cache(async () => {
  try { return await comparisonFacts(await getCatalogDatabase()); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return null; }
});
type Cards = Record<string, CatalogCoffee>;
/** The pair's cards; without them the page still shows every number, only the coffee lists and names are missing. */
async function loadCards(item: Comparison, data: ComparisonData): Promise<Cards> {
  try { return await comparisonCards(await getCatalogDatabase(), item, data); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); return {}; }
}
const money = (value: number) => formatMoney(value);
const shares = (items: Share[], limit = 3) => items.slice(0, limit).map(item => `${item.label} ${item.count}`).join(' · ');
const asOf = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = findComparison((await params).pair);
  // notFound() here would answer 200 on vinext; the page throws it and gets the 404 status.
  if (!item) return { title: 'Sayfa bulunamadı', robots: { index: false } };
  const data = await loadFacts();
  const [a, b] = [sideLabel(item.a), sideLabel(item.b)];
  const counts = data ? [data.sides[sideKey(item.a)]?.coffees ?? 0, data.sides[sideKey(item.b)]?.coffees ?? 0] : null;
  const description = counts
    ? `${a} ve ${b} yan yana: satıştaki ${counts[0]} ve ${counts[1]} çekirdeğin 250 g fiyatı, kökeni, işlemi ve tat notları. Her gece güncellenir.`
    : `${a} ve ${b} yan yana: satıştaki çekirdeklerin 250 g fiyatı, kökeni, işlemi ve tat notları. Her gece güncellenir.`;
  const metadata = pageMetadata(comparisonTitle(item), description, `/karsilastir/${item.slug}`, { type: 'article' });
  // Too few coffees on a side for the numbers to mean anything: the page stays for links but leaves the index.
  return data && !indexable(data, item) ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

/** Plain sentences from the table's own numbers; a line whose numbers are missing on either side is left out. */
function summary(item: Comparison, a: SideFacts, b: SideFacts): string[] {
  const [la, lb] = [sideLabel(item.a), sideLabel(item.b)];
  const lines = [`Satışta: ${la} tarafında ${a.coffees}, ${lb} tarafında ${b.coffees} çekirdek${item.group === 'kavurucu' ? '' : ` (${a.roasters} ve ${b.roasters} kavurucudan)`}.`];
  if (a.price250 && b.price250) lines.push(`250 g paketlerin ortanca fiyatı: ${la} ${money(a.price250.median)}, ${lb} ${money(b.price250.median)}.`);
  const NOUN = { process: 'işlemi', taste: 'tat ailesi', origin: 'kökeni' } as const;
  const pairLine = (title: string, list: 'processes' | 'tastes' | 'origins', key: 'process' | 'taste' | 'origin') => {
    const lead = (label: string, facts: SideFacts) => facts[list][0] && facts.stated[key] >= 3 ? `${label} için ${facts[list][0].label} (${NOUN[key]} belirtilen ${facts.stated[key]} çekirdekten ${facts[list][0].count})` : null;
    const [x, y] = [lead(la, a), lead(lb, b)];
    if (x && y) lines.push(`${title}: ${x}; ${y}.`);
  };
  if (item.group !== 'koken') pairLine('En sık köken', 'origins', 'origin');
  if (item.group !== 'islem') pairLine('En sık işlem', 'processes', 'process');
  pairLine('En sık tat ailesi', 'tastes', 'taste');
  return lines;
}

/** "Hangisi sana uygun?": only where the two sides differ clearly (15 points or more, at least 5 coffees stating it). */
function guidance(item: Comparison, a: SideFacts, b: SideFacts): string[] {
  const [la, lb] = [sideLabel(item.a), sideLabel(item.b)];
  const lines: string[] = [];
  let compared = false;
  const share = (facts: SideFacts, list: 'tastes' | 'processes', key: string, of: number) => (facts[list].find(entry => entry.key === key)?.count ?? 0) / of;
  const compare = (list: 'tastes' | 'processes', key: string, of: 'taste' | 'process', wish: string) => {
    if (a.stated[of] < 5 || b.stated[of] < 5) return;
    compared = true;
    const [x, y] = [share(a, list, key, a.stated[of]), share(b, list, key, b.stated[of])];
    if (Math.abs(x - y) < 0.15) return;
    const [winner, high, low] = x > y ? [la, x, y] : [lb, y, x];
    lines.push(`${wish}: ${winner} tarafında oran daha yüksek (%${Math.round(high * 100)}, diğer tarafta %${Math.round(low * 100)}).`);
  };
  compare('tastes', 'Fruity', 'taste', 'Meyvemsi bir fincan arıyorsan');
  compare('tastes', 'Floral', 'taste', 'Çiçeksi notalar seviyorsan');
  compare('tastes', 'Chocolate', 'taste', 'Çikolatalı, gövdeli bir fincan istiyorsan');
  compare('tastes', 'Nutty', 'taste', 'Kuruyemiş notaları seviyorsan');
  if (item.group !== 'islem') compare('processes', 'natural', 'process', 'Natürel işlemli çekirdek istiyorsan');
  const priced = Boolean(a.price250 && b.price250 && a.price250.coffees >= 3 && b.price250.coffees >= 3);
  compared ||= priced;
  if (a.price250 && b.price250 && priced && Math.abs(a.price250.median - b.price250.median) >= 0.1 * Math.min(a.price250.median, b.price250.median)) {
    const [cheaper, low, high] = a.price250.median < b.price250.median ? [la, a.price250.median, b.price250.median] : [lb, b.price250.median, a.price250.median];
    lines.push(`Bütçe önceliğinse: 250 g ortanca fiyat ${cheaper} tarafında daha düşük (${money(low)}, diğer tarafta ${money(high)}).`);
  }
  if (lines.length) return lines;
  return [compared ? 'İki taraf tat ailelerinde ve fiyatta birbirine yakın; seçimi tek tek çekirdeklerin tadım notlarına bakarak yapmak daha doğru.'
    : 'Bir yön göstermek için iki tarafta da yeterli bilgi yok; seçimi tek tek çekirdeklerin tadım notlarına bakarak yap.'];
}

function stated(count: number) { return <span className="block text-xs text-muted">{count} çekirdekte belirtilmiş</span>; }
function Row({ label, a, b }: { label: string; a: React.ReactNode; b: React.ReactNode }) {
  return <tr role="row"><th scope="row" role="rowheader">{label}</th><td role="cell">{a}</td><td role="cell">{b}</td></tr>;
}
function factCell(facts: SideFacts, list: 'origins' | 'processes' | 'roasts' | 'tastes' | 'brews', key: keyof SideFacts['stated'], minimum = 1) {
  return facts.stated[key] >= minimum && facts[list].length ? <>{shares(facts[list])}{stated(facts.stated[key])}</> : <span className="text-muted">Az çekirdekte belirtilmiş</span>;
}
function priceCell(facts: SideFacts) {
  if (!facts.price250) return <span className="text-muted">Stokta 250 g paket yok</span>;
  const { min, median, max, coffees } = facts.price250;
  return <>{min === max ? money(min) : `${money(min)} – ${money(max)}`}<span className="block">Ortanca {money(median)}</span><span className="block text-xs text-muted">{coffees} çekirdeğin 250 g paketi stokta</span></>;
}

function cheapestCell(item: Comparison, facts: SideFacts, cards: Cards) {
  if (!facts.cheapest250) return '—';
  const coffee = cards[facts.cheapest250.id];
  if (!coffee) return money(facts.cheapest250.price);
  return <><Link href={`/kahve/${coffee.slug}`} prefetch={false} className="text-accent hover:underline">{coffee.name}</Link><span className="block text-xs text-muted">{item.group === 'kavurucu' ? '' : `${coffee.roaster.name} · `}{money(facts.cheapest250.price)}</span></>;
}
function ComparisonTable({ item, a, b, cards }: { item: Comparison; a: SideFacts; b: SideFacts; cards: Cards }) {
  const head = (side: SideRef) => <th scope="col" role="columnheader"><Link href={sideHref(side)} prefetch={false} className="hover:underline">{sideLabel(side)}</Link></th>;
  return <div className="overflow-hidden rounded-xl border border-line bg-surface">
    {/* Rows become grids on phones (globals.css), which drops table semantics in WebKit; the roles keep them. */}
    <table className="versus-table" role="table">
      <colgroup><col className="w-[28%]" /><col /><col /></colgroup>
      <caption className="sr-only">{sideLabel(item.a)} ve {sideLabel(item.b)} karşılaştırma tablosu</caption>
      <thead><tr role="row"><th scope="col" role="columnheader"><span className="sr-only">Özellik</span></th>{head(item.a)}{head(item.b)}</tr></thead>
      <tbody>
        <Row label="Satıştaki çekirdek" a={a.coffees} b={b.coffees} />
        {item.group === 'kavurucu'
          ? <Row label="Şehir" a={a.city ?? 'Belirtilmemiş'} b={b.city ?? 'Belirtilmemiş'} />
          : <Row label="Kavurucu" a={<>{a.roasters}<span className="block text-xs text-muted">En çok: {shares(a.topRoasters)}</span></>} b={<>{b.roasters}<span className="block text-xs text-muted">En çok: {shares(b.topRoasters)}</span></>} />}
        <Row label="250 g paket fiyatı" a={priceCell(a)} b={priceCell(b)} />
        <Row label="En uygun 250 g" a={cheapestCell(item, a, cards)} b={cheapestCell(item, b, cards)} />
        {item.group !== 'koken' ? <Row label="Köken" a={factCell(a, 'origins', 'origin')} b={factCell(b, 'origins', 'origin')} /> : null}
        {item.group !== 'islem' ? <Row label="İşlem" a={factCell(a, 'processes', 'process')} b={factCell(b, 'processes', 'process')} /> : null}
        <Row label="Tat aileleri" a={factCell(a, 'tastes', 'taste')} b={factCell(b, 'tastes', 'taste')} />
        <Row label="Kavrum" a={factCell(a, 'roasts', 'roast', 3)} b={factCell(b, 'roasts', 'roast', 3)} />
        {item.group !== 'demleme' ? <Row label="Önerilen demleme" a={factCell(a, 'brews', 'brew', 3)} b={factCell(b, 'brews', 'brew', 3)} /> : null}
      </tbody>
    </table>
  </div>;
}

function SideCoffees({ side, facts, cards }: { side: SideRef; facts: SideFacts; cards: Cards }) {
  const label = sideLabel(side), shown = facts.shown.flatMap(id => cards[id] ?? []);
  return <section className="mt-12">
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-display text-heading">{side.kind === 'roaster' ? `${label} çekirdekleri` : side.kind === 'brew' ? `${label} için önerilen çekirdekler` : side.kind === 'origin' ? `${label} çekirdekleri` : `${label} işlemli çekirdekler`}</h2>
      {facts.coffees > shown.length ? <Link href={sideHref(side)} prefetch={false} className="text-link">Tümünü gör →</Link> : null}</div>
    {shown.length ? <DiscoveryGrid coffees={shown} source="karsilastir" /> : <DiscoveryEmpty title="Şu an satışta doğrulanmış bir çekirdek yok.">Yeniden satışa çıkan çekirdekler burada yer alacak.</DiscoveryEmpty>}
  </section>;
}

export default async function ComparisonPage({ params, searchParams }: Props) {
  const item = findComparison((await params).pair);
  if (!item) notFound();
  dropTrackingParams(`/karsilastir/${item.slug}`, await searchParams);
  const data: ComparisonData | null = await loadFacts();
  const path = `/karsilastir/${item.slug}`;
  const crumbs = <JsonLd data={breadcrumbList([['Karşılaştırmalar', '/karsilastir'], [comparisonQuestion(item), path]])} />;
  const nav = <nav aria-label="İçerik yolu" className="mb-3 text-sm"><Link href="/karsilastir" className="inline-flex min-h-11 items-center text-accent hover:underline">← Tüm karşılaştırmalar</Link></nav>;
  if (!data) return <div className="page-shell section-space pt-4">{crumbs}{nav}<h1 className="mb-6 font-display text-title">{comparisonQuestion(item)}</h1><DataSourceNotice title="Karşılaştırma şu an yüklenemiyor." message="Güncel kataloğa ulaşamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/karsilastir" actionLabel="Karşılaştırmalara dön" /></div>;
  const [a, b] = [data.sides[sideKey(item.a)], data.sides[sideKey(item.b)]];
  // A last-good copy written before this pair existed has no facts for it: an outage notice, never a 404 for a real page.
  if (!a || !b) return <div className="page-shell section-space pt-4">{crumbs}{nav}<h1 className="mb-6 font-display text-title">{comparisonQuestion(item)}</h1><DataSourceNotice title="Karşılaştırma şu an yüklenemiyor." message="Güncel kataloğa ulaşamadık. Biraz sonra yeniden deneyebilirsin." actionHref="/karsilastir" actionLabel="Karşılaştırmalara dön" /></div>;
  const cards = await loadCards(item, data);
  const shown = [...new Set([...a.shown, ...b.shown])].flatMap(id => cards[id] ?? []);
  const others = COMPARISONS.filter(other => other.slug !== item.slug).sort((x, y) => Number(y.group === item.group) - Number(x.group === item.group));
  return <div className="page-shell section-space pt-4">
    {crumbs}
    {shown.length ? <JsonLd data={{ ...itemList(shown.map(coffee => [coffee.name, `/kahve/${coffee.slug}`])), name: comparisonQuestion(item) }} /> : null}
    {nav}
    <header className="max-w-3xl">
      <p className="eyebrow">{GROUP_LABELS[item.group]} karşılaştırması</p>
      <h1 className="mt-3 font-display text-title">{comparisonQuestion(item)}</h1>
      <p className="mt-5 text-[17px] leading-8 text-muted">{item.intro}</p>
      <p className="mt-3 text-sm text-muted">Veriler {asOf(data.at)} tarihli KahveDrop kataloğundan. Katalog her gece kavurucuların kendi sitelerinden güncellenir; satış kavurucunun sitesinde yapılır.</p>
    </header>
    {!indexable(data, item) ? <div className="mt-8"><DataSourceNotice title="Bu karşılaştırmada şu an az çekirdek var." message="Taraflardan birinde satışta 3’ten az çekirdek olduğu için rakamlar yön göstermeyebilir." /></div> : null}
    <section className="mt-10 max-w-3xl" aria-labelledby="kisaca"><h2 id="kisaca" className="mb-3 font-display text-heading">Kısaca</h2>
      <ul className="list-disc space-y-2 pl-5 text-[16px] leading-7">{summary(item, a, b).map(line => <li key={line}>{line}</li>)}</ul></section>
    <section className="mt-10" aria-labelledby="tablo"><h2 id="tablo" className="mb-4 font-display text-heading">Yan yana</h2><ComparisonTable item={item} a={a} b={b} cards={cards} />
      <p className="catalog-caption mt-3">Fiyatlar, her çekirdeğin stoktaki en ucuz 250 g paketidir; kargo dahil değildir. Başka gramajlar fiyat satırına katılmaz. Köken, işlem ve tat bilgisi kavurucunun sayfasından gelir; kavurucu belirtmediyse ürün açıklamasından çıkarılmış olabilir. Bir çekirdek birden fazla değer taşıyabilir.</p></section>
    <section className="mt-10 max-w-3xl" aria-labelledby="hangisi"><h2 id="hangisi" className="mb-3 font-display text-heading">Hangisi sana uygun?</h2>
      <ul className="list-disc space-y-2 pl-5 text-[16px] leading-7">{guidance(item, a, b).map(line => <li key={line}>{line}</li>)}</ul></section>
    <SideCoffees side={item.a} facts={a} cards={cards} />
    <SideCoffees side={item.b} facts={b} cards={cards} />
    <nav aria-label="Diğer karşılaştırmalar" className="mt-14 border-t border-line pt-8"><h2 className="mb-4 font-display text-heading">Diğer karşılaştırmalar</h2>
      <ul className="flex flex-wrap gap-2">{others.map(other => <li key={other.slug}><Link href={`/karsilastir/${other.slug}`} prefetch={false} className="filter-option">{comparisonQuestion(other)}</Link></li>)}</ul></nav>
  </div>;
}
