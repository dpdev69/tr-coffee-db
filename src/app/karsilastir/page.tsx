import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { JsonLd, breadcrumbList, itemList, webPage } from '@/components/layout/json-ld';
import { COMPARISONS, GROUP_LABELS, comparisonFacts, comparisonQuestion, sideKey, sideLabel, type Comparison, type ComparisonData } from '@/lib/comparisons';
import { pageMetadata } from '@/lib/page-metadata';
import { dropTrackingParams, getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;
const description = 'Etiyopya mı Kolombiya mı, natürel mi yıkanmış mı, espresso mu filtre mi? Satıştaki çekirdeklerin fiyatı, kökeni, işlemi ve tat notları yan yana.';
export const metadata: Metadata = pageMetadata('Kahve karşılaştırmaları', description, '/karsilastir');
const asOf = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

const GROUPS: Comparison['group'][] = ['koken', 'islem', 'demleme', 'kavurucu'];

export default async function ComparisonsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  dropTrackingParams('/karsilastir', await searchParams);
  // The counts are a bonus here: without the catalog the links still work.
  let data: ComparisonData | null = null;
  try { data = await comparisonFacts(await getCatalogDatabase()); }
  catch (error) { unstable_rethrow(error); keepOutOfEdgeCache(); }
  const count = (item: Comparison) => data ? `${sideLabel(item.a)} ${data.sides[sideKey(item.a)]?.coffees ?? 0} çekirdek · ${sideLabel(item.b)} ${data.sides[sideKey(item.b)]?.coffees ?? 0} çekirdek` : null;
  return <div className="page-shell section-space">
    <JsonLd data={webPage('Kahve karşılaştırmaları', description, '/karsilastir', { type: 'CollectionPage', dateModified: data?.at })} />
    <JsonLd data={breadcrumbList([['Karşılaştırmalar', '/karsilastir']])} />
    <JsonLd data={{ ...itemList(COMPARISONS.map(item => [comparisonQuestion(item), `/karsilastir/${item.slug}`]), { total: COMPARISONS.length }), name: 'Kahve karşılaştırmaları' }} />
    <p className="eyebrow">Hangisini seçmeli?</p>
    <h1 className="mt-3 font-display text-title">Kahve karşılaştırmaları</h1>
    <p className="mb-10 mt-4 max-w-2xl text-sm leading-7 text-muted">Sık sorulan “hangisi?” sorularını satıştaki çekirdeklerle cevaplıyoruz: 250 g paket fiyatları, köken, işlem ve tat notları yan yana. Rakamlar her gece kavurucuların kendi sitelerinden güncellenir.{data ? <> Son güncelleme: <time dateTime={data.at}>{asOf(data.at)}</time>.</> : null}</p>
    {GROUPS.map(group => {
      const items = COMPARISONS.filter(item => item.group === group);
      return items.length ? <section key={group} className="mb-10"><h2 className="mb-4 font-display text-heading">{GROUP_LABELS[group]}</h2>
        <div className="card-grid">{items.map(item => <Link key={item.slug} href={`/karsilastir/${item.slug}`} className="group flex flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent">
          <h3 className="font-display text-2xl group-hover:underline">{comparisonQuestion(item)}</h3>
          {count(item) ? <p className="mt-auto pt-6 text-sm text-accent">{count(item)}</p> : null}
        </Link>)}</div></section> : null;
    })}
    <nav aria-label="Daha fazlası" className="border-t border-line pt-8 text-sm leading-7 text-muted">
      Kataloğun tamamı rakamlarla, kaynak göstererek alıntılanabilir: <Link href="/veri" prefetch={false} className="text-accent hover:underline">Veri özeti</Link>. Seçimin hâlâ net değilse <Link href="/quiz" className="text-accent hover:underline">kahve testini</Link> çöz ya da <Link href="/guide" className="text-accent hover:underline">rehberde</Link> işlem ve kavrum farklarına bak.
    </nav>
  </div>;
}
