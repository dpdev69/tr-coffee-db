import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { DiscoveryEmpty } from '@/components/v2/discovery-card';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { listRoasters } from '../../../shared/v2/catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMetadata("Kavurucular", "Türkiye’nin bağımsız kahve kavurucularını ve satıştaki çekirdeklerini keşfet.", "/kavurucular");
export default async function RoastersPage() {
  let roasters: Awaited<ReturnType<typeof listRoasters>>;
  try { roasters = await listRoasters(await getCatalogDatabase()); }
  catch (error) { unstable_rethrow(error); return <div className="page-shell section-space"><DataSourceNotice title="Kavurucular şu an yüklenemiyor." message="Güncel kataloğa ulaşamadık. Biraz sonra yeniden deneyebilirsin." /></div>; }
  return <div className="page-shell section-space"><p className="eyebrow">Çekirdeğin arkasındaki insanlar</p><h1 className="mt-3 font-display text-5xl">Kavurucuları tanı.</h1><p className="mb-9 mt-4 max-w-2xl text-sm leading-7 text-[#625e57]">Kataloğumuzda satışta kahvesi bulunan {roasters.length} kavurucu. Çekirdekleri keşfet, siparişini doğrudan kavurucudan ver.</p>
    {roasters.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{roasters.map(roaster => <Link href={`/kavurucu/${roaster.slug}`} key={roaster.id} className="group flex min-h-48 flex-col rounded-xl border border-[#dedfd7] bg-white p-6 transition-colors hover:border-[#244b3d]"><p className="text-xs text-[#625e57]">{roaster.city || 'Bağımsız kavurucu'}</p><h2 className="mt-3 font-display text-3xl group-hover:underline">{roaster.name}</h2><p className="mt-auto flex items-center justify-between pt-6 text-sm text-[#244b3d]"><span>{roaster.coffeeCount} kahve · {roaster.offerCount} paket</span><span aria-hidden="true">↗</span></p></Link>)}</div> : <DiscoveryEmpty title="Kavurucu listesi henüz oluşmadı.">Satıştaki kahveleri doğruladığımızda kavurucular burada görünecek.</DiscoveryEmpty>}
  </div>;
}
