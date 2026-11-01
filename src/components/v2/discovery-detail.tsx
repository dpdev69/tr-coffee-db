import { CoffeeImage } from './coffee-image';
import Link from 'next/link';
import { CompareToggle } from '@/components/coffee/compare-controls';
import { displayCoffeeName, displayNotes, formatMoney } from '@/lib/coffee-display';
import { ROAST_LABELS } from '@/lib/constants/filter-options';
import type { CatalogCoffee, CatalogOffer } from '../../../shared/v2/catalog';
import { coffeeOrigin, coffeeProcess, currentBadges, EVENT_LABELS, featureText, OfferPrice, preferredOffer, publicOfferLabel, savedPackage, tasteSummary } from './discovery-card';
import { SaveToggle } from '@/components/coffee/saved-list';
import { originLanding, processLanding } from '@/lib/catalog-landing';

/** Round serif initial on tint; stands in for a roaster logo we do not have. */
const INITIAL_SIZES={sm:'h-11 w-11 bg-ground text-[19px]',md:'h-14 w-14 bg-surface text-2xl',lg:'h-28 w-28 bg-tint text-5xl'};
/** Round display-face initial; warm stays on ground/surface at small sizes, where it passes AA (on tint only at 48px). */
export function RoasterInitial({name,size='md'}:{name:string;size?:keyof typeof INITIAL_SIZES}){
  return <span aria-hidden="true" className={`inline-flex flex-none items-center justify-center rounded-full font-display text-warm ${INITIAL_SIZES[size]}`}>{name.trim().charAt(0).toLocaleUpperCase('tr-TR')}</span>;
}

type Fact=[label:string,value:string|null|undefined,href?:string];
export function DiscoveryDetail({coffee}:{coffee:CatalogCoffee}){
  const tastes=tasteSummary(coffee),raw=coffee.rawMetadata,name=displayCoffeeName(coffee.name);
  const declaredScore=typeof raw.scaScore==='number'&&Number.isFinite(raw.scaScore)&&raw.scaScore>0&&raw.scaScore<=100?raw.scaScore.toLocaleString('tr-TR'):null;
  const roast=raw.roast??featureText(coffee,'roast_classification','roast_level')[0];
  const origin=coffeeOrigin(coffee),processLabel=coffeeProcess(coffee);
  // A single known origin or process links to its landing page.
  const facts:Fact[]=[['Köken',origin,origin?originLanding(origin)?.path:undefined],['Bölge',raw.region],['Üretici',raw.producer],['Çiftlik',raw.farm],['Rakım',raw.altitude],['İşlem',processLabel,processLabel?processLanding(processLabel)?.path:undefined],['Varyete',raw.varieties?.join(' · ')||featureText(coffee,'normalized_variety','variety').join(' · ')],['Kavrum',roast&&roast!=='unknown'?(ROAST_LABELS[roast]??roast):null],['Hasat',raw.harvestYear],['Kavrum tarihi',raw.roastDate],...(declaredScore?[['SCA puanı',declaredScore] as Fact]:[])];
  // Only known facts are shown: no row, label or note for what the roaster did not publish (owner, 1 Nov).
  const known=facts.filter(([,value])=>value);
  const listed=displayNotes(raw.tastingNotes??[]),notes=listed.length?listed:displayNotes(featureText(coffee,'flavor_notes_normalized'));
  const renderOffer=(offer:CatalogOffer)=><div key={offer.id} className={`rounded-xl bg-surface px-4 py-3.5 ${offer.inStock===true?'border border-line':'border border-dashed border-line'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-base font-semibold">{publicOfferLabel(offer)}{offer.inStock===false?<span className="font-normal text-muted"> · Tükendi</span>:offer.inStock===null?<span className="font-normal text-muted"> · Stok doğrulanmadı</span>:null}</p><OfferPrice offer={offer}/></div>{offer.purchaseUrl?<a href={`/go/${offer.id}?source=detail`} className={offer.inStock===true?'button-dark':'button-light'} rel="nofollow">Kavurucuda gör ↗</a>:<span className="text-sm text-muted">Satış bağlantısı doğrulanmadı</span>}</div>
            {offer.compareAtMinor!=null&&offer.priceMinor!=null&&offer.compareAtMinor>offer.priceMinor?<p className="mt-3 text-xs leading-5 text-muted">Kavurucu referans fiyatı: {formatMoney(offer.compareAtMinor/100,offer.currency??'(para birimi belirtilmemiş)')}. Bu beyan, geçmiş gözlemlerimizle doğrulanmış bir indirim anlamına gelmez.</p>:null}</div>;
  return <>
    <nav aria-label="İçerik yolu" className="mb-4 flex flex-wrap items-center gap-2 text-sm"><Link href="/kahveler" className="inline-flex min-h-11 items-center text-accent hover:underline">Kahveler</Link><span className="text-muted" aria-hidden="true">/</span><Link href={`/kavurucu/${coffee.roaster.slug}`} className="inline-flex min-h-11 items-center text-accent hover:underline">{coffee.roaster.name}</Link><span className="hidden text-muted sm:inline" aria-hidden="true">/</span><span className="sr-only text-muted sm:not-sr-only" aria-current="page">{name}</span></nav>
    <div className="grid-pair items-start">
      <div className="relative aspect-square max-w-[560px] overflow-hidden rounded-[20px] border border-line bg-surface lg:rounded-3xl"><CoffeeImage roaster={coffee.roaster.name} source={raw.imageUrl} alt={name} sizes="(max-width: 799px) 92vw, 45vw" loading="eager" className="absolute inset-0 h-full w-full object-contain p-6"/></div>
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2.5 flex flex-wrap items-center gap-2 text-[15px]"><Link href={`/kavurucu/${coffee.roaster.slug}`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">{coffee.roaster.name}</Link>{coffee.roaster.city?<span className="text-muted">· {coffee.roaster.city}</span>:null}{currentBadges(coffee).map(event=><span key={event.id} className="coffee-card-badge">{EVENT_LABELS[event.type]}</span>)}</p>
          <h1 className="mb-3.5 font-display text-title">{name}</h1>
          <p className="mb-3.5 text-[17px]">{[coffeeOrigin(coffee),coffeeProcess(coffee),roast&&roast!=='unknown'?ROAST_LABELS[roast]:null].filter(Boolean).join(' · ')}</p>
          {(notes.length?notes.slice(0,5):tastes).length?<ul aria-label="Tadım notları" className="flex flex-wrap gap-2">{(notes.length?notes.slice(0,5):tastes).map(note=><li key={note} className="rounded-full bg-chip px-3.5 py-1.5 text-[15px] text-accent-deep">{note}</li>)}</ul>:null}
        </div>
        <div><h2 className="mb-2.5 font-display text-[22px]">Paketini seç</h2>
          <div className="space-y-2.5">{coffee.offers.length===0?<p className="rounded-xl bg-tint p-4 text-sm text-muted">Bu kahvenin satışta bir paketi şu an doğrulanmıyor. Bilgilerini burada koruyoruz.</p>:null}{coffee.offers.slice(0,6).map(renderOffer)}{coffee.offers.length>6?<details><summary className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Tüm {coffee.offers.length} paketi göster</summary><div className="mt-3 space-y-2.5">{coffee.offers.slice(6).map(renderOffer)}</div></details>:null}</div>
          <p className="mt-3 text-sm leading-6 text-muted">Güncel fiyatı ve stoğu kavurucuda gör. Satış ve teslimat kavurucu tarafından yapılır.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><SaveToggle slug={coffee.slug} name={coffee.name} offer={savedPackage(preferredOffer(coffee))} label/><CompareToggle slug={coffee.slug} name={coffee.name}/></div>
      </div>
    </div>
    {known.length||notes.length||raw.description?<section className="mt-14">
      <h2 className="mb-2 font-display text-subtitle">Çekirdeği tanı.</h2>
      {known.length?<dl className="grid grid-cols-2 gap-x-[clamp(16px,3vw,40px)] @5xl:grid-cols-5">{known.map(([label,value,href])=><div key={label} className="min-w-0 border-b border-line py-3.5"><dt className="mb-1 text-[13px] text-muted">{label}</dt><dd className="break-words font-medium">{href?<Link href={href} className="text-accent underline-offset-4 hover:underline">{value}</Link>:value}</dd></div>)}</dl>:null}
      {notes.length?<div className="mt-6"><h3 className="text-sm font-semibold">Tadım notları</h3><p className="mt-2 text-sm leading-7 text-muted">{notes.join(' · ')}</p></div>:null}
      {raw.description?<details className="mt-5"><summary className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Kavurucunun açıklaması</summary><p className="mt-3 max-w-3xl whitespace-pre-line text-[15px] leading-7">{raw.description}</p></details>:null}
    </section>:null}
    <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-tint px-6 py-6 sm:px-8"><div className="flex items-center gap-4"><RoasterInitial name={coffee.roaster.name}/><span><span className="block font-display text-2xl">{coffee.roaster.name}</span>{coffee.roaster.city?<span className="text-sm text-muted">{coffee.roaster.city}</span>:null}</span></div><Link href={`/kavurucu/${coffee.roaster.slug}`} className="button-light">Bu kavurucunun tüm kahveleri →</Link></section>
  </>;
}
