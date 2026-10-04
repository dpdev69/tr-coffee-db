import { COFFEE_COLUMNS, hydrate, type CatalogCoffee, type CoffeeRow } from './catalog';
import { coffeeOnlySql, fold } from './coffee-eligibility';
import type { CatalogDatabase } from './database';
import { FACT_FEATURES, truthfulFeatures, truthfulMetadata } from './profile-truth';
import type { FeatureValue, Json, RawMetadata } from './types';

/** Taste matching, explained in words. Never a personalised numeric score on screen (see getSimilarCoffees). */
export type QuizDimension = 'brew' | 'taste' | 'roast' | 'process';
export type QuizAnswers = Record<QuizDimension, string[]>;
export const QUIZ_DIMENSIONS: readonly QuizDimension[] = ['brew', 'taste', 'roast', 'process'];
export const QUIZ_WEIGHTS: Record<QuizDimension, number> = { taste: 3, brew: 2, roast: 2, process: 1 };
/** How much a fact counts by where it came from. A reviewed correction or the roaster's own statement counts fully,
 * a roaster-labelled raw field ("İşlem: Natürel") slightly less, a rule's reading of the text about half. */
const TRUST = { manual: 1, stated: 1, labelled: 0.85, inferred: 0.5 } as const;
export type QuizProvenance = keyof typeof TRUST;
export interface QuizReason { dimension: QuizDimension; kind: 'match' | 'near' | 'conflict' | 'missing'; values: string[]; provenance: QuizProvenance | null }
/** Everything ranking may look at. Popularity, clicks and sponsorship are deliberately not part of it. */
export interface QuizCandidate { id: string; roasterId: string; firstSeenAt: string; raw: RawMetadata; features: Array<Pick<FeatureValue, 'feature' | 'value' | 'sourceType'>> }
export interface QuizRanked { id: string; score: number; exact: boolean; reasons: QuizReason[] }

const ROASTS = ['light', 'medium_light', 'medium', 'medium_dark', 'dark'];
const BREWS = ['espresso', 'filter', 'french_press', 'aeropress', 'turkish', 'cold_brew', 'moka_pot'];
const TASTES = ['Fruity', 'Floral', 'Chocolate', 'Sweet', 'Nutty', 'Spicy', 'Roasted', 'Herbal'];
/** flavor_notes_normalized holds notes ("Jasmine"), not families, so it is not read here. */
const FEATURES: Record<QuizDimension, readonly string[]> = {
  brew: FACT_FEATURES.brewMethods, taste: ['flavor_families', 'flavor_categories'], roast: FACT_FEATURES.roast, process: FACT_FEATURES.process,
};
const RAW_FIELD: Partial<Record<QuizDimension, 'roast' | 'process'>> = { roast: 'roast', process: 'process' };

export function roastIds(text: string): string[] {
  const t = fold(text).replace(/[_-]/g, ' ');
  if (/orta\s*acik|medium\s*light|light\s*medium/.test(t)) return ['medium_light'];
  if (/orta\s*koyu|medium\s*dark|full\s*city/.test(t)) return ['medium_dark'];
  if (/\b(?:acik|light|cinnamon)\b/.test(t)) return ['light'];
  if (/\b(?:koyu|dark)\b/.test(t)) return ['dark'];
  if (/\b(?:orta|medium)\b/.test(t)) return ['medium'];
  return [];
}
export function processIds(text: string): string[] {
  const t = fold(text).replace(/_/g, ' '), ids = new Set<string>();
  if (/semi\s*wash|yari\s*yikan|pulped/.test(t)) ids.add('semi_washed');
  else if (/wash|yikan|lavado/.test(t)) ids.add('washed');
  if (/wet\s*hull|islak\s*kabuk|giling/.test(t)) ids.add('wet_hulled');
  if (/natural|naturel|dogal|dry\s*process/.test(t) && !/pulped/.test(t)) ids.add('natural');
  if (/honey/.test(t)) ids.add('honey');
  if (/anaerob|carbonic|karbonik/.test(t)) ids.add('anaerobic');
  if (/experimental|deneysel|thermal|termal|infus|co\s*ferment/.test(t)) ids.add('experimental');
  return [...ids];
}
function ids(dimension: QuizDimension, value: Json): string[] {
  const texts = typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const found = texts.flatMap(text => {
    if (dimension === 'roast') return roastIds(text);
    if (dimension === 'process') return processIds(text);
    const key = text.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return (dimension === 'brew' ? BREWS : TASTES).filter(id => id.toLowerCase() === key);
  });
  return [...new Set(found)];
}

/** The best-trusted source that says anything usable. A lower tier never adds to or overrides a higher one. */
export function evidence(candidate: QuizCandidate, dimension: QuizDimension): { values: string[]; provenance: QuizProvenance } | null {
  const fromFeatures = (sourceType: FeatureValue['sourceType']) => [...new Set(candidate.features
    .filter(feature => feature.sourceType === sourceType && FEATURES[dimension].includes(feature.feature))
    .flatMap(feature => ids(dimension, feature.value)))];
  const field = RAW_FIELD[dimension];
  const tiers: Array<[QuizProvenance, () => string[]]> = [
    ['manual', () => fromFeatures('MANUAL')], ['stated', () => fromFeatures('ROASTER_DECLARED')],
    ['labelled', () => field && typeof candidate.raw[field] === 'string' ? ids(dimension, candidate.raw[field]) : []],
    ['inferred', () => fromFeatures('RULE_INFERRED')],
  ];
  for (const [provenance, read] of tiers) {
    const values = read();
    // "Fits every brew method" is a legacy blanket guess, not information about this coffee. A reviewed correction is not a guess.
    if (dimension === 'brew' && values.length >= 5 && provenance !== 'manual') continue;
    if (values.length) return { values, provenance };
  }
  return null;
}

/** Pure: the answers and the coffee's own data decide the order, nothing else. */
export function scoreCandidate(answers: QuizAnswers, candidate: QuizCandidate): QuizRanked {
  let score = 0, exact = true;
  const reasons: QuizReason[] = [];
  for (const dimension of QUIZ_DIMENSIONS) {
    const wanted = answers[dimension];
    if (!wanted.length) continue; // Skipped ("Fark etmez"): not part of the score at all.
    const found = evidence(candidate, dimension);
    if (!found) { exact = false; reasons.push({ dimension, kind: 'missing', values: [], provenance: null }); continue; }
    const trust = TRUST[found.provenance], firm = found.provenance === 'manual' || found.provenance === 'stated' || found.provenance === 'labelled';
    const matched = found.values.filter(value => wanted.includes(value));
    let credit = 0, kind: QuizReason['kind'] | null = null, values = matched;
    if (dimension === 'roast' && !matched.length) {
      // Roast is an ordered scale: one step away is a near miss, not a clash.
      const distance = Math.min(...found.values.flatMap(value => wanted.map(want => Math.abs(ROASTS.indexOf(value) - ROASTS.indexOf(want)))));
      if (distance === 1) { credit = trust * 0.5; kind = 'near'; values = found.values; }
    }
    if (matched.length) {
      // More than one chosen taste: a coffee carrying two of them beats one carrying a single one.
      credit = dimension === 'taste' ? trust * Math.min(1, matched.length / Math.min(wanted.length, 2)) : trust;
      kind = 'match';
    } else if (!kind && firm) { credit = -trust; kind = 'conflict'; values = found.values; }
    // An inferred mismatch is treated as unknown: no credit, no penalty, no claim.
    if (kind !== 'match') exact = false;
    score += QUIZ_WEIGHTS[dimension] * credit;
    if (kind) reasons.push({ dimension, kind, values, provenance: found.provenance });
  }
  const order = { match: 0, near: 1, conflict: 2, missing: 3 };
  return { id: candidate.id, score: Math.round(score * 1000) / 1000, exact, reasons: reasons.sort((a, b) => order[a.kind] - order[b.kind]) };
}

/** Best first, newer first on ties; at most `perRoaster` per roaster unless that would leave the list short. */
export function rankCandidates(answers: QuizAnswers, candidates: QuizCandidate[], limit: number, perRoaster = 2): QuizRanked[] {
  const scored = candidates.map(candidate => ({ candidate, ranked: scoreCandidate(answers, candidate) }))
    .sort((a, b) => b.ranked.score - a.ranked.score || b.candidate.firstSeenAt.localeCompare(a.candidate.firstSeenAt) || a.candidate.id.localeCompare(b.candidate.id));
  const picked: typeof scored = [], overflow: typeof scored = [], perCount = new Map<string, number>();
  for (const entry of scored) {
    if (picked.length >= limit) break;
    const count = perCount.get(entry.candidate.roasterId) ?? 0;
    if (count < perRoaster) { picked.push(entry); perCount.set(entry.candidate.roasterId, count + 1); } else overflow.push(entry);
  }
  // Never empty, never short while the catalog has coffees: a small catalog fills from the same order.
  for (const entry of overflow) { if (picked.length >= limit) break; picked.push(entry); }
  return picked.map(entry => entry.ranked);
}

export type QuizMatch = CatalogCoffee & { quizReasons: QuizReason[]; quizExact: boolean };
/** One candidate query on the public view, scoring in TypeScript, hydration of the winners only (as getSimilarCoffees). */
export async function rankQuizMatches(db: CatalogDatabase, answers: QuizAnswers, limit = 8): Promise<{ coffees: QuizMatch[]; exact: boolean; total: number }> {
  // Whole fact groups, not only the features scored: a MANUAL row on any member (say flavor_notes_normalized) must silence the rest.
  const names = [...new Set(['brewMethods', 'tastingNotes', 'roast', 'process'].flatMap(fact => FACT_FEATURES[fact]))].map(name => `'${name}'`).join(',');
  // ponytail: same 5,000 newest cap as getSimilarCoffees; move scoring into SQL if the catalog outgrows it.
  const rows = await db.prepare(`SELECT ${COFFEE_COLUMNS},(SELECT json_group_array(json_object('feature',f.feature,'value',json(f.value_json),'sourceType',f.source_type,'version',f.version)) FROM coffee_feature_values f WHERE f.coffee_id=c.id AND f.feature IN (${names})) AS quiz_features_json FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE ${coffeeOnlySql()} ORDER BY c.first_seen_at DESC,c.id LIMIT 5000`).all<CoffeeRow & { quiz_features_json: string }>();
  const candidates = rows.results.map(row => toCandidate(row));
  const ranked = rankCandidates(answers, candidates, Math.min(12, Math.max(1, Math.floor(limit) || 8)));
  const byId = new Map(rows.results.map(row => [row.id, row]));
  const hydrated = await hydrate(db, ranked.map(entry => byId.get(entry.id)!), Date.now());
  const coffees = hydrated.map((coffee, index) => ({ ...coffee, quizReasons: ranked[index].reasons, quizExact: ranked[index].exact }));
  return { coffees, exact: coffees.some(coffee => coffee.quizExact), total: candidates.length };
}
export function toCandidate(row: CoffeeRow & { quiz_features_json: string }): QuizCandidate {
  const parse = <T,>(text: string, fallback: T): T => { try { return JSON.parse(text) as T; } catch { return fallback; } };
  const raw = parse<RawMetadata>(row.raw_metadata_json, {});
  // The same read repairs as hydrate(): a MANUAL correction silences the raw field and every non-manual row of its fact.
  const own = parse<FeatureValue[]>(row.quiz_features_json, []).map(feature => ({ ...feature, confidence: null }));
  return { id: row.id, roasterId: row.roaster_id, firstSeenAt: row.first_seen_at, raw: truthfulMetadata(raw, row.name, own), features: truthfulFeatures(own, raw) };
}
