import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
import { getFirstSearchParamValue } from '@/lib/filter-contract';
export const metadata: Metadata = pageMetadata('Yeni kahve keşifleri', 'Yeni kahve keşifleri ve yeniden satışa giren paketler.', '/yeni');
export default async function NewPage({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }) {
  const params = await searchParams;
  const restocked = getFirstSearchParamValue(params.event) === 'RESTOCKED';
  return <div className="page-shell section-space"><p className="eyebrow">Keşif defteri</p><h1 className="mt-3 font-display text-5xl">{restocked ? 'Tekrar raflarda.' : 'Yeni keşifler.'}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#625e57]">{restocked ? 'Son 7 günde yeniden satışta gördüğümüz paketler.' : 'Kavuruculardan keşfedilecek çekirdekler. Yeni tatlara yer aç.'}</p><nav aria-label="Keşif türü" className="my-6 flex gap-3"><Link href="/yeni" className={restocked ? 'button-light' : 'button-dark'}>Keşfet</Link><Link href="/yeni?event=RESTOCKED" className={restocked ? 'button-dark' : 'button-light'}>Geri gelenler</Link></nav><DiscoveryCatalog params={params} path="/yeni" event={restocked ? 'RESTOCKED' : undefined} /></div>;
}
