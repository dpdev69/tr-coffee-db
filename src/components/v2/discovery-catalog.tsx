import { TrackedFilterForm } from './product-tracking';
import { canonicalCountry, countryOptions } from '../../../shared/v2/country-labels';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { getFirstSearchParamValue, getPageParamValue, getStringArrayParamValue, normalizeSearchTerm, type SearchParamValue } from '@/lib/filter-contract';
import { FLAVOR_CATEGORIES, FLAVOR_CATEGORY_LABELS, PROCESS_LABELS, ROAST_LABELS, BREW_METHOD_LABELS } from '@/lib/constants/filter-options';
import { listCatalog, listRoasters, type CatalogFilters } from '../../../shared/v2/catalog';
import { DiscoveryEmpty, DiscoveryGrid } from './discovery-card';

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
function Field({label,name,children,defaultValue}:{label:string;name:string;children?:React.ReactNode;defaultValue?:string|string[]}){
  return <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-[#244b3d]">{label}{children?<select name={name} multiple={Array.isArray(defaultValue)&&defaultValue.length>1} defaultValue={defaultValue??''} className="min-h-11 rounded-md border border-[#c8ccbf] bg-white px-3 text-sm font-normal text-[#1f1d1b]"><option value="">Tümü</option>{children}</select>:<input name={name} defaultValue={defaultValue} className="min-h-11 rounded-md border border-[#c8ccbf] bg-white px-3 text-sm font-normal text-[#1f1d1b]"/>}</label>;
}
export async function DiscoveryCatalog({params,path='/kahveler',event}:{params:DiscoverySearchParams;path?:string;event?:CatalogFilters['event']}){
  const filters=parseDiscoveryFilters(params);
  // Server request time defines the seven-day feed window.
  // eslint-disable-next-line react-hooks/purity
  if(event){filters.event=event;filters.since=new Date(Math.floor(Date.now()/300000)*300000-7*86400000).toISOString();}
  let result:Awaited<ReturnType<typeof listCatalog>>;
  let roasters:Awaited<ReturnType<typeof listRoasters>>=[];
  let origins:ReturnType<typeof countryOptions>=[];
  try{
    const db=await getCatalogDatabase();
    const [catalog,roasterRows,originRows]=await Promise.all([listCatalog(db,filters),listRoasters(db),db.prepare(`SELECT DISTINCT value FROM (SELECT json_extract(c.raw_metadata_json,'$.country') AS value FROM public_catalog_coffees c UNION ALL SELECT j.value FROM coffee_feature_values f JOIN public_catalog_coffees c ON c.id=f.coffee_id JOIN json_each(f.value_json) j WHERE f.feature IN ('normalized_origin','origin_country') AND j.type='text') WHERE value IS NOT NULL AND value<>'unknown' ORDER BY value`).all<{value:string}>()]);
    // A stale or hand-edited ?page= past the end shows the last page instead of a false empty state.
    result=catalog.page>catalog.totalPages&&catalog.totalPages>0?await listCatalog(db,{...filters,page:catalog.totalPages}):catalog;roasters=roasterRows;origins=countryOptions(originRows.results.map(row=>row.value));
  }catch(error){unstable_rethrow(error);console.error('Catalog read failed', error instanceof Error ? error.message : 'Unknown database error');return <DataSourceNotice title="Katalog şu an yüklenemiyor." message="Güncel kahveleri doğrulayamıyoruz. Biraz sonra yeniden deneyebilir veya demleme rehberini kullanabilirsin." actionHref="/guide" actionLabel="Demleme rehberi"/>;}
  const linkToPage=(page:number)=>{const query=new URLSearchParams();for(const [key,value]of Object.entries(params))for(const item of Array.isArray(value)?value:value?[value]:[])if(key!=='page')query.append(key,item);query.set('page',String(page));return `${path}?${query}`;};
  return <>
    <TrackedFilterForm key={JSON.stringify([path,params,event])} action={path} page={path==='/yeni'?'new':path==='/firsatlar'?'deals':'catalog'} className="discovery-filters mb-8 rounded-xl border border-[#dedfd7] bg-[#f0f1e9] p-4 sm:p-6">
      {event ? <input type="hidden" name="event" value={event} /> : null}
      <label className="flex flex-col gap-2 text-xs font-semibold text-[#244b3d]">Kahve veya kavurucu ara<input type="search" name="search" defaultValue={first(params.search)} placeholder="Bir isimle başla…" className="min-h-12 rounded-md border border-[#c8ccbf] bg-white px-4 text-base font-normal text-[#1f1d1b]"/></label>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Field label="Köken" name="origin" defaultValue={filters.origin&&filters.origin.length>1?filters.origin:filters.origin?.[0]}>{origins.map(({value,label})=><option key={value} value={value}>{label}</option>)}</Field>
        <Field label="İşlem" name="process" defaultValue={filters.process&&filters.process.length>1?filters.process:filters.process?.[0]}>{Object.entries(PROCESS_LABELS).filter(([key])=>key!=='unknown').map(([value,label])=><option key={value} value={value}>{label}</option>)}</Field>
        <Field label="Tat" name="taste" defaultValue={filters.taste&&filters.taste.length>1?filters.taste:filters.taste?.[0]}>{FLAVOR_CATEGORIES.map(value=><option key={value} value={value}>{FLAVOR_CATEGORY_LABELS[value]}</option>)}</Field>
        <Field label="Kavurucu" name="roaster" defaultValue={filters.roaster&&filters.roaster.length>1?filters.roaster:filters.roaster?.[0]}>{roasters.map(roaster=><option key={roaster.id} value={roaster.slug}>{roaster.name}</option>)}</Field>
        <fieldset className="col-span-2 flex min-w-0 flex-col lg:col-span-1 gap-2 text-xs font-semibold text-[#244b3d]"><legend className="mb-2">Paket fiyatı · TL</legend><div className="flex min-w-0 gap-2"><input type="number" min="0" name="priceMin" aria-label="En düşük paket fiyatı" placeholder="En az" defaultValue={filters.priceMin} className="min-h-11 w-full min-w-0 rounded-md border border-[#c8ccbf] bg-white px-2 text-sm font-normal"/><input type="number" min="0" name="priceMax" aria-label="En yüksek paket fiyatı" placeholder="En çok" defaultValue={filters.priceMax} className="min-h-11 w-full min-w-0 rounded-md border border-[#c8ccbf] bg-white px-2 text-sm font-normal"/></div></fieldset>
      </div>
      <details className="mt-4 text-sm text-[#625e57]" open={Boolean(filters.altitude||filters.farm||filters.producer||filters.variety||filters.roast?.length||filters.brewMethod?.length)}><summary className="inline-flex min-h-11 items-center underline underline-offset-4">Daha fazla filtre</summary><div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-5"><Field label="Çiftlik" name="farm" defaultValue={filters.farm}/><Field label="Üretici" name="producer" defaultValue={filters.producer}/><Field label="Varyete" name="variety" defaultValue={filters.variety}/><Field label="Kaynaktaki rakım (örn. 1800)" name="altitude" defaultValue={filters.altitude}/><Field label="Kavrum" name="roast" defaultValue={filters.roast&&filters.roast.length>1?filters.roast:filters.roast?.[0]}>{Object.entries(ROAST_LABELS).filter(([key])=>key!=='unknown').map(([value,label])=><option key={value} value={value}>{label}</option>)}</Field><Field label="Demleme" name="brewMethod" defaultValue={filters.brewMethod&&filters.brewMethod.length>1?filters.brewMethod:filters.brewMethod?.[0]}>{Object.entries(BREW_METHOD_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Field></div><p className="mt-3 text-xs leading-6">Rakım filtresi kaynak metninde arar; sayısal aralık veya birim dönüşümü yapmaz.</p></details>
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" className="button-dark">Kahveleri göster →</button><Link href={path} className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">Filtreleri temizle</Link><label className="ml-auto text-sm">Sırala <select name="sort" defaultValue={filters.sort} className="ml-2 min-h-11 rounded border border-[#c8ccbf] bg-white px-2"><option value="newest">En yeni</option><option value="price_asc">Paket fiyatı: artan</option><option value="price_desc">Paket fiyatı: azalan</option></select></label></div>
    </TrackedFilterForm>
    <p className="mb-5 text-sm text-[#625e57]"><strong className="text-[#244b3d]">{result.total.toLocaleString('tr-TR')}</strong> kahve{event?' · Son 7 gün':''} · Sipariş kavurucunun kendi sitesinde tamamlanır.</p>
    {result.coffees.length?<DiscoveryGrid coffees={result.coffees} source={event?'feed':'catalog'}/>:<DiscoveryEmpty title={event?'Henüz doğrulanmış bir değişiklik yok.':'Bu filtrelerle kahve bulamadık.'}>{event?'Doğrulanmış bir değişiklik olduğunda burada göreceksin. Kahveleri keşfete göz atabilirsin.':'Daha geniş bir fiyat aralığı deneyebilir veya filtreleri temizleyebilirsin.'}<Link href={event?'/yeni':path} className="text-link">{event?'Kahveleri keşfet →':'Tüm kahveleri göster →'}</Link></DiscoveryEmpty>}
    {result.totalPages>1?<nav aria-label="Katalog sayfaları" className="mt-8 flex items-center justify-center gap-4">{result.page>1?<Link className="button-light" href={linkToPage(result.page-1)}>← Önceki</Link>:null}<span className="text-sm">{result.page} / {result.totalPages}</span>{result.page<result.totalPages?<Link className="button-dark" href={linkToPage(result.page+1)}>Sonraki →</Link>:null}</nav>:null}
  </>;
}
