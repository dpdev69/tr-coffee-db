import { CoffeeImage } from './coffee-image';
import Link from 'next/link';
import { CompareToggle } from '@/components/coffee/compare-controls';
import { formatMoney } from '@/lib/coffee-display';
import { ROAST_LABELS } from '@/lib/constants/filter-options';
import type { CatalogCoffee, CatalogOffer } from '../../../shared/v2/catalog';
import { coffeeOrigin, coffeeProcess, currentBadges, EVENT_LABELS, featureText, OfferPrice, publicOfferLabel, tasteSummary } from './discovery-card';

export function DiscoveryDetail({coffee}:{coffee:CatalogCoffee}){
  const tastes=tasteSummary(coffee),raw=coffee.rawMetadata;
  const declaredScore=typeof raw.scaScore==='number'&&Number.isFinite(raw.scaScore)&&raw.scaScore>0&&raw.scaScore<=100?raw.scaScore.toLocaleString('tr-TR'):null;
  const roast=raw.roast??featureText(coffee,'roast_classification','roast_level')[0];
  const facts:[string,string|null|undefined][]=[['Köken',coffeeOrigin(coffee)],['Bölge',raw.region],['Üretici',raw.producer],['Çiftlik',raw.farm],['Rakım',raw.altitude],['İşlem',coffeeProcess(coffee)],['Varyete',raw.varieties?.join(' · ')||featureText(coffee,'normalized_variety','variety').join(' · ')],['Kavrum',roast?(ROAST_LABELS[roast]??roast):null],['Hasat',raw.harvestYear],['Kavrum tarihi',raw.roastDate],...(declaredScore?[['SCA · kavurucu beyanı',declaredScore] as [string,string]]:[])];
  const renderOffer=(offer:CatalogOffer)=><div key={offer.id} className="rounded-lg border border-line bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 text-xs font-semibold text-muted">{publicOfferLabel(offer)}{offer.inStock===false?' · Tükendi':offer.inStock===null?' · Stok doğrulanmadı':''}</p><OfferPrice offer={offer}/></div>{offer.purchaseUrl?<a href={`/go/${offer.id}?source=detail`} className={offer.inStock===true?'button-dark':'button-light border border-line'} rel="nofollow">Kavurucuda gör ↗</a>:<span className="text-sm text-muted">Satış bağlantısı doğrulanmadı</span>}</div>
            {offer.compareAtMinor!=null&&offer.priceMinor!=null&&offer.compareAtMinor>offer.priceMinor?<p className="mt-3 text-xs leading-5 text-muted">Kavurucu referans fiyatı: {formatMoney(offer.compareAtMinor/100,offer.currency??'(para birimi belirtilmemiş)')}. Bu beyan, geçmiş gözlemlerimizle doğrulanmış bir indirim anlamına gelmez.</p>:null}</div>;
  return <>
    <nav aria-label="İçerik yolu" className="mb-6 flex flex-wrap gap-2 text-xs text-muted"><Link href="/kahveler" className="underline">Kahveler</Link><span>/</span><Link href={`/kavurucu/${coffee.roaster.slug}`} className="underline">{coffee.roaster.name}</Link></nav>
    <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-tint">{raw.imageUrl&&/^https?:\/\//.test(raw.imageUrl)?<CoffeeImage source={raw.imageUrl} alt={coffee.name} sizes="(max-width: 1023px) 90vw, 45vw" loading="eager" className="absolute inset-0 h-full w-full object-contain p-8"/>:<div className="flex h-full items-center justify-center p-12 text-center font-display text-5xl text-accent">{coffee.roaster.name}</div>}</div>
      <div>
        <Link href={`/kavurucu/${coffee.roaster.slug}`} className="eyebrow hover:underline">{coffee.roaster.name}</Link>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{coffee.name}</h1>
        <div className="mt-4 flex flex-wrap gap-2">{currentBadges(coffee).map(event=><span key={event.id} className="rounded bg-lime px-3 py-1.5 text-xs font-semibold text-accent">{EVENT_LABELS[event.type]}</span>)}</div>
        <p className="mt-5 text-xl font-medium text-accent">{tastes.join(' · ')||raw.tastingNotes?.slice(0,3).join(' · ')||'Tat profili henüz belirtilmemiş'}</p>
        <p className="mt-2 text-sm text-muted">{[coffeeOrigin(coffee),coffeeProcess(coffee)].filter(Boolean).join(' · ')||'Köken ve işlem bilgisi bekleniyor'}</p>
        <div className="mt-7 border-t border-line pt-6"><h2 className="text-lg font-semibold">Paketini seç</h2><p className="mt-1 text-sm leading-6 text-muted">Güncel fiyatı ve stoğu kavurucuda gör. Satış ve teslimat kavurucu tarafından yapılır.</p>
          <div className="mt-4 space-y-3">{coffee.offers.length===0?<p className="rounded-lg bg-tint p-4 text-sm text-muted">Bu kahvenin satışta bir paketi şu an doğrulanmıyor. Bilgilerini burada koruyoruz.</p>:null}{coffee.offers.slice(0,6).map(renderOffer)}{coffee.offers.length>6?<details><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline underline-offset-4">Tüm {coffee.offers.length} paketi göster</summary><div className="mt-3 space-y-3">{coffee.offers.slice(6).map(renderOffer)}</div></details>:null}</div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3"><CompareToggle slug={coffee.slug} name={coffee.name}/></div>
      </div>
    </div>
    <section className="mt-12 border-t border-line pt-8">
      <div><h2 className="font-display text-3xl">Çekirdeği tanı.</h2><dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">{facts.map(([label,value])=><div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-sm font-medium">{value||'Belirtilmemiş'}</dd></div>)}</dl>
        {(raw.tastingNotes?.length||featureText(coffee,'flavor_notes_normalized').length)?<div className="mt-6"><h3 className="text-sm font-semibold">Tadım notları</h3><p className="mt-2 text-sm leading-7 text-muted">{raw.tastingNotes?.join(' · ')||featureText(coffee,'flavor_notes_normalized').join(' · ')}</p></div>:null}
        {raw.description?<details className="mt-5"><summary className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Kavurucunun açıklaması</summary><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted">{raw.description}</p></details>:null}
      </div>
    </section>
  </>;
}
