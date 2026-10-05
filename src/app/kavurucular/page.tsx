import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { DiscoveryEmpty } from '@/components/v2/discovery-card';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { listRoasters } from '../../../shared/v2/catalog';
import { JsonLd, itemList } from '@/components/layout/json-ld';

// Matches the 5-minute D1 read cache: the edge may serve a page this stale, never older.
export const revalidate = 300;
export const metadata: Metadata = pageMetadata("Kavurucular", "Türkiye’deki bağımsız kahve kavurucuları ve satıştaki çekirdekleri: her kavurucunun şehri, kahve ve paket sayısı. Siparişini doğrudan kavurucudan ver.", "/kavurucular");
export default async function RoastersPage() {
  let roasters: Awaited<ReturnType<typeof listRoasters>>;
  try { roasters = await listRoasters(await getCatalogDatabase()); }
  catch (error) { unstable_rethrow(error); return <div className="page-shell section-space"><DataSourceNotice title="Kavurucular şu an yüklenemiyor." message="Güncel kataloğa ulaşamadık. Biraz sonra yeniden deneyebilirsin." /></div>; }
  return <div className="page-shell section-space">{roasters.length ? <JsonLd data={itemList(roasters.map(roaster => [roaster.name, `/kavurucu/${roaster.slug}`]), { total: roasters.length })} /> : null}<p className="eyebrow">Çekirdeğin arkasındaki insanlar</p><h1 className="mt-3 font-display text-5xl">Kavurucuları tanı.</h1><p className="mb-9 mt-4 max-w-2xl text-sm leading-7 text-muted">Kataloğumuzda satışta kahvesi bulunan {roasters.length} kavurucu. Çekirdekleri keşfet, siparişini doğrudan kavurucudan ver.</p>
    {roasters.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{roasters.map(roaster => <Link href={`/kavurucu/${roaster.slug}`} key={roaster.id} className="group flex flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent"><p className="text-[13px] text-muted">{roaster.city || 'Bağımsız kavurucu'}</p><h2 className="mt-1.5 font-display text-2xl group-hover:underline">{roaster.name}</h2><p className="mt-auto flex items-center justify-between pt-6 text-sm text-accent"><span>{roaster.coffeeCount} kahve · {roaster.offerCount} paket</span><span aria-hidden="true">↗</span></p></Link>)}</div> : <DiscoveryEmpty title="Kavurucu listesi henüz oluşmadı.">Satıştaki kahveleri doğruladığımızda kavurucular burada görünecek.</DiscoveryEmpty>}
  </div>;
}
