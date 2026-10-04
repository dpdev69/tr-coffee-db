import type { FeatureValue, RawMetadata } from './types';

const CATEGORY_NOTES=new Set(['filtre kahve','kahve','nitelikli kahve','çekirdek kahve','cekirdek kahve','specialty coffee','coffee','filter coffee','espresso coffee']);
const PROFILE_LABELS:Record<string,keyof RawMetadata>={
  'ülke':'country',country:'country','bölge':'region',region:'region','üretici':'producer',producer:'producer',
  'çiftlik':'farm',farm:'farm','rakım':'altitude',rakim:'altitude','yükseklik':'altitude',altitude:'altitude',
  'işlem':'process',islem:'process',process:'process',processing:'process',varyete:'varieties',variety:'varieties',cultivar:'varieties','tür':'varieties',
  'hasatyılı':'harvestYear',hasatyili:'harvestYear',hasat:'harvestYear',harvestyear:'harvestYear',harvest:'harvestYear',
  'kavrumtarihi':'roastDate',roastdate:'roastDate',kavrum:'roast',roast:'roast',
  'tadımnotu':'tastingNotes','tadımnotları':'tastingNotes',tadimnotu:'tastingNotes',tadimnotlari:'tastingNotes',tastingnote:'tastingNotes',tastingnotes:'tastingNotes',
};
const PROFILE_LABEL_PATTERN=/(?:Ülke|Country|Bölge|Region|Üretici|Producer|Çiftlik|Farm|Rakım|Rakim|Yükseklik|Altitude|[İi]şlem|Islem|Process(?:ing)?|Varyete|Variety|Cultivar|Tür|Hasat\s*(?:Yılı|Yili)?|Harvest\s*(?:Year)?|Kavrum\s*Tarihi|Roast\s*Date|Kavrum|Roast|Tadım\s*Not(?:u|ları)|Tadim\s*Not(?:u|lari)|Tasting\s*Notes?)\s*:\s*/giu;
/** Only explicit source labels supply facts; a country/variety mention in prose does not. */
function declaredProfile(description:string):RawMetadata {
  const matches=[...description.matchAll(PROFILE_LABEL_PATTERN)];
  const fields:Record<string,string|string[]>={};
  for(let index=0;index<matches.length;index++){
    const match=matches[index],key=PROFILE_LABELS[match[0].replace(/\s*:\s*$/u,'').replace(/\s+/g,'').toLowerCase().replace(/\u0307/g,'')];
    let value=description.slice(match.index!+match[0].length,matches[index+1]?.index).split('\n')[0].trim().replace(/[;|]+$/u,'').trim();
    if(key==='tastingNotes')value=value.split(/[.!?](?=\s|$)/u)[0].trim();
    if(!key||!value||/^(?:unknown|bilinmiyor|belirtilmemiş)$/iu.test(value))continue;
    if(key==='harvestYear'&&!/^20\d{2}(?:\s*[/-]\s*(?:20)?\d{2})?$/u.test(value))continue;
    // "Tür: Arabica" describes a species, not a named cultivar.
    if(key==='varieties'&&/^(?:arabica|robusta|coffea arabica|coffea canephora)$/iu.test(value))continue;
    fields[key]=key==='varieties'||key==='tastingNotes'?value.split(/[,;·]/u).map(part=>part.trim()).filter(Boolean):value;
  }
  return fields;
}
export function declaredDecaf(name:string,description=''):boolean|null {
  const evidence=`${name} ${description}`;
  if(/(?:not\s+(?:a\s+)?decaf|(?:decaf|kafeinsiz).{0,45}(?:değil|degil)|kafein\s+içerir)/iu.test(evidence))return false;
  if(/\b(?:decaf|kafeinsiz|descafecol|caffeine[ -]*free)\b/iu.test(name))return true;
  if(/(?:bu kahve\s+kafeinsizdir|this coffee is\s+(?:decaf|caffeine[ -]*free))/iu.test(description))return true;
  return null;
}
const ENTITIES:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
/** Storefront APIs return HTML-encoded titles ("Rwanda &#8211; Gisanga") and promo prefixes ("YENİ – …"). */
export function cleanCoffeeName(name:string):string {
  const decoded=name.replace(/&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z]+));/giu,(entity,dec?:string,hex?:string,named?:string)=>{
    const code=dec?Number(dec):hex?parseInt(hex,16):null;
    if(code!==null)return code>0&&code<=0x10ffff?String.fromCodePoint(code):entity;
    return ENTITIES[named!.toLowerCase()]??entity;
  });
  return decoded.replace(/^\s*yen[iİ]\s*[-–—:|]\s*/iu,'').replace(/\s+/g,' ').trim()||name.trim();
}
// A field value ends where a glued label or the next sentence starts: "NaturalYükselik: 1500m", "Washed Menşei: El Salvador",
// "1.280 mStory’de tazelik…". Over-long remainders are prose, not a fact; unknown is safer than a paragraph.
const FIELD_LIMITS={country:30,region:60,producer:60,farm:60,altitude:30,process:60,roast:30} as const;
// ponytail: camel-case glue split; a name like "McKinley" would be cut, revisit if roasters use one.
const GLUE=/(?<=\p{Ll})(?=\p{Lu})|(?<=\p{L}{3})(?=\d)|(?<=\d)(?=\p{Lu}\p{Ll})/u;
// One word before a colon, so "Rift Valley Varteye:" keeps "Rift Valley"; two-word labels lose their lead word below.
const NEXT_LABEL=/[\s ​⁠·|;,]+\p{L}[\p{L}\p{M}’'.]*(?:\s*\([^)]{0,24}\))?\s*:/u;
const LABEL_LEAD=/\s+(?:[İi]şleme?|Islem|Tatsal|Hasat|Tad[ıi]m|Tat|Lezzet|Kavrum|Kavurma|Cupping|Mal|Fincan|Çiftlik|Kasaba|Tasting)$/u;
function cleanField(value:string,limit:number):string|undefined {
  let text=value;
  for(const pattern of [GLUE,NEXT_LABEL]){const index=text.search(pattern);if(index>0)text=text.slice(0,index);}
  text=text.replace(LABEL_LEAD,'').replace(/[\s·|;,:/–-]+$/u,'').trim();
  return text&&text.length<=limit?text:undefined;
}
function cleanProfile<T extends RawMetadata>(metadata:T):T {
  const result={...metadata};
  for(const [key,limit] of Object.entries(FIELD_LIMITS) as [keyof typeof FIELD_LIMITS,number][]){
    const value=result[key];
    if(typeof value!=='string')continue;
    const cleaned=cleanField(value,limit);
    if(cleaned===undefined)delete result[key];else result[key]=cleaned;
  }
  return result;
}
/** Raw field and the feature names that state the same fact. A reviewed MANUAL row for any of them
 * (data/corrections.json) overrides the raw value and every non-manual row of the group. */
export const FACT_FEATURES:Record<string,readonly string[]>={
  country:['normalized_origin','origin_country'],process:['process_family','process'],roast:['roast_classification','roast_level'],
  tastingNotes:['flavor_families','flavor_categories','flavor_notes_normalized'],brewMethods:['brew_compatibility','brew_methods'],
  farm:['origin_farm'],producer:['origin_producer'],varieties:['variety','normalized_variety'],
};
const related=(feature:string)=>Object.values(FACT_FEATURES).find(names=>names.includes(feature))??[feature];
/** Read repair for legacy category-as-flavor extraction, glued source labels and disproven decaf claims.
 * Source archives stay intact. These corrections also cover old staging rows before recrawl.
 */
export function truthfulMetadata(input:RawMetadata,name:string,features:FeatureValue[]=[]):RawMetadata {
  const raw=cleanProfile(input);
  const source=cleanProfile(declaredProfile(raw.description??''));
  const missing=Object.fromEntries(Object.entries(source).filter(([key])=>key==='tastingNotes'||raw[key as keyof RawMetadata]==null||raw[key as keyof RawMetadata]===''||raw[key as keyof RawMetadata]==='unknown'||Array.isArray(raw[key as keyof RawMetadata])&&!(raw[key as keyof RawMetadata] as unknown[]).length));
  const metadata={...raw,...missing};
  const decaf=declaredDecaf(name,metadata.description??'');
  const tastingNotes=metadata.tastingNotes?.filter(note=>!CATEGORY_NOTES.has(note.trim().toLocaleLowerCase('tr')));
  const description=metadata.description?.replace(PROFILE_LABEL_PATTERN,match=>`\n${match}`).replace(/\n+/g,'\n').replace(/([,;])\s*(?=\p{L})/gu,'$1 ').trim();
  const manual=features.filter(feature=>feature.sourceType==='MANUAL').map(feature=>feature.feature);
  const overridden=Object.keys(FACT_FEATURES).filter(key=>FACT_FEATURES[key].some(feature=>manual.includes(feature)));
  const result:RawMetadata={...metadata,...(description?{description}:{}),...(typeof metadata.decaf==='boolean'?{}:decaf===null?{}:{decaf}),...(tastingNotes?{tastingNotes}:{})};
  return Object.fromEntries(Object.entries(result).filter(([key])=>!overridden.includes(key)));
}
export function truthfulFeatures(features:FeatureValue[],raw:RawMetadata):FeatureValue[]{
  const evidence=`${raw.description??''} ${(raw.tastingNotes??[]).join(' ')}`;
  const source=raw.sourceData&&typeof raw.sourceData==='object'&&!Array.isArray(raw.sourceData)?raw.sourceData:{};
  const manual=new Set(features.filter(feature=>feature.sourceType==='MANUAL').flatMap(feature=>related(feature.feature)));
  return features.filter(feature=>feature.sourceType==='MANUAL'||!manual.has(feature.feature)).flatMap(feature=>{
    // Grinding options establish what a shop can grind, not brew recommendations for this coffee.
    if(feature.feature==='brew_compatibility'&&feature.version==='v2-profile-1'&&/öğütme|ogutme|grind/i.test(JSON.stringify(source.attributes??[])))return [];
    if(feature.feature==='flavor_notes_normalized'&&Array.isArray(feature.value))return [{...feature,value:feature.value.filter(note=>note!=='Rum'||/(?:^|[^\p{L}])(?:rum|rom)(?=$|[^\p{L}])/iu.test(evidence)).filter(note=>note!=='Leather'||/(?:^|[^\p{L}])(?:deri|leather)(?=$|[^\p{L}])/iu.test(evidence))}];
    return [feature];
  });
}
