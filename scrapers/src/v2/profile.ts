import { load } from 'cheerio';
import { declaredDecaf } from '../../../shared/v2/profile-truth.js';
import { matchFlavorNotes } from '../normalization/flavor-map.js';
import { detectOrigin } from '../normalization/origin-map.js';
import { normalize } from '../normalization/index.js';
import type { RawProduct } from '../types.js';
import type { FeatureValue, Json } from '../../../shared/v2/types.js';
import { names, text } from './primitives.js';

export const PROFILE_VERSION = 'v2-profile-2';
/** Deliberately excludes handles, image URLs, IDs and unrelated nested navigation data. */
export function profileInput(raw: Record<string, unknown>, name: string, url: string, id: string | null, description: string): RawProduct {
  const tags = typeof raw.tags === 'string' ? raw.tags.split(',') : names(raw.tags);
  const $=load(text(raw.description)||text(raw.body_html));
  const section=(pattern:RegExp)=>{const heading=$('h2,h3,h4').filter((_,el)=>pattern.test($(el).text())).first();return heading.length?heading.nextUntil('h2,h3,h4').text().trim():null;};
  return { externalId: id ?? url, name, description, price: null, currency: '', weightGrams: null,
    imageUrl: null, productUrl: url, isAvailable: false, tags: [text(raw.product_type), ...tags, ...names(raw.categories)],
    rawData: {v2TasteText:section(/nasıl bir tada|tadım not|tasting notes/i),v2BrewText:section(/nasıl demlemeli|brewing|brew guide/i), ...Object.fromEntries(['attributes', 'origin', 'koken_tr', 'uretici', 'rakim', 'cultivar', 'islem_tr', 'tadim_notlari_tr'].filter(key => raw[key] != null).map(key => [key, raw[key]]))} };
}
/** Source text supports rules, not verified facts. Never emit inferred values into rawMetadata. */
export function deriveProfileFeatures(input: RawProduct): FeatureValue[] {
  const normalized = normalize(input);
  const source=input.rawData??{};
  const tasteText=typeof source.v2TasteText==='string'?source.v2TasteText:[input.name,input.description,text(source.tadim_notlari_tr),...(input.tags??[])].join(' ');
  const flavor=matchFlavorNotes(tasteText,true);
  const brew=normalize({...input,name:'',description:typeof source.v2BrewText==='string'?source.v2BrewText:input.description,tags:[],rawData:{}});
  const evidence = [input.name, input.description, ...(input.tags ?? []), JSON.stringify(input.rawData ?? {})].join(' ');
  // The legacy normalizer treats any Gesha mention as Panama. V2 requires explicit Panama text.
  const origin = detectOrigin(evidence.replace(/https?:\/\/\S+/gi, '').replace(/\b(?:gesha|geisha)\b/gi, '')).country;
  const values: Array<[string, Json | undefined]> = [
    ['normalized_origin', origin], ['process_family', normalized.process], ['roast_classification', normalized.roast_level],
    ['flavor_notes_normalized', flavor.notes], ['flavor_families', flavor.categories],
    ['normalized_variety', normalized.variety], ['brew_compatibility', brew.brew_methods],
    // Absence of a decaf statement does not establish that a coffee contains caffeine.
    ['is_decaf', declaredDecaf(input.name,input.description) ?? undefined],
  ];
  return values.filter((entry): entry is [string, Json] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '' && entry[1] !== 'unknown' && (!Array.isArray(entry[1]) || entry[1].length > 0))
    .map(([feature, value]) => ({ feature, value, sourceType: 'RULE_INFERRED', confidence: null, version: PROFILE_VERSION, sourceReference: input.productUrl }));
}
