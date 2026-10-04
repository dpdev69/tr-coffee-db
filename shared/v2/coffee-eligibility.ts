import type { RawMetadata } from './types';

/** Retail identity/taxonomy only. Brew instructions and tasting notes are not product types. */
const EQUIPMENT = ['ekipman', 'equipment', 'aksesuar', 'accessories', 'seramik', 'ceramic', 'stoneware', 'fincan', 'kupa', 'mug', 'dripper', 'grinder', 'ogutucu', 'degirmen', 'terazi', 'kettle', 'filter paper', 'filtre kagidi', 'filtre kagit', 'kahvesi setleri', 'kahve setleri', 'cup set', 'tea set', 'gift set', 'hediye set', 'workshop', 'atolye', 'egitim', 'makinesi', 'machine', 'bardak', 'surahi', 'tote bag', 'bez canta', 'termos', 'thermos', 'tumbler', 'flask', 'matara'];
const NON_COFFEE_NAMES = ['matcha', 'chasen', 'chawan', 'paper chocolate', 'mixed fruit box', 'kakao tozu', 'cikolata bar', 'chocolate bar', 'green tea', 'black tea', 'herbal tea', 'yesil cay', 'siyah cay', 'bitki cayi', 'ekmek', 'ekmegi', 'bread'];
// Source capture 2026-09-14: all ten URLs belong to Molecule's “Türk Kahvesi Setleri”.
// The legacy import omitted taxonomy, so these exact identities also need protection before repair.
const MOLECULE_CERAMICS = ['aktris', 'oxide', 'khaki-splash', 'baby-blue-splash', 'cobalt-splash', 'pink-splash', 'ying-yang', 'paloma', 'ocean', 'citrus'];
const FOLD_PAIRS = [['İ','i'],['I','i'],['ı','i'],['ş','s'],['Ş','s'],['ğ','g'],['Ğ','g'],['ü','u'],['Ü','u'],['ö','o'],['Ö','o'],['ç','c'],['Ç','c']] as const;
function fold(value: string): string { return FOLD_PAIRS.reduce((text, [from, to]) => text.replaceAll(from,to), value).toLowerCase(); }
function record(value: unknown): Record<string,unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {}; }
function taxonomy(metadata: RawMetadata): string {
  const raw=record(metadata.sourceData);
  return [raw.product_type,raw.categories,raw.tags,raw.category].filter(value=>value!=null).map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' ');
}
export function coffeeExclusionReason(product: { name: string; canonicalUrl: string; rawMetadata: RawMetadata }): string | null {
  const name=fold(product.name); const identity=fold(`${product.name} ${taxonomy(product.rawMetadata)}`);
  if (EQUIPMENT.some(term=>identity.includes(term))) return 'non_coffee_equipment_or_service';
  if (NON_COFFEE_NAMES.some(term=>name.includes(term))) return 'non_coffee_product';
  try {
    const url=new URL(product.canonicalUrl);
    if (['coffeemolecule.com','www.coffeemolecule.com'].includes(url.hostname.toLowerCase()) && MOLECULE_CERAMICS.includes(url.pathname.replace(/^\/+|\/+$/g,''))) return 'source_verified_ceramic';
  } catch { /* URL validation is owned by ingestion/outbound. */ }
  return null;
}
function literal(value:string):string { return `'${value.replaceAll("'","''")}'`; }
// Keep boolean trees shallow: D1 caps expression depth at 100.
function anySql(terms:string[]):string {
  if(terms.length===1)return terms[0];
  const middle=Math.ceil(terms.length/2);
  return `(${anySql(terms.slice(0,middle))} OR ${anySql(terms.slice(middle))})`;
}
function foldSql(expression:string):string { return `lower(${FOLD_PAIRS.reduce((sql,[from,to])=>`replace(${sql},${literal(from)},${literal(to)})`,expression)})`; }
/** Same guard at every public SQL boundary, including imported records that were marked public. */
export function coffeeOnlySql(alias='c'):string {
  if(!/^[a-z][a-z0-9_]*$/i.test(alias))throw new Error('Invalid SQL alias');
  const raw=`${alias}.raw_metadata_json`;
  const identity=foldSql(`${alias}.name||' '||coalesce(json_extract(${raw},'$.sourceData.product_type'),'')||' '||coalesce(json_extract(${raw},'$.sourceData.categories'),'')||' '||coalesce(json_extract(${raw},'$.sourceData.tags'),'')||' '||coalesce(json_extract(${raw},'$.sourceData.category'),'')`);
  const name=foldSql(`${alias}.name`);
  const paths=MOLECULE_CERAMICS.flatMap(path=>['coffeemolecule.com','www.coffeemolecule.com'].map(host=>`https://${host}/${path}`));
  return `NOT EXISTS(SELECT 1 FROM (SELECT ${identity} AS identity,${name} AS name) excluded WHERE ${anySql([...EQUIPMENT.map(term=>`instr(excluded.identity,${literal(term)})>0`),...NON_COFFEE_NAMES.map(term=>`instr(excluded.name,${literal(term)})>0`)])})
    AND rtrim(lower(${alias}.canonical_url),'/') NOT IN (${paths.map(literal).join(',')})`;
}
