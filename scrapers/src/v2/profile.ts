import { load } from 'cheerio';
import { declaredDecaf } from '../../../shared/v2/profile-truth.js';
import { matchFlavorNotes } from '../normalization/flavor-map.js';
import { detectStatedAttributes, normalize } from '../normalization/index.js';
import type { RawProduct } from '../types.js';
import type { FeatureValue, Json } from '../../../shared/v2/types.js';
import { names, text } from './primitives.js';

export const PROFILE_VERSION = 'v2-profile-3';
/** Deliberately excludes handles, image URLs, IDs and unrelated nested navigation data. */
export function profileInput(raw: Record<string, unknown>, name: string, url: string, id: string | null, description: string, roasterName = ''): RawProduct {
  const tags = typeof raw.tags === 'string' ? raw.tags.split(',') : names(raw.tags);
  const $=load(text(raw.description)||text(raw.body_html));
  const section=(pattern:RegExp)=>{const heading=$('h2,h3,h4').filter((_,el)=>pattern.test($(el).text())).first();return heading.length?heading.nextUntil('h2,h3,h4').text().trim():null;};
  return { externalId: id ?? url, name, description, price: null, currency: '', weightGrams: null,
    imageUrl: null, productUrl: url, isAvailable: false, tags: [text(raw.product_type), ...tags, ...names(raw.categories)],
    rawData: {v2RoasterName:roasterName,v2TasteText:section(/nasıl bir tada|tadım not|tasting notes/i),v2BrewText:section(/nasıl demlemeli|brewing|brew guide/i), ...Object.fromEntries(['attributes', 'origin', 'koken_tr', 'uretici', 'rakim', 'cultivar', 'islem_tr', 'tadim_notlari_tr'].filter(key => raw[key] != null).map(key => [key, raw[key]]))} };
}
/** Source text supports rules, not verified facts. Never emit inferred values into rawMetadata. */
export function deriveProfileFeatures(input: RawProduct): FeatureValue[] {
  const normalized = normalize(input);
  const source=input.rawData??{};
  // A tasting section (or the roaster's tasting field) is the whole truth when present; running prose only fills in
  // when there is none, and then without the everyday words that are also notes.
  const declaredTaste=typeof source.v2TasteText==='string'?source.v2TasteText:text(source.tadim_notlari_tr)||undefined;
  const flavor=declaredTaste!==undefined?matchFlavorNotes(declaredTaste,true):matchFlavorNotes([input.name,input.description,...(input.tags??[])].join(' '),true,true);
  const brew=normalize({...input,name:'',description:typeof source.v2BrewText==='string'?source.v2BrewText:input.description,tags:[],rawData:{}});
  const stated=detectStatedAttributes(input);
  const values: Array<[string, Json | undefined]> = [
    ['normalized_origin', stated.countries], ['process_family', stated.processes.map(entry=>entry.process)], ['roast_classification', normalized.roast_level],
    ['flavor_notes_normalized', flavor.notes], ['flavor_families', flavor.categories],
    ['normalized_variety', stated.varieties], ['brew_compatibility', brew.brew_methods],
    // Absence of a decaf statement does not establish that a coffee contains caffeine.
    ['is_decaf', declaredDecaf(input.name,input.description) ?? undefined],
  ];
  return values.filter((entry): entry is [string, Json] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '' && entry[1] !== 'unknown' && (!Array.isArray(entry[1]) || entry[1].length > 0))
    .map(([feature, value]) => ({ feature, value, sourceType: 'RULE_INFERRED', confidence: null, version: PROFILE_VERSION, sourceReference: input.productUrl }));
}
