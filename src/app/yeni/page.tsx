import { listingMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { DiscoveryCatalog, type DiscoverySearchParams } from '@/components/v2/discovery-catalog';
import { getFirstSearchParamValue } from '@/lib/filter-contract';
import { ARRIVAL_DAYS } from '../../../shared/v2/events';
import { dropTrackingParams } from '@/lib/v2-runtime';
export async function generateMetadata({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }): Promise<Metadata> {
  return listingMetadata('Yeni gelen kahveler', `Kavurucuların son ${ARRIVAL_DAYS} günde satışa çıkardığı nitelikli kahveler, en yenisi önce: köken, işlem, tadım notları ve paket fiyatları. Yeniden satışa girenler ayrı listede.`, '/yeni', await searchParams);
}
/** Default view: genuine arrivals (GENUINE_NEW in shared/v2/catalog.ts). ?event=RESTOCKED: packages back in stock, a separate list. */
export default async function NewPage({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }) {
  const params = await searchParams;
  dropTrackingParams('/yeni', params);
  const restocked = getFirstSearchParamValue(params.event) === 'RESTOCKED';
  return <div className="page-shell section-space"><p className="eyebrow">Keşif defteri</p><h1 className="mt-3 font-display text-title">{restocked ? 'Tekrar raflarda.' : 'Yeni gelenler.'}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{restocked ? 'Son 7 günde yeniden satışta gördüğümüz paketler. Bunlar yeni kahve değil, stoğa dönen kahveler.' : `Kavurucuların son ${ARRIVAL_DAYS} günde satışa çıkardığı kahveler, en yenisi önce. Mağazaları her gece tarıyoruz; geliş tarihi, bir kahveyi ilk gördüğümüz gecedir.`}</p><nav aria-label="Liste türü" className="my-6 flex gap-3"><Link href="/yeni" className={restocked ? 'button-light' : 'button-dark'}>Yeni gelenler</Link><Link href="/yeni?event=RESTOCKED" prefetch={false} className={restocked ? 'button-dark' : 'button-light'}>Tekrar stokta</Link></nav><DiscoveryCatalog params={params} path="/yeni" event={restocked ? 'RESTOCKED' : 'NEW'} />{signupsEnabled() && <NewsletterForm source="new" variant="card" className="mt-12" title="Yeni gelenleri kaçırma" description="Yeni çıkan kahveleri haftalık fiyat özetinde, ayın favorilerini aylık bültende gönderelim." />}</div>;
}
