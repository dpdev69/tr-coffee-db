import { CoffeeImage } from './coffee-image';
import Link from 'next/link';
import { CompareToggle } from '@/components/coffee/compare-controls';
import { formatMoney } from '@/lib/coffee-display';
import { ROAST_LABELS } from '@/lib/constants/filter-options';
import type { CatalogCoffee, CatalogOffer } from '../../../shared/v2/catalog';
import { coffeeOrigin, coffeeProcess, currentBadges, EVENT_LABELS, featureText, OfferPrice, publicOfferLabel, tasteSummary } from './discovery-card';

/** Round serif initial on tint; stands in for a roaster logo we do not have. */
const INITIAL_SIZES={sm:'h-11 w-11 bg-ground text-[19px]',md:'h-14 w-14 bg-surface text-2xl',lg:'h-28 w-28 bg-tint text-5xl'};
/** Round display-face initial; warm stays on ground/surface at small sizes, where it passes AA (on tint only at 48px). */
export function RoasterInitial({name,size='md'}:{name:string;size?:keyof typeof INITIAL_SIZES}){
  return <span aria-hidden="true" className={`inline-flex flex-none items-center justify-center rounded-full font-display text-warm ${INITIAL_SIZES[size]}`}>{name.trim().charAt(0).toLocaleUpperCase('tr-TR')}</span>;
}

type Fact=[label:string,value:string|null|undefined,source:string|null];
export function DiscoveryDetail({coffee}:{coffee:CatalogCoffee}){
  const tastes=tasteSummary(coffee),raw=coffee.rawMetadata;
  const declaredScore=typeof raw.scaScore==='number'&&Number.isFinite(raw.scaScore)&&raw.scaScore>0&&raw.scaScore<=100?raw.scaScore.toLocaleString('tr-TR'):null;
  const roast=raw.roast??featureText(coffee,'roast_classification','roast_level')[0];
  // Raw fields are what the roaster published; feature fallbacks say whether a rule inferred them from the description.
  const source=(rawValue:unknown,...features:string[])=>rawValue?'kavurucu belirtiyor':coffee.features.find(f=>features.includes(f.feature))?.sourceType==='RULE_INFERRED'?'açıklamadan çıkarıldı':'kavurucu belirtiyor';
  const declared='kavurucu belirtiyor';
  const facts:Fact[]=[['Köken',coffeeOrigin(coffee),source(raw.country,'normalized_origin','origin_country')],['Bölge',raw.region,declared],['Üretici',raw.producer,declared],['Çiftlik',raw.farm,declared],['Rakım',raw.altitude,declared],['İşlem',coffeeProcess(coffee),source(raw.process,'process_family','process')],['Varyete',raw.varieties?.join(' · ')||featureText(coffee,'normalized_variety','variety').join(' · '),source(raw.varieties?.length,'normalized_variety','variety')],['Kavrum',roast?(ROAST_LABELS[roast]??roast):null,source(raw.roast,'roast_classification','roast_level')],['Hasat',raw.harvestYear,declared],['Kavrum tarihi',raw.roastDate,declared],...(declaredScore?[['SCA · kavurucu beyanı',declaredScore,null] as Fact]:[])];
  const notes=raw.tastingNotes?.length?raw.tastingNotes:featureText(coffee,'flavor_notes_normalized');
  const renderOffer=(offer:CatalogOffer)=><div key={offer.id} className={`rounded-xl bg-surface px-4 py-3.5 ${offer.inStock===true?'border border-line':'border border-dashed border-line'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-base font-semibold">{publicOfferLabel(offer)}{offer.inStock===false?<span className="font-normal text-muted"> · Tükendi</span>:offer.inStock===null?<span className="font-normal text-muted"> · Stok doğrulanmadı</span>:null}</p><OfferPrice offer={offer}/></div>{offer.purchaseUrl?<a href={`/go/${offer.id}?source=detail`} className={offer.inStock===true?'button-dark':'button-light'} rel="nofollow">Kavurucuda gör ↗</a>:<span className="text-sm text-muted">Satış bağlantısı doğrulanmadı</span>}</div>
            {offer.compareAtMinor!=null&&offer.priceMinor!=null&&offer.compareAtMinor>offer.priceMinor?<p className="mt-3 text-xs leading-5 text-muted">Kavurucu referans fiyatı: {formatMoney(offer.compareAtMinor/100,offer.currency??'(para birimi belirtilmemiş)')}. Bu beyan, geçmiş gözlemlerimizle doğrulanmış bir indirim anlamına gelmez.</p>:null}</div>;
  return <>
    <nav aria-label="İçerik yolu" className="mb-4 flex flex-wrap items-center gap-2 text-sm"><Link href="/kahveler" className="inline-flex min-h-11 items-center text-accent hover:underline">Kahveler</Link><span className="text-muted" aria-hidden="true">/</span><Link href={`/kavurucu/${coffee.roaster.slug}`} className="inline-flex min-h-11 items-center text-accent hover:underline">{coffee.roaster.name}</Link><span className="text-muted" aria-hidden="true">/</span><span className="text-muted" aria-current="page">{coffee.name}</span></nav>
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="relative aspect-square max-w-[560px] overflow-hidden rounded-[18px] bg-tint lg:rounded-3xl">{raw.imageUrl&&/^https?:\/\//.test(raw.imageUrl)?<CoffeeImage roaster={coffee.roaster.name} source={raw.imageUrl} alt={coffee.name} sizes="(max-width: 1023px) 90vw, 45vw" loading="eager" className="absolute inset-0 h-full w-full object-contain p-8"/>:<div className="flex h-full items-center justify-center p-12 text-center font-display text-5xl text-accent">{coffee.roaster.name}</div>}</div>
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2.5 flex flex-wrap items-center gap-2 text-[15px]"><Link href={`/kavurucu/${coffee.roaster.slug}`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">{coffee.roaster.name}</Link>{coffee.roaster.city?<span className="text-muted">· {coffee.roaster.city}</span>:null}{currentBadges(coffee).map(event=><span key={event.id} className="coffee-card-badge">{EVENT_LABELS[event.type]}</span>)}</p>
          <h1 className="mb-3.5 font-display text-[clamp(32px,4vw,50px)] leading-[1.06]">{coffee.name}</h1>
          <p className="mb-3.5 text-[17px]">{[coffeeOrigin(coffee),coffeeProcess(coffee),roast&&roast!=='unknown'?ROAST_LABELS[roast]:null].filter(Boolean).join(' · ')||<span className="italic text-muted">Köken ve işlem bilgisi bekleniyor</span>}</p>
          {(notes.length?notes.slice(0,5):tastes).length?<ul aria-label="Tadım notları" className="flex flex-wrap gap-2">{(notes.length?notes.slice(0,5):tastes).map(note=><li key={note} className="rounded-full bg-chip px-3.5 py-1.5 text-[15px] text-accent-deep">{note}</li>)}</ul>:<p className="italic text-muted">Tat profili henüz belirtilmemiş</p>}
        </div>
        <div><h2 className="mb-2.5 font-display text-[22px]">Paketini seç</h2>
          <div className="space-y-2.5">{coffee.offers.length===0?<p className="rounded-xl bg-tint p-4 text-sm text-muted">Bu kahvenin satışta bir paketi şu an doğrulanmıyor. Bilgilerini burada koruyoruz.</p>:null}{coffee.offers.slice(0,6).map(renderOffer)}{coffee.offers.length>6?<details><summary className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Tüm {coffee.offers.length} paketi göster</summary><div className="mt-3 space-y-2.5">{coffee.offers.slice(6).map(renderOffer)}</div></details>:null}</div>
          <p className="mt-3 text-sm leading-6 text-muted">Güncel fiyatı ve stoğu kavurucuda gör. Satış ve teslimat kavurucu tarafından yapılır.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><CompareToggle slug={coffee.slug} name={coffee.name}/></div>
      </div>
    </div>
    <section className="mt-14">
      <h2 className="mb-2 font-display text-3xl">Çekirdeği tanı.</h2>
      <dl className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">{facts.map(([label,value,from])=><div key={label} className="border-b border-line py-3.5"><dt className="mb-1 text-[13px] text-muted">{label}</dt>{value?<dd className="font-medium">{value}{from?<span className="block text-xs font-normal text-muted">{from}</span>:null}</dd>:<dd className="italic text-muted">Kavurucu belirtmemiş</dd>}</div>)}</dl>
      {notes.length?<div className="mt-6"><h3 className="text-sm font-semibold">Tadım notları</h3><p className="mt-2 text-sm leading-7 text-muted">{notes.join(' · ')}</p></div>:null}
      {raw.description?<details className="mt-5"><summary className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Kavurucunun açıklaması</summary><p className="mt-3 max-w-3xl whitespace-pre-line text-[15px] leading-7">{raw.description}</p></details>:null}
    </section>
    <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-tint px-6 py-6 sm:px-8"><div className="flex items-center gap-4"><RoasterInitial name={coffee.roaster.name}/><span><span className="block font-display text-2xl">{coffee.roaster.name}</span>{coffee.roaster.city?<span className="text-sm text-muted">{coffee.roaster.city}</span>:null}</span></div><Link href={`/kavurucu/${coffee.roaster.slug}`} className="button-light">Bu kavurucunun tüm kahveleri →</Link></section>
  </>;
}
