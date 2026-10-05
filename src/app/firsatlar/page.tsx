import { listingMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
import { getFirstSearchParamValue } from '@/lib/filter-contract';
import { dropTrackingParams } from '@/lib/v2-runtime';
export async function generateMetadata({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }): Promise<Metadata> {
  return listingMetadata("Fiyatı düşen kahveler", "Son 7 günde fiyatı düşen nitelikli kahveler: aynı paket, aynı gramaj ve aynı para birimiyle doğrulanmış düşüşler. Siparişini doğrudan kavurucudan ver.", "/firsatlar", await searchParams);
}
export default async function DealsPage({searchParams}:{searchParams:Promise<DiscoverySearchParams>}){const params=await searchParams;dropTrackingParams('/firsatlar',params);const event=getFirstSearchParamValue(params.event)==='DEAL'?'DEAL':'PRICE_DROP';return <div className="page-shell section-space"><p className="eyebrow">Gerçek fiyat değişimleri</p><h1 className="mt-3 font-display text-5xl">{event==='DEAL'?'İyi kahve, iyi fırsat.':'Fiyatı düşenler.'}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{event==='DEAL'?'Aynı paketin en az iki başarılı kontrolde gördüğümüz fiyatına göre %10 veya daha fazla düşüşler. Yalnızca hâlâ geçerli fiyatları gösteriyoruz.':'Aynı paket, aynı gramaj ve aynı para birimi. Son 7 gündeki doğrulanmış fiyat düşüşleri.'}</p><nav aria-label="Fırsat türü" className="my-6 flex flex-wrap gap-3"><Link href="/firsatlar" className={event==='PRICE_DROP'?'button-dark':'button-light'}>Tüm fiyat düşüşleri</Link><Link href="/firsatlar?event=DEAL" className={event==='DEAL'?'button-dark':'button-light'}>Doğrulanmış fırsatlar</Link></nav><DiscoveryCatalog params={params} path="/firsatlar" event={event}/>{signupsEnabled() && <NewsletterForm source="deals" variant="card" className="mt-12" title="Fiyat düşünce haber verelim" description="Fiyatı düşenleri haftalık fiyat özetinde, ayın seçkisini aylık bültende gönderiyoruz."/>}</div>;}
