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
/** Read repair for legacy category-as-flavor extraction and disproven decaf claims.
 * Source archives stay intact. These corrections also cover old staging rows before recrawl.
 */
export function truthfulMetadata(raw:RawMetadata,name:string):RawMetadata {
  const source=declaredProfile(raw.description??'');
  const missing=Object.fromEntries(Object.entries(source).filter(([key])=>key==='tastingNotes'||raw[key as keyof RawMetadata]==null||raw[key as keyof RawMetadata]===''||raw[key as keyof RawMetadata]==='unknown'||Array.isArray(raw[key as keyof RawMetadata])&&!(raw[key as keyof RawMetadata] as unknown[]).length));
  const metadata={...raw,...missing};
  const decaf=declaredDecaf(name,metadata.description??'');
  const tastingNotes=metadata.tastingNotes?.filter(note=>!CATEGORY_NOTES.has(note.trim().toLocaleLowerCase('tr')));
  const description=metadata.description?.replace(PROFILE_LABEL_PATTERN,match=>`\n${match}`).replace(/\n+/g,'\n').replace(/([,;])\s*(?=\p{L})/gu,'$1 ').trim();
  return {...metadata,...(description?{description}:{}),...(typeof metadata.decaf==='boolean'?{}:decaf===null?{}:{decaf}),...(tastingNotes?{tastingNotes}:{})};
}
export function truthfulFeatures(features:FeatureValue[],raw:RawMetadata):FeatureValue[]{
  const evidence=`${raw.description??''} ${(raw.tastingNotes??[]).join(' ')}`;
  const source=raw.sourceData&&typeof raw.sourceData==='object'&&!Array.isArray(raw.sourceData)?raw.sourceData:{};
  return features.flatMap(feature=>{
    // Grinding options establish what a shop can grind, not brew recommendations for this coffee.
    if(feature.feature==='brew_compatibility'&&feature.version==='v2-profile-1'&&/öğütme|ogutme|grind/i.test(JSON.stringify(source.attributes??[])))return [];
    if(feature.feature==='flavor_notes_normalized'&&Array.isArray(feature.value))return [{...feature,value:feature.value.filter(note=>note!=='Rum'||/(?:^|[^\p{L}])(?:rum|rom)(?=$|[^\p{L}])/iu.test(evidence)).filter(note=>note!=='Leather'||/(?:^|[^\p{L}])(?:deri|leather)(?=$|[^\p{L}])/iu.test(evidence))}];
    return [feature];
  });
}
