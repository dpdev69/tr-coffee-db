import { TrackedFilterForm } from './product-tracking';
import { canonicalCountry, countryLabel, countryOptions } from '../../../shared/v2/country-labels';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getFirstSearchParamValue, getPageParamValue, getStringArrayParamValue, normalizeSearchTerm, type SearchParamValue } from '@/lib/filter-contract';
import { FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS, BREW_METHOD_LABELS } from '@/lib/constants/filter-options';
import { listCatalog, listOrigins, listRoasters, type CatalogFilters } from '../../../shared/v2/catalog';
import { ARRIVAL_DAYS } from '../../../shared/v2/events';
import { DiscoveryEmpty, DiscoveryGrid } from './discovery-card';
import { JsonLd, itemList } from '@/components/layout/json-ld';

export type DiscoverySearchParams=Record<string,SearchParamValue>;
const first=getFirstSearchParamValue;
function finite(value:SearchParamValue){const raw=first(value);if(raw===undefined)return undefined;const number=Number(raw);return Number.isFinite(number)?Math.max(0,Math.min(100000,number)):undefined;}
export function parseDiscoveryFilters(params:DiscoverySearchParams):CatalogFilters {
  const sort=first(params.sort);
  return {origin:[...new Set(getStringArrayParamValue(params.origin)?.map(canonicalCountry)??[])],process:getStringArrayParamValue(params.process),taste:getStringArrayParamValue(params.taste),roaster:getStringArrayParamValue(params.roaster),
    priceMin:finite(params.priceMin),priceMax:finite(params.priceMax),search:normalizeSearchTerm(first(params.search)),farm:first(params.farm),producer:first(params.producer),variety:first(params.variety),roast:getStringArrayParamValue(params.roast),brewMethod:getStringArrayParamValue(params.brewMethod),
    altitude:normalizeSearchTerm(first(params.altitude))?.slice(0,100),
    sort:sort&&['newest','price_asc','price_desc'].includes(sort)?sort as CatalogFilters['sort']:'newest',page:getPageParamValue(params.page),perPage:24};
}
const inputClass='min-h-11 w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 text-sm font-normal text-ink';
function Field({label,name,children,defaultValue}:{label:string;name:string;children?:React.ReactNode;defaultValue?:string}){
  return <label className="flex min-w-0 flex-col gap-2 text-[13px] font-medium text-muted">{label}{children?<select name={name} defaultValue={defaultValue??''} className={inputClass}><option value="">Tümü</option>{children}</select>:<input name={name} defaultValue={defaultValue} className={inputClass}/>}</label>;
}
/** Checkbox pills replace the native multi-select: several values (e.g. from the quiz) stay visible and tappable. */
function Options({legend,name,labels,selected}:{legend:string;name:string;labels:Record<string,string>;selected?:string[]}){
  return <fieldset className="min-w-0"><legend className="mb-2 text-[13px] font-medium text-muted">{legend}</legend><div className="flex flex-wrap gap-2">{Object.entries(labels).filter(([value])=>value!=='unknown').map(([value,label])=><label key={value} className="filter-option"><input type="checkbox" name={name} value={value} defaultChecked={selected?.includes(value)}/>{label}</label>)}</div></fieldset>;
}
const CHIP_LABELS:Record<string,string>={search:'Arama',origin:'Köken',process:'İşlem',taste:'Tat',roaster:'Kavurucu',priceMin:'En az',priceMax:'En çok',farm:'Çiftlik',producer:'Üretici',variety:'Varyete',altitude:'Rakım',roast:'Kavrum',brewMethod:'Demleme'};
/** One removable chip per applied value. Each link drops that value (and the page) and keeps everything else, so it works without JavaScript. */
export function filterChips(params:DiscoverySearchParams,path:string,valueLabel:(key:string,value:string)=>string){
  const entries=Object.entries(params).flatMap(([key,value])=>(Array.isArray(value)?value:value?[value]:[]).map(item=>[key,item] as [string,string]));
  const href=(keep:(key:string,index:number)=>boolean)=>{const query=new URLSearchParams(entries.filter(([key,value],index)=>key!=='page'&&value.trim()!==''&&keep(key,index)));return query.size?`${path}?${query}`:path;};
  const chips=entries.flatMap(([key,value],index)=>key in CHIP_LABELS&&value.trim()?[{label:`${CHIP_LABELS[key]}: ${valueLabel(key,value.trim())}`,href:href((_,other)=>other!==index)}]:[]);
  return {chips,clearHref:href(key=>!(key in CHIP_LABELS))};
}
/** `preset` fixes filters for a landing page (one origin or process): applied always, never shown as a removable chip; the form then searches the whole catalog. */
export async function DiscoveryCatalog({params:query,path='/kahveler',event,preset}:{params:DiscoverySearchParams;path?:string;event?:CatalogFilters['event'];preset?:DiscoverySearchParams}){
  const params=preset?Object.fromEntries(Object.entries(query).filter(([key])=>!(key in preset))):query;
  const filters=parseDiscoveryFilters({...params,...preset});
  // Server request time defines the seven-day feed window.
  const days=event==='NEW'?ARRIVAL_DAYS:7;
  // eslint-disable-next-line react-hooks/purity
  if(event){filters.event=event;filters.since=new Date(Math.floor(Date.now()/300000)*300000-days*86400000).toISOString();}
  let result:Awaited<ReturnType<typeof listCatalog>>;
  let roasters:Awaited<ReturnType<typeof listRoasters>>=[];
  let origins:ReturnType<typeof countryOptions>=[];
  try{
    const db=await getCatalogDatabase();
    const [catalog,roasterRows,originRows]=await Promise.all([listCatalog(db,filters),listRoasters(db),listOrigins(db)]);
    // A stale or hand-edited ?page= past the end shows the last page instead of a false empty state.
    result=catalog.page>catalog.totalPages&&catalog.totalPages>0?await listCatalog(db,{...filters,page:catalog.totalPages}):catalog;roasters=roasterRows;origins=countryOptions(originRows);
  }catch(error){unstable_rethrow(error);console.error('Catalog read failed', error instanceof Error ? error.message : 'Unknown database error');return <DataSourceNotice title="Katalog şu an yüklenemiyor." message="Güncel kahveleri doğrulayamıyoruz. Biraz sonra yeniden deneyebilir veya demleme rehberini kullanabilirsin." actionHref="/guide" actionLabel="Demleme rehberi"/>;}
  const linkToPage=(page:number)=>{const query=new URLSearchParams();for(const [key,value]of Object.entries(params))for(const item of Array.isArray(value)?value:value?[value]:[])if(key!=='page')query.append(key,item);query.set('page',String(page));return `${path}?${query}`;};
  const roasterName=new Map(roasters.map(roaster=>[roaster.slug,roaster.name]));
  const labels:Record<string,(value:string)=>string>={origin:value=>countryLabel(canonicalCountry(value)),process:value=>PROCESS_LABELS[value]??value,taste:value=>FLAVOR_CATEGORY_LABELS[value as keyof typeof FLAVOR_CATEGORY_LABELS]??value,roaster:value=>roasterName.get(value)??value,roast:value=>ROAST_LABELS[value]??value,brewMethod:value=>BREW_METHOD_LABELS[value]??value,priceMin:value=>`${value} TL`,priceMax:value=>`${value} TL`,search:value=>`“${value}”`};
  const {chips,clearHref}=filterChips(params,path,(key,value)=>labels[key]?.(value)??value);
  const advancedOpen=Boolean(filters.altitude||filters.farm||filters.producer||filters.variety||filters.process?.length||filters.roast?.length||filters.brewMethod?.length);
  return <>
    <TrackedFilterForm key={JSON.stringify([path,params,event])} action={preset?'/kahveler':path} page={path==='/yeni'?'new':path==='/firsatlar'?'deals':'catalog'} className="discovery-filters mb-5 rounded-[14px] border border-line bg-surface p-4 sm:p-5">
      {event ? <input type="hidden" name="event" value={event} /> : null}
      <label className="flex flex-col gap-2 text-[13px] font-medium text-muted">Kahve veya kavurucu ara<input type="search" name="search" defaultValue={first(params.search)} placeholder="Bir isimle başla…" className="min-h-12 rounded-[10px] border border-line bg-surface px-4 text-base font-normal text-ink"/></label>
      {/* Phones fold the filters behind one summary (the chips below say what is applied); from lg up globals.css shows .filter-more inline. */}
      <details className="filter-more mt-4">
        <summary className="inline-flex min-h-11 items-center text-sm font-semibold text-accent lg:hidden">Tat, köken, kavurucu ve fiyat</summary>
        <div className="mt-2 lg:mt-0"><Options legend="Tat" name="taste" labels={FLAVOR_CATEGORY_LABELS} selected={filters.taste}/></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Köken" name="origin" defaultValue={filters.origin?.[0]}>{origins.map(({value,label})=><option key={value} value={value}>{label}</option>)}</Field>
          <Field label="Kavurucu" name="roaster" defaultValue={filters.roaster?.[0]}>{roasters.map(roaster=><option key={roaster.id} value={roaster.slug}>{roaster.name}</option>)}</Field>
          <fieldset className="col-span-2 flex min-w-0 flex-col gap-2 text-[13px] font-medium text-muted"><legend className="mb-2">Paket fiyatı · TL</legend><div className="flex min-w-0 gap-2"><input type="number" min="0" name="priceMin" aria-label="En düşük paket fiyatı" placeholder="En az" defaultValue={filters.priceMin} className={inputClass}/><input type="number" min="0" name="priceMax" aria-label="En yüksek paket fiyatı" placeholder="En çok" defaultValue={filters.priceMax} className={inputClass}/></div></fieldset>
        </div>
        <details className="mt-4 text-sm text-muted" open={advancedOpen}><summary className="inline-flex min-h-11 items-center font-semibold text-accent">Daha fazla filtre</summary>
          <div className="mt-2 grid gap-4"><Options legend="İşlem" name="process" labels={PROCESS_LABELS} selected={filters.process}/><Options legend="Kavrum" name="roast" labels={ROAST_LABELS} selected={filters.roast}/><Options legend="Demleme" name="brewMethod" labels={BREW_METHOD_LABELS} selected={filters.brewMethod}/></div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Field label="Çiftlik" name="farm" defaultValue={filters.farm}/><Field label="Üretici" name="producer" defaultValue={filters.producer}/><Field label="Varyete" name="variety" defaultValue={filters.variety}/><Field label="Kaynaktaki rakım (örn. 1800)" name="altitude" defaultValue={filters.altitude}/></div><p className="mt-3 text-xs leading-6">Rakım filtresi kaynak metninde arar; sayısal aralık veya birim dönüşümü yapmaz.</p></details>
      </details>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="submit" className="button-dark">Kahveleri göster →</button><label className="ml-auto flex items-center text-sm">Sırala <select name="sort" defaultValue={filters.sort} className="ml-2 min-h-11 rounded-[10px] border border-line bg-surface px-3"><option value="newest">En yeni</option><option value="price_asc">Paket fiyatı: artan</option><option value="price_desc">Paket fiyatı: azalan</option></select></label></div>
    </TrackedFilterForm>
    <div className="mb-7"><ul aria-label="Sonuçlar ve uygulanan filtreler" className="flex flex-wrap items-center gap-2.5"><li className="mr-1.5 text-[15px] font-semibold"><span className="tabular-nums">{result.total.toLocaleString('tr-TR')}</span> kahve{event?` · Son ${days} gün`:''}</li>{chips.map(chip=><li key={chip.href}><Link href={chip.href} className="filter-chip" aria-label={`Filtreyi kaldır: ${chip.label}`}>{chip.label}<span aria-hidden="true">×</span></Link></li>)}{chips.length?<li><Link href={clearHref} className="ml-1.5 inline-flex min-h-11 items-center text-sm text-accent hover:underline">Filtreleri temizle</Link></li>:null}</ul>
      <p className="mt-1 text-sm text-muted">Sipariş kavurucunun kendi sitesinde tamamlanır.</p></div>
    <h2 className="sr-only">Kahveler</h2>
    {result.coffees.length?<JsonLd data={itemList(result.coffees.map(coffee=>[coffee.name,`/kahve/${coffee.slug}`]),{offset:(result.page-1)*result.perPage,total:result.total})}/>:null}
    {result.coffees.length?<DiscoveryGrid coffees={result.coffees} source={event?'feed':'catalog'}/>:event==='NEW'?<DiscoveryEmpty title={`Son ${days} günde yeni gelen kahve yok.`}>Kavurucuların mağazalarını her gece tarıyoruz; bir kahveyi ilk gördüğümüz gece buraya ekliyoruz. Ne zaman satışa çıktığını bilmediğimiz kahveleri yeni diye göstermiyoruz.</DiscoveryEmpty>
      :<DiscoveryEmpty title={event?'Henüz doğrulanmış bir değişiklik yok.':'Bu filtrelerle kahve bulamadık.'}>{event?'Doğrulanmış bir değişiklik olduğunda burada göreceksin. Kahveleri keşfete göz atabilirsin.':'Daha geniş bir fiyat aralığı deneyebilir veya filtreleri temizleyebilirsin.'}<Link href={event?'/yeni':path} className="text-link">{event?'Kahveleri keşfet →':'Tüm kahveleri göster →'}</Link></DiscoveryEmpty>}
    {result.totalPages>1?<nav aria-label="Katalog sayfaları" className="mt-8 flex items-center justify-center gap-4">{result.page>1?<Link className="button-light" href={linkToPage(result.page-1)}>← Önceki</Link>:null}<span className="text-sm">{result.page} / {result.totalPages}</span>{result.page<result.totalPages?<Link className="button-light" href={linkToPage(result.page+1)}>Sonraki →</Link>:null}</nav>:null}
  </>;
}
