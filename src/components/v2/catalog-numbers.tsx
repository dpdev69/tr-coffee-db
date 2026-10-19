import Link from 'next/link';
import { JsonLd, breadcrumbList, siteOrganization } from '@/components/layout/json-ld';
import { brand } from '@/lib/brand';
import { LICENSE, MIN_SIZE_COFFEES, STATS_JSON_PATH, STATS_PATH, bagSize, isoDay, lira, statsDate, statsFigures, trDate, trMonth, type CatalogStats, type StatsShare } from '@/lib/catalog-stats';
import { COMPARISONS, comparisonQuestion } from '@/lib/comparisons';
import { absoluteUrl } from '@/lib/site';

const number = (value: number) => value.toLocaleString('tr-TR');
const share = (part: number, whole: number) => (whole ? `%${Math.round((part / whole) * 100)}` : '—');
const credit = <p className="mt-3 text-xs text-muted">Kaynak: {brand.name} · <a href={LICENSE.url} rel="license" className="hover:underline">{LICENSE.name}</a></p>;

/** Honest Dataset markup: what the page and the JSON copy hold, who publishes it, under which licence, as of which day. */
export function datasetJsonLd(stats: CatalogStats) {
  return {
    '@type': 'Dataset',
    name: `${brand.name} katalog özeti · ${trMonth(statsDate(stats))}`,
    description: `Türkiye’deki bağımsız nitelikli kahve kavurucularının ${brand.name} kataloğundaki toplu rakamları: satıştaki kahve, kavurucu ve paket sayısı, köken ve işlem dağılımı, son ${stats.newArrivals.days} günde yeni gelenler, son ${stats.priceDrops.days} günde fiyatı düşenler ve gramaja göre paket fiyatları (en düşük, ortanca, en yüksek). Her gece kavurucuların kendi sitelerinden yenilenir.`,
    url: absoluteUrl(STATS_PATH),
    inLanguage: 'tr-TR',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: siteOrganization(),
    publisher: siteOrganization(),
    dateModified: statsDate(stats),
    temporalCoverage: isoDay(statsDate(stats)),
    spatialCoverage: { '@type': 'Place', name: 'Türkiye' },
    keywords: ['nitelikli kahve', 'kahve fiyatları', 'kahve kavurucuları', 'Türkiye', 'açık veri'],
    variableMeasured: ['Satıştaki kahve sayısı', 'Kavurucu sayısı', 'Paket sayısı', 'Kökene göre kahve sayısı', 'İşleme göre kahve sayısı', 'Yeni gelen kahve sayısı', 'Fiyatı düşen kahve sayısı', 'Gramaja göre paket fiyatı (TL)'],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: absoluteUrl(STATS_JSON_PATH) }],
  };
}

function ShareTable({ caption, head, items, total }: { caption: string; head: string; items: StatsShare[]; total: number }) {
  return <div className="overflow-hidden rounded-xl border border-line bg-surface">
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <colgroup><col /><col className="w-[30%]" /><col className="w-[24%]" /></colgroup>
      <thead><tr className="border-b border-line"><th scope="col" className="px-4 py-3 font-medium">{head}</th><th scope="col" className="px-4 py-3 text-right font-medium">Kahve</th><th scope="col" className="px-4 py-3 text-right font-medium">Kavurucu</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.path} className="border-b border-line last:border-b-0">
        <th scope="row" className="px-4 py-3 font-normal"><Link href={item.path} prefetch={false} className="text-accent hover:underline">{item.label}</Link></th>
        <td className="px-4 py-3 text-right tabular-nums">{number(item.coffees)} <span className="text-muted">({share(item.coffees, total)})</span></td>
        <td className="px-4 py-3 text-right tabular-nums">{number(item.roasters)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export const statsBreadcrumbs = () => breadcrumbList([[brand.name, '/'], ['Veri', STATS_PATH]]);

/** The numbers page (/veri) for one night's stats: every figure with a dated sentence and its credit, the tables, the open
 * copy and how to cite it. No catalog read here; the page passes in the derived result. */
export function CatalogNumbers({ stats }: { stats: CatalogStats }) {
  const asOf = statsDate(stats);
  const snippet = `<a href="${absoluteUrl(STATS_PATH)}">Kaynak: ${brand.name}</a> (${LICENSE.name})`;
  return <div className="page-shell section-space">
    <JsonLd data={statsBreadcrumbs()} />
    <JsonLd data={datasetJsonLd(stats)} />
    <header className="max-w-3xl">
      <p className="eyebrow">Açık veri · {trMonth(asOf)}</p>
      <h1 className="mt-3 font-display text-title">Kahve kataloğu rakamları</h1>
      <p className="mt-5 text-[17px] leading-8 text-muted">Türkiye’deki bağımsız kavurucuların kendi sitelerinde satışta olan nitelikli kahveler, rakamlarla. Her rakam alıntılanabilir bir cümleyle ve tarihiyle verilir; kaynak göstererek ({brand.name}) serbestçe kullanabilirsin.</p>
      <p className="mt-3 text-sm text-muted">Son güncelleme: <time dateTime={asOf}>{trDate(asOf)}</time>. Katalog her gece yenilenir; bu sayfa ve <a href={STATS_JSON_PATH} className="text-accent hover:underline">JSON kopyası</a> o gecenin rakamlarını gösterir.</p>
    </header>

    <section className="mt-12" aria-labelledby="ozet"><h2 id="ozet" className="mb-5 font-display text-heading">Özet</h2>
      <ul className="card-grid">{statsFigures(stats).map(figure => <li key={figure.id} id={figure.id} className="flex flex-col rounded-xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">{figure.label}</p>
        <p className="mt-1 font-display text-[32px] leading-tight">{figure.value}</p>
        <blockquote className="mt-4 text-[15px] leading-7">{figure.sentence}</blockquote>
        {credit}
      </li>)}</ul>
    </section>

    {stats.bagPrices.length ? <section className="mt-12 max-w-3xl" aria-labelledby="paket"><h2 id="paket" className="mb-3 font-display text-heading">Gramaja göre paket fiyatları</h2>
      <p className="mb-5 text-[15px] leading-7 text-muted">Her kahvenin o gramajdaki stoktaki en ucuz paketi; en az {MIN_SIZE_COFFEES} kahvede bulunan gramajlar. Fiyatlar paket fiyatıdır, kargo dahil değildir.</p>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Gramaja göre paket fiyatları, {trDate(asOf)}</caption>
          <thead><tr className="border-b border-line"><th scope="col" className="px-3 py-3 font-medium">Paket</th><th scope="col" className="px-3 py-3 text-right font-medium">Kahve</th><th scope="col" className="px-3 py-3 text-right font-medium">Ortanca</th><th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">Aralık</th></tr></thead>
          <tbody>{stats.bagPrices.map(bag => <tr key={bag.weightG} className="border-b border-line last:border-b-0">
            <th scope="row" className="px-3 py-3 font-normal">{bagSize(bag.weightG)}</th>
            <td className="px-3 py-3 text-right tabular-nums">{number(bag.coffees)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{lira(bag.median)}<span className="block text-xs text-muted sm:hidden">{lira(bag.min)} – {lira(bag.max)}</span></td>
            <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{lira(bag.min)} – {lira(bag.max)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {credit}
    </section> : null}

    <div className="mt-12 grid gap-10 lg:grid-cols-2">
      {stats.origins.length ? <section aria-labelledby="kokenler"><h2 id="kokenler" className="mb-3 font-display text-heading">Kökenler</h2>
        <p className="mb-5 text-[15px] leading-7 text-muted">Kökenine göre satıştaki kahveler. Harmanlar birden fazla kökene sayılır; paylar {number(stats.coffees)} kahveye göredir.</p>
        <ShareTable caption={`Kökene göre kahveler, ${trDate(asOf)}`} head="Köken" items={stats.origins} total={stats.coffees} />{credit}</section> : null}
      {stats.processes.length ? <section aria-labelledby="islemler"><h2 id="islemler" className="mb-3 font-display text-heading">İşlemler</h2>
        <p className="mb-5 text-[15px] leading-7 text-muted">İşlemine göre satıştaki kahveler. İşlemi belirtilmeyen kahveler sayılmaz; paylar {number(stats.coffees)} kahveye göredir.</p>
        <ShareTable caption={`İşleme göre kahveler, ${trDate(asOf)}`} head="İşlem" items={stats.processes} total={stats.coffees} />{credit}</section> : null}
    </div>

    <section className="mt-12 max-w-3xl" aria-labelledby="acik-veri"><h2 id="acik-veri" className="mb-3 font-display text-heading">Açık veri ve alıntı</h2>
      <p className="text-[15px] leading-7">Bu sayfadaki rakamlar <a href={LICENSE.url} rel="license" className="text-accent hover:underline">Creative Commons Atıf 4.0 (CC BY 4.0)</a> lisansıyla paylaşılır: kaynak olarak {brand.name}’u gösterip bu sayfaya bağlantı verdiğin sürece haberde, araştırmada ya da kendi sitende kullanabilirsin. Aynı rakamlar makinelerin okuyacağı biçimde, sabit bir adreste: <a href={STATS_JSON_PATH} className="text-accent hover:underline">{absoluteUrl(STATS_JSON_PATH)}</a>.</p>
      <p className="mt-5 text-sm font-semibold">Kopyalayıp yapıştırabileceğin bağlantı</p>
      <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm"><code>{snippet}</code></pre>
      <h3 className="mt-8 font-display text-2xl">Nasıl hesaplanıyor?</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted">
        <li>Katalog, Türkiye’deki bağımsız kavurucuların kendi sitelerinden her gece okunur. Yalnızca satışta ve stokta olan nitelikli kahveler sayılır; satış kavurucunun sitesinde yapılır.</li>
        <li>Yeni gelenler <Link href="/yeni" className="text-accent hover:underline">Yeni gelenler</Link> sayfasıyla aynı kuralla sayılır: kavurucunun son {stats.newArrivals.days} günde satışa çıkardığı kahveler. Fiyatı düşenler <Link href="/firsatlar" className="text-accent hover:underline">Fırsatlar</Link> sayfasıyla aynı kuralla: son {stats.priceDrops.days} günde aynı paketin fiyatı düşmüş ve yeni fiyat hâlâ geçerli.</li>
        <li>Köken ve işlem kavurucunun sayfasından gelir; kavurucu belirtmediyse ürün açıklamasından çıkarılmış olabilir. Bilmediğimizi boş bırakırız.</li>
      </ul>
    </section>

    <nav aria-label="İlgili sayfalar" className="mt-14 border-t border-line pt-8"><h2 className="mb-4 font-display text-heading">Karşılaştırmalar</h2>
      <ul className="flex flex-wrap gap-2">{COMPARISONS.slice(0, 6).map(item => <li key={item.slug}><Link href={`/karsilastir/${item.slug}`} prefetch={false} className="filter-option">{comparisonQuestion(item)}</Link></li>)}
        <li><Link href="/karsilastir" className="filter-option">Tüm karşılaştırmalar</Link></li></ul></nav>
  </div>;
}
