/** Exact country-name translations only: no region, variety, substring or origin inference. */
const COUNTRIES: ReadonlyArray<readonly [string, string, ...string[]]> = [
  ['Brazil', 'Brezilya', 'Brasil'], ['Colombia', 'Kolombiya'], ['Ethiopia', 'Etiyopya'],
  ['Kenya', 'Kenya'], ['Guatemala', 'Guatemala'], ['Costa Rica', 'Kosta Rika', 'Kostarika'],
  ['Panama', 'Panama'], ['Peru', 'Peru'], ['Honduras', 'Honduras'], ['El Salvador', 'El Salvador'],
  ['Mexico', 'Meksika'], ['Indonesia', 'Endonezya'], ['Rwanda', 'Ruanda'], ['Burundi', 'Burundi'],
  ['Tanzania', 'Tanzanya'], ['Uganda', 'Uganda'], ['Nicaragua', 'Nikaragua'], ['Bolivia', 'Bolivya'],
  ['Ecuador', 'Ekvador'], ['India', 'Hindistan'], ['Yemen', 'Yemen'],
  ['DR Congo', 'Demokratik Kongo Cumhuriyeti', 'Democratic Republic of the Congo', 'DRC'],
  ['Congo', 'Kongo'], ['Dominican Republic', 'Dominik Cumhuriyeti'], ['Cuba', 'Küba'],
  ['Papua New Guinea', 'Papua Yeni Gine'], ['China', 'Çin'], ['Myanmar', 'Myanmar'],
  ['Vietnam', 'Vietnam'], ['Thailand', 'Tayland'], ['Jamaica', 'Jamaika'],
];
function key(value: string): string { return value.trim().replace(/ı/g, 'i').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }
function country(value: string) { const normalized = key(value); return COUNTRIES.find(names => names.some(name => key(name) === normalized)); }
/** True for a country in the translation table above, under any of its names. */
export function isKnownCountry(value: string): boolean { return Boolean(country(value)); }
export function canonicalCountry(value: string): string { return country(value)?.[0] ?? value.trim(); }
export function countryLabel(value: string): string { return country(value)?.[1] ?? value.trim(); }
export function countryOptions(values: string[]): Array<{ value: string; label: string }> {
  const canonical = [...new Set(values.filter(value => typeof value === 'string' && value.trim() && key(value) !== 'unknown').map(canonicalCountry))];
  return canonical.map(value => ({ value, label: countryLabel(value) })).sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}
/** At most 20 selected values; use one JSON SQL parameter regardless of expansion size. */
export function countryFilterAliases(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean).slice(0, 20).flatMap(value => {
    const known = country(value);
    if (!known) return [value];
    return known.flatMap(name => [name, name.toLocaleLowerCase('tr'), name.toLocaleUpperCase('tr'), name.toLowerCase(), name.toUpperCase()]);
  }))];
}
