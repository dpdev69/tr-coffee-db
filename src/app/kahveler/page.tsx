import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
export const metadata:Metadata=pageMetadata('Kahveler','Türkiye’nin nitelikli kahvelerini köken, işlem, tat ve paket fiyatıyla keşfet. Siparişini doğrudan kavurucudan ver.','/kahveler');
export default async function CoffeesPage({searchParams}:{searchParams:Promise<DiscoverySearchParams>}){return <div className="page-shell section-space"><div className="section-heading"><div><p className="eyebrow">Katalog</p><h1 className="mt-3 font-display text-5xl">Bir sonraki kahven.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Tatla başla, paketleri karşılaştır. İlgini çekeni doğrudan kavurucuda incele.</p></div></div><DiscoveryCatalog params={await searchParams}/></div>;}
