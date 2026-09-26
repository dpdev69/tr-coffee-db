import type { FeatureValue, RawMetadata } from './types';

const CATEGORY_NOTES=new Set(['filtre kahve','kahve','nitelikli kahve','çekirdek kahve','cekirdek kahve','specialty coffee','coffee','filter coffee','espresso coffee']);
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
  const decaf=declaredDecaf(name,raw.description??'');
  const tastingNotes=raw.tastingNotes?.filter(note=>!CATEGORY_NOTES.has(note.trim().toLocaleLowerCase('tr')));
  return {...raw,...(typeof raw.decaf==='boolean'?{}:decaf===null?{}:{decaf}),...(tastingNotes?{tastingNotes}:{})};
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
