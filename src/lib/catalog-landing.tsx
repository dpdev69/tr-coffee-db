import Link from 'next/link';
import { canonicalCountry, countryLabel, countryOptions, isKnownCountry } from '../../shared/v2/country-labels';
import { catalogFacts, catalogFactsMany, listOrigins, type CatalogFilters } from '../../shared/v2/catalog';
import type { CatalogDatabase } from '../../shared/v2/database';
import { PROCESS_LABELS, PROCESS_VALUES } from './constants/filter-options';
import { normalizeCityFilterValue } from './filter-contract';

/**
 * Origin and process landing pages: the catalog with one preset filter at a clean address.
 * Origins are limited to the country translation table, so a stray source string never becomes a page.
 */
export type Facet = 'koken' | 'islem';
export interface Landing { facet: Facet; value: string; label: string; path: string; filters: CatalogFilters }
export type LandingWithFacts = Landing & { coffees: number; roasters: number };

const slug = (label: string) => normalizeCityFilterValue(label) ?? '';
const PROCESSES = PROCESS_VALUES.filter(value => value !== 'unknown');

function landing(facet: Facet, value: string): Landing {
  const label = facet === 'koken' ? countryLabel(value) : PROCESS_LABELS[value];
  return { facet, value, label, path: `/kahveler/${facet}/${slug(label)}`, filters: facet === 'koken' ? { origin: [value] } : { process: [value] } };
}

/** A catalog origin value or label (any spelling the filter accepts) to its landing page. */
export function originLanding(value: string): Landing | null {
  return isKnownCountry(value) ? landing('koken', canonicalCountry(value)) : null;
}
/** A process key (`natural`) or its label (`Natürel`) to its landing page. */
export function processLanding(value: string): Landing | null {
  const key = value.trim().toLowerCase();
  const found = PROCESSES.find(process => process === key || PROCESS_LABELS[process].toLocaleLowerCase('tr-TR') === value.trim().toLocaleLowerCase('tr-TR'));
  return found ? landing('islem', found) : null;
}
/** Only the address the page itself would link to resolves; any other spelling is a 404. */
export function findLanding(facet: string, value: string): Landing | null {
  const found = facet === 'koken' ? originLanding(value.replace(/-/g, ' ')) : facet === 'islem' ? PROCESSES.map(process => landing('islem', process)).find(item => item.path.endsWith(`/${value}`)) ?? null : null;
  return found && found.path === `/kahveler/${facet}/${value}` ? found : null;
}

/** Every origin and process with listed coffees, counted with the catalog's filter rules. */
export async function listLandings(db: CatalogDatabase): Promise<LandingWithFacts[]> {
  const origins = countryOptions(await listOrigins(db)).flatMap(({ value }) => originLanding(value) ?? []);
  const all = [...origins, ...PROCESSES.map(process => landing('islem', process))];
  const facts = await catalogFactsMany(db, all.map(item => item.filters));
  return all.map((item, index) => ({ ...item, ...facts[index] })).filter(item => item.coffees > 0);
}

/** One landing's facts. The shared landing list already counted it with the same filter (listLandings is derived once per
 * refresh); a landing missing from that list (nothing listed today) is counted on its own. */
export async function landingFacts(db: CatalogDatabase, landing: Landing): Promise<{ coffees: number; roasters: number }> {
  const listed = (await listLandings(db)).find(item => item.path === landing.path);
  return listed ? { coffees: listed.coffees, roasters: listed.roasters } : catalogFacts(db, landing.filters);
}

/** "Etiyopya kökenli" / "natürel işlemli": the phrase every landing sentence is built on. */
export function landingPhrase(item: Landing) {
  return item.facet === 'koken' ? `${item.label} kökenli` : `${item.label.toLocaleLowerCase('tr-TR')} işlemli`;
}
export function landingHeading(item: Landing) {
  return item.facet === 'koken' ? `${item.label} kahveleri` : `${item.label} işlemli kahveler`;
}

export function LandingLinks({ landings }: { landings: LandingWithFacts[] }) {
  const groups: [string, LandingWithFacts[]][] = [['Kökene göre', landings.filter(item => item.facet === 'koken')], ['İşleme göre', landings.filter(item => item.facet === 'islem')]];
  return <nav aria-label="Kökene ve işleme göre kahveler" className="mt-12 grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
    {groups.map(([title, items]) => items.length ? <div key={title}><h2 className="mb-3 font-display text-2xl">{title}</h2><ul className="flex flex-wrap gap-2">{items.map(item => <li key={item.path}><Link href={item.path} prefetch={false} className="filter-option">{item.label} <span className="text-muted">{item.coffees}</span></Link></li>)}</ul></div> : null)}
  </nav>;
}
