import { CoffeeImage } from './coffee-image';
import { countryLabel } from '../../../shared/v2/country-labels';
import Link from 'next/link';
import { CompareToggle } from '@/components/coffee/compare-controls';
import { SaveToggle } from '@/components/coffee/saved-list';
import { displayCoffeeName, displayNotes, displayPackageLabel, formatMoney, formatPackageWeight } from '@/lib/coffee-display';
import { PROCESS_LABELS } from '@/lib/constants/filter-options';
import type { CatalogCoffee, CatalogOffer } from '../../../shared/v2/catalog';
import type { CoffeeEvent } from '../../../shared/v2/types';
import { ARRIVAL_DAYS } from '../../../shared/v2/events';

const TASTES:Record<string,string>={fruity:'Meyvemsi',floral:'Çiçeksi',chocolate:'Çikolatalı',chocolatey:'Çikolatalı',sweet:'Tatlı',nutty:'Kuruyemişli',spicy:'Baharatlı',herbal:'Bitkisel',roasted:'Kavrulmuş',funky:'Fermente',fermented:'Fermente',clean:'Temiz'};
export const EVENT_LABELS:Record<CoffeeEvent['type'],string>={NEW:'Yeni',PRICE_DROP:'Fiyatı düştü',RESTOCKED:'Geri geldi',DEAL:'Doğrulanmış fırsat',OUT_OF_STOCK:'Tükendi'};

export function featureText(coffee:CatalogCoffee,...names:string[]):string[]{
  return [...new Set(coffee.features.filter(feature=>names.includes(feature.feature)).flatMap(feature=>typeof feature.value==='string'?[feature.value]:Array.isArray(feature.value)?feature.value.filter((value):value is string=>typeof value==='string'):[]))].filter(value=>value&&value!=='unknown');
}
export function coffeeOrigin(coffee:CatalogCoffee){const inferred=featureText(coffee,'normalized_origin');const origins=coffee.rawMetadata.country!=null?[coffee.rawMetadata.country]:inferred.length?inferred:featureText(coffee,'origin_country');const labels=[...new Set(origins.filter(origin=>origin&&origin.toLowerCase()!=='unknown').map(countryLabel))];return labels.length?new Intl.ListFormat('tr',{type:'conjunction'}).format(labels):null;}
export function coffeeProcess(coffee:CatalogCoffee){const inferred=featureText(coffee,'process_family');const processes=coffee.rawMetadata.process!=null?[coffee.rawMetadata.process]:inferred.length?inferred:featureText(coffee,'process');const labels=[...new Set(processes.filter(process=>process&&process.trim().toLowerCase()!=='unknown').map(process=>PROCESS_LABELS[process.trim().toLowerCase()]??process))];return labels.length?new Intl.ListFormat('tr',{type:'conjunction'}).format(labels):null;}
export function tasteSummary(coffee:CatalogCoffee):string[]{return [...new Set(featureText(coffee,'flavor_families','flavor_categories').map(value=>TASTES[value.toLowerCase()]).filter(Boolean))].slice(0,3);}
export function preferredOffer(coffee:CatalogCoffee):CatalogOffer|undefined {
  const available=coffee.offers.filter(offer=>offer.inStock===true);
  return [...(available.length?available:coffee.offers)].sort((a,b)=>
    Number(a.weightG===null)-Number(b.weightG===null)||Math.abs((a.weightG??250)-250)-Math.abs((b.weightG??250)-250)||(a.priceMinor??Infinity)-(b.priceMinor??Infinity)||a.id.localeCompare(b.id))[0];
}
/** A historical event is not an active badge once its current state or window has ended: ARRIVAL_DAYS for a genuine
 * arrival (hydrate keeps only those NEW events, so the badge agrees with /yeni), seven days for the rest. */
export function currentBadges(coffee:CatalogCoffee,now=Date.now()):CoffeeEvent[]{
  return coffee.latestEvents.filter(event=>{
    const age=now-Date.parse(event.createdAt);
    if(!Number.isFinite(age)||age<0||age>(event.type==='NEW'?ARRIVAL_DAYS:7)*86400000)return false;
    const offer=coffee.offers.find(value=>value.variantOfferIds.includes(event.offerId??''));
    if(event.type==='NEW')return true;
    if(event.type==='RESTOCKED')return offer?.inStock===true;
    if(event.type==='OUT_OF_STOCK')return offer?.inStock===false;
    const after=event.after&&typeof event.after==='object'&&!Array.isArray(event.after)?event.after:null;
    return offer?.inStock===true&&after?.priceMinor===offer.priceMinor&&after?.currency===offer.currency&&after?.weightG===offer.weightG;
  }).sort((a,b)=>Number(b.type==='DEAL')-Number(a.type==='DEAL')).slice(0,2);
}
export function publicOfferLabel(offer:CatalogOffer|undefined){
  return offer?.label&&!/^(legacy package\b|default title$)/i.test(offer.label)?displayPackageLabel(offer.label,offer.weightG):offer?.weightG?formatPackageWeight(offer.weightG):'Paket ağırlığı belirtilmemiş';
}
export function OfferPrice({offer}:{offer:CatalogOffer|undefined}){
  return <div className="tabular-nums"><p className="flex flex-wrap items-baseline gap-x-1.5"><strong className="text-[19px] font-semibold">{offer?.priceMinor!=null&&offer.priceMinor>0?formatMoney(offer.priceMinor/100,offer.currency??'(para birimi belirtilmemiş)'): 'Fiyat paylaşılmamış'}</strong>{offer?.weightG?<span className="text-[13px] text-muted">/ {formatPackageWeight(offer.weightG)}</span>:null}</p>
    {offer?.weightG==null?<p className="mt-1 text-xs text-muted">{publicOfferLabel(offer)}</p>:null}</div>;
}
/** What the save button remembers: the package this card or page shows. */
export function savedPackage(offer:CatalogOffer|undefined){return {priceMinor:offer?.priceMinor??null,weightG:offer?.weightG??null,currency:offer?.currency??null,inStock:offer?.inStock??null};}
export function DiscoveryCard({coffee,source='catalog'}:{coffee:CatalogCoffee;source?:string}){
  const offer=preferredOffer(coffee),badges=currentBadges(coffee);
  const listed=displayNotes(coffee.rawMetadata.tastingNotes??[]),notes=listed.length?listed.slice(0,3):tasteSummary(coffee),name=displayCoffeeName(coffee.name);
  return <article className="coffee-card relative">
    <Link href={`/kahve/${coffee.slug}`} prefetch={false} className="coffee-card-image block" aria-label={`${name} detayları`}>
      <CoffeeImage roaster={coffee.roaster.name} source={coffee.rawMetadata.imageUrl} alt={name} sizes="(max-width: 599px) 92vw, (max-width: 1199px) 46vw, 25vw" className="absolute inset-0 h-full w-full object-contain p-4"/>
      {badges.length>0?<span className="absolute left-3 top-3 flex flex-wrap gap-1">{badges.map(event=><span key={event.id} className="coffee-card-badge">{EVENT_LABELS[event.type]}</span>)}</span>:null}
    </Link>
    <SaveToggle slug={coffee.slug} name={coffee.name} offer={savedPackage(offer)} className="absolute right-2.5 top-2.5"/>
    <div className="coffee-card-body">
      <p className="text-[13px] text-muted"><Link href={`/kavurucu/${coffee.roaster.slug}`} className="py-1 hover:text-accent hover:underline">{coffee.roaster.name}</Link>{coffee.roaster.city?` · ${coffee.roaster.city}`:''}</p>
      <h3><Link href={`/kahve/${coffee.slug}`} prefetch={false} className="line-clamp-2 hover:underline">{name}</Link></h3>
      <p className="line-clamp-2 text-sm">{[coffeeOrigin(coffee),coffeeProcess(coffee)].filter(Boolean).join(' · ')||<span className="italic text-muted">Köken ve işlem bilgisi bekleniyor</span>}</p>
      {notes.length?<ul className="flex flex-wrap gap-1.5" aria-label="Tadım notları">{notes.map(note=><li key={note} className="coffee-card-note">{note}</li>)}</ul>:<p className="text-xs italic text-muted">Tat profili henüz belirtilmemiş</p>}
      <div className="coffee-card-price"><OfferPrice offer={offer}/></div>
    </div>
    <div className="coffee-card-footer">{offer?.purchaseUrl?<a href={`/go/${offer.id}?source=${encodeURIComponent(source)}`} className="text-link" rel="nofollow">Kavurucuda gör <span aria-hidden="true">↗</span></a>:<Link href={`/kahve/${coffee.slug}`} className="text-link">Paketleri incele →</Link>}<CompareToggle slug={coffee.slug} name={coffee.name}/></div>
  </article>;
}
export function DiscoveryGrid({coffees,source='catalog'}:{coffees:CatalogCoffee[];source?:string}){return <div className="card-grid">{coffees.map(coffee=><DiscoveryCard key={coffee.id} coffee={coffee} source={source}/>)}</div>;}
export function DiscoveryEmpty({title='Burada henüz kahve yok.',children,action=['/kahveler','Tüm kahveleri keşfet ↗']}:{title?:string;children:React.ReactNode;action?:[href:string,label:string]}){return <div className="empty-catalog"><h3>{title}</h3><p>{children}</p><Link href={action[0]} prefetch={false} className="text-link">{action[1]}</Link></div>;}
