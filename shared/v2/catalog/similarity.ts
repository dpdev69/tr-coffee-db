import { FACT_FEATURES } from '../profile-truth';
import { coffeeOnlySql } from '../coffee-eligibility';
import type { CatalogDatabase } from '../database';
import type { FeatureValue, RawMetadata } from '../types';
import { hydrate, listedRows } from './hydrate';
import { COFFEE_COLUMNS } from './sql';
import type { CatalogCoffee, CoffeeRow } from './types';
import { derived, parseJson } from './util';

const SIMILARITY_FEATURES = [...FACT_FEATURES.country, ...FACT_FEATURES.process, ...FACT_FEATURES.tastingNotes]
  .map((feature) => `'${feature}'`)
  .join(',');
/** What similarity reads of a candidate, already resolved: the three fact lists (after the MANUAL rule) and the name, lower-cased.
 * Stored once per refresh as a derived result, so it is kept small: about 290 bytes a coffee, 1.45 MB at the 5,000 cap. */
export type SimilarityCandidate = {
  id: string;
  roasterId: string;
  name: string;
  url: string;
  firstSeenAt: string;
  origin: string[];
  process: string[];
  flavor: string[];
};
const lowerTr = (values: string[]) => [...new Set(values.map((value) => value.toLocaleLowerCase('tr-TR')))];

/** Every listed coffee's origin, process and flavor facts (after the MANUAL rule), newest first. The same for every coffee
 * page, so it is read once per refresh (derived cache), not per view; comparison pages pick their coffees from it too.
 * ponytail: cap at the same 5,000 newest candidates; move ranking into indexed SQL if the catalog outgrows it. */
export function similarityCandidates(db: CatalogDatabase): Promise<SimilarityCandidate[]> {
  return derived(db, 'similar-candidates', async () =>
    (
      await db
        .prepare(
          `SELECT ${COFFEE_COLUMNS},(SELECT json_group_array(json_object('feature',f.feature,'value',json(f.value_json),'sourceType',f.source_type)) FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${SIMILARITY_FEATURES})) AS similarity_features_json FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} ORDER BY c.first_seen_at DESC,c.id LIMIT 5000`,
        )
        .all<CoffeeRow & { similarity_features_json: string }>()
    ).results.map((row): SimilarityCandidate => {
      const raw = parseJson<RawMetadata>(row.raw_metadata_json, {});
      const all = parseJson<Array<Pick<FeatureValue, 'feature' | 'value' | 'sourceType'>>>(
        row.similarity_features_json,
        [],
      );
      // Same rule as the filters: a MANUAL fact replaces raw and inferred values of its kind.
      const facts = (field: string, declared: string | null | undefined, ...names: string[]) => {
        const manual = all.filter((f) => f.sourceType === 'MANUAL' && FACT_FEATURES[field].includes(f.feature));
        return lowerTr(
          manual.length
            ? featureStrings({ features: manual }, ...names)
            : featureStrings({ features: all }, ...names).concat(declared ?? []),
        );
      };
      return {
        id: row.id,
        roasterId: row.roaster_id,
        name: row.name.toLocaleLowerCase('tr-TR'),
        url: row.canonical_url,
        firstSeenAt: row.first_seen_at,
        origin: facts('country', raw.country, 'normalized_origin', 'origin_country'),
        process: facts('process', raw.process, 'process_family', 'process'),
        flavor: facts('tastingNotes', null, 'flavor_families', 'flavor_categories'),
      };
    }),
  );
}

/** Explainable catalog similarity, never a personalized numerical match. */
export async function getSimilarCoffees(
  db: CatalogDatabase,
  coffee: CatalogCoffee,
  limit = 4,
): Promise<Array<CatalogCoffee & { similarityReasons: string[] }>> {
  const candidates = await similarityCandidates(db);
  const origin = lowerTr(
    featureStrings(coffee, 'normalized_origin', 'origin_country').concat(coffee.rawMetadata.country ?? []),
  );
  const process = lowerTr(featureStrings(coffee, 'process_family', 'process').concat(coffee.rawMetadata.process ?? []));
  const flavor = lowerTr(featureStrings(coffee, 'flavor_families', 'flavor_categories'));
  const name = coffee.name.toLocaleLowerCase('tr-TR');
  const overlaps = (left: string[], right: string[]) => left.some((value) => right.includes(value));
  const selected = candidates
    .filter(
      (c) =>
        c.id !== coffee.id && c.url !== coffee.canonicalUrl && !(c.roasterId === coffee.roaster.id && c.name === name),
    )
    .map((row) => {
      const reasons: string[] = [];
      if (overlaps(origin, row.origin)) reasons.push('Aynı kökenden');
      if (overlaps(process, row.process)) reasons.push('Benzer işleme yöntemi');
      if (overlaps(flavor, row.flavor)) reasons.push('Benzer tat profili');
      return { row, similarityReasons: reasons };
    })
    .filter((c) => c.similarityReasons.length > 0)
    .sort(
      (a, b) =>
        b.similarityReasons.length - a.similarityReasons.length ||
        b.row.firstSeenAt.localeCompare(a.row.firstSeenAt) ||
        a.row.id.localeCompare(b.row.id),
    )
    .slice(0, Math.min(12, Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 4)));
  const rows = await listedRows(
    db,
    selected.map((candidate) => candidate.row.id),
  );
  const hydrated = await hydrate(db, rows, Date.now());
  return hydrated.map((candidate) => ({
    ...candidate,
    similarityReasons: selected.find((item) => item.row.id === candidate.id)!.similarityReasons,
  }));
}

function featureStrings(
  coffee: { features: Array<Pick<FeatureValue, 'feature' | 'value'>> },
  ...names: string[]
): string[] {
  return coffee.features
    .filter((f) => names.includes(f.feature))
    .flatMap((f) =>
      typeof f.value === 'string'
        ? [f.value]
        : Array.isArray(f.value)
          ? f.value.filter((v): v is string => typeof v === 'string')
          : [],
    );
}
