import { FACT_FEATURES } from '../profile-truth';
import { coffeeOnlySql, fold, foldSql } from '../coffee-eligibility';
import { countryFilterAliases } from '../country-labels';
import type { SqlValue } from '../database';
import { EVENT_TYPES, eventValidity, placeholders, PREFERRED_PRICE } from './sql';
import type { CatalogFilters } from './types';

// Common spelling pairs in roaster copy; a search for one finds the other.
const SEARCH_SYNONYMS = [
  ['geisha', 'gesha'],
  ['etiyopya', 'ethiopia'],
  ['kolombiya', 'colombia'],
  ['brezilya', 'brazil'],
  ['kenya', 'kenia'],
  ['natural', 'dogal'],
  ['washed', 'yikanmis'],
];

export function buildFilters(filters: CatalogFilters): { where: string; values: SqlValue[]; conditions: string[] } {
  const conditions = [coffeeOnlySql()];
  const values: SqlValue[] = [];
  // Querying declared and inferred fields together is useful; their display/provenance remains separate.
  const metadata = (field: string, accepted?: string[], expand?: (input: string[]) => string[]) => {
    const selected = accepted
      ?.map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!selected?.length) return;
    const input = JSON.stringify(expand ? expand(selected) : selected);
    // JSON arrays bound as values keep alias expansion and combined filters below D1's parameter limit.
    const matches = 'IN (SELECT value FROM json_each(?))';
    // Feature names are code constants, not input. A reviewed MANUAL row decides alone: raw and inferred values it contradicts never match.
    const features = FACT_FEATURES[field].map((feature) => `'${feature}'`).join(',');
    const manual = `EXISTS(SELECT 1 FROM coffee_feature_values m WHERE m.coffee_id=c.id AND m.source_type='MANUAL' AND m.feature IN (${features}))`;
    conditions.push(
      `(NOT ${manual} AND (json_extract(c.raw_metadata_json,?) ${matches} OR EXISTS(SELECT 1 FROM json_each(c.raw_metadata_json,?) j WHERE j.value ${matches})) OR EXISTS(SELECT 1 FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${features}) AND (f.source_type='MANUAL' OR NOT ${manual}) AND (json_extract(f.value_json,'$') ${matches} OR EXISTS(SELECT 1 FROM json_each(f.value_json) j WHERE j.value ${matches}))))`,
    );
    values.push(`$.${field}`, input, `$.${field}`, input, input, input);
  };
  metadata('country', filters.origin, countryFilterAliases);
  metadata('process', filters.process);
  metadata('roast', filters.roast);
  metadata('tastingNotes', filters.taste);
  metadata('brewMethods', filters.brewMethod);
  if (filters.roaster?.length) {
    const input = filters.roaster.slice(0, 20);
    conditions.push(`r.slug IN (${placeholders(input.length)})`);
    values.push(...input);
  }
  if (filters.search?.trim()) {
    // SQLite only folds ASCII case, so both sides are folded (İ/ı/ş/ğ/ü/ö/ç) before matching.
    const term = fold(filters.search.trim().slice(0, 100));
    const terms = [
      ...new Set([
        term,
        ...SEARCH_SYNONYMS.flatMap((pair) =>
          pair.flatMap((word) => (term.includes(word) ? pair.map((other) => term.replaceAll(word, other)) : [])),
        ),
      ]),
    ].slice(0, 4);
    const fields = [
      foldSql('c.name'),
      foldSql('r.name'),
      foldSql("coalesce(json_extract(c.raw_metadata_json,'$.description'),'')"),
    ];
    // instr, not LIKE: D1 refuses LIKE patterns over 50 bytes, which broke every search of about 48 characters or more.
    // Both sides are already folded, and instr treats % and _ literally, so nothing needs escaping.
    conditions.push(`(${terms.flatMap(() => fields.map((field) => `instr(${field},?)>0`)).join(' OR ')})`);
    values.push(...terms.flatMap((value) => fields.map(() => value)));
  }
  for (const [filter, field] of [
    ['farm', 'farm'],
    ['producer', 'producer'],
    ['variety', 'varieties'],
  ] as const) {
    const input = filters[filter];
    if (input?.trim()) metadata(field, [input.trim()]);
  }
  if (filters.altitude?.trim()) {
    // Source text only: a digit sequence is not evidence of a numeric altitude/range.
    conditions.push(
      "json_type(c.raw_metadata_json,'$.altitude')='text' AND lower(trim(json_extract(c.raw_metadata_json,'$.altitude'))) NOT IN ('','unknown','bilinmiyor') AND instr(lower(json_extract(c.raw_metadata_json,'$.altitude')),lower(?))>0",
    );
    values.push(filters.altitude.trim().slice(0, 100));
  }
  if (filters.traceability === 'available' || filters.traceability === 'missing') {
    // Same archived identity/publication boundary as the retained journey bridge.
    const evidence = `EXISTS(SELECT 1 FROM legacy_id_map m
      JOIN legacy_traceability a ON a.source_table='coffees' AND a.legacy_id=m.legacy_id
      JOIN legacy_traceability l ON l.source_table='coffee_lots' AND l.legacy_id=json_extract(a.payload_json,'$.green_lot_id')
      WHERE m.source_system='supabase' AND m.entity_type='coffee' AND m.canonical_id=c.id
      AND json_extract(l.payload_json,'$.is_public')=1
      AND EXISTS(SELECT 1 FROM legacy_traceability s WHERE s.source_table='trace_sources'
        AND json_extract(s.payload_json,'$.lot_id')=l.legacy_id AND json_extract(s.payload_json,'$.is_public')=1
        AND json_type(s.payload_json,'$.source_url')='text' AND length(trim(json_extract(s.payload_json,'$.source_url')))>0))`;
    conditions.push(filters.traceability === 'missing' ? `NOT ${evidence}` : evidence);
  }
  if (Number.isFinite(filters.priceMin) || Number.isFinite(filters.priceMax)) {
    if (Number.isFinite(filters.priceMin)) {
      conditions.push(`${PREFERRED_PRICE}>=?`);
      values.push(Math.round(Math.max(0, filters.priceMin!) * 100));
    }
    if (Number.isFinite(filters.priceMax)) {
      conditions.push(`${PREFERRED_PRICE}<=?`);
      values.push(Math.round(Math.max(0, filters.priceMax!) * 100));
    }
  }
  if (filters.event && EVENT_TYPES.has(filters.event)) {
    const eventConditions = ['e.type=?'];
    values.push(filters.event);
    if (filters.since && Number.isFinite(Date.parse(filters.since))) {
      eventConditions.push('e.created_at>=?');
      values.push(new Date(filters.since).toISOString());
    }
    const validity = eventValidity(filters.event);
    if (validity) eventConditions.push(validity.slice(5));
    // Not correlated with c: the few valid events are found once, not checked again for every listed coffee.
    conditions.push(
      `c.id IN (SELECT g.group_id FROM coffee_events e JOIN coffee_group_members g ON g.coffee_id=e.coffee_id WHERE ${eventConditions.join(' AND ')})`,
    );
  }
  return { where: conditions.join(' AND '), values, conditions };
}
