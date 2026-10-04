/** Applies data/corrections.json after each crawl. Entry shape:
 *   { "coffeeSlug": "...", "features": { "origin_country": "Kenya", "process": null }, "visibility": "hidden", "canonicalOf": "parent-slug" }
 * features → MANUAL rows (null = "unknown", which still overrides wrong raw/inferred values); visibility → visibility_override;
 * canonicalOf → canonical_coffee_id (a size twin of that coffee; null opts the coffee out of automatic linking).
 * The file is the whole truth and git history its audit log: removing an entry removes its effect on the next run.
 * Idempotent; unchanged rows are not rewritten.
 */
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fold } from '../shared/v2/coffee-eligibility';
import type { CatalogDatabase, Statement } from '../shared/v2/database';
import { safeDiagnostic } from '../shared/v2/ingestion';
import { cleanCoffeeName } from '../shared/v2/profile-truth';
import type { Json } from '../shared/v2/types';
import { D1RestDatabase } from './v2-d1-rest';

export interface Correction { coffeeSlug: string; features?: Record<string, Json>; visibility?: 'public' | 'hidden'; canonicalOf?: string | null }
interface CoffeeRow { id: string; roaster_id: string; name: string; slug: string; visibility: string; first_seen_at: string }
const VERSION = 'corrections';

/** "KOYU 2.5KG", "Kenya (1000 gr)" and "Kenya 250 g" share a key with "KOYU" and "Kenya". "Espresso" stays: the roast can differ. */
export function sizeKey(name: string): { folded: string; key: string } {
  const folded = fold(cleanCoffeeName(name)).replace(/\s+/g, ' ').trim();
  return { folded, key: folded.replace(/[\s,/|(–—-]*\d+(?:[.,]\d+)?\s*(?:kg|kilo|gr|gram|g)\b\.?\)?$/u, '').trim() };
}

export async function applyCorrections(db: CatalogDatabase, corrections: Correction[], now = new Date().toISOString()) {
  const coffees = (await db.prepare('SELECT id,roaster_id,name,slug,visibility,first_seen_at FROM coffees').all<CoffeeRow>()).results;
  const aliases = (await db.prepare("SELECT alias,coffee_id FROM coffee_aliases WHERE alias_type='slug'").all<{ alias: string; coffee_id: string }>()).results;
  const find = (slug: unknown) => {
    const id = coffees.find(row => row.slug === slug)?.id ?? aliases.find(row => row.alias === slug)?.coffee_id;
    const coffee = coffees.find(row => row.id === id);
    if (!coffee) throw new Error(`Unknown coffee slug in corrections: ${String(slug)}`);
    return coffee;
  };
  const statements: Statement[] = [], manualKeys: string[] = [], overrides = new Map<string, string>(), links = new Map<string, string>(), optOut = new Set<string>();
  for (const entry of corrections) {
    const coffee = find(entry.coffeeSlug);
    for (const [feature, value] of Object.entries(entry.features ?? {})) {
      if (!/^[a-z][a-z_]*$/.test(feature)) throw new Error(`Invalid feature name for ${entry.coffeeSlug}: ${feature}`);
      manualKeys.push(`${coffee.id}|${feature}`);
      statements.push(db.prepare(`INSERT INTO coffee_feature_values(coffee_id,feature,value_json,source_type,confidence,version,source_reference,created_at,updated_at)
        VALUES(?,?,?,'MANUAL',NULL,'${VERSION}','data/corrections.json',?,?)
        ON CONFLICT(coffee_id,feature,source_type) DO UPDATE SET value_json=excluded.value_json,version=excluded.version,updated_at=excluded.updated_at
        WHERE coffee_feature_values.value_json IS NOT excluded.value_json OR coffee_feature_values.version IS NOT excluded.version`).bind(coffee.id, feature, JSON.stringify(value), now, now));
    }
    if (entry.visibility !== undefined) {
      if (entry.visibility !== 'public' && entry.visibility !== 'hidden') throw new Error(`Invalid visibility for ${entry.coffeeSlug}`);
      overrides.set(coffee.id, entry.visibility);
    }
    if (entry.canonicalOf === null) optOut.add(coffee.id);
    else if (entry.canonicalOf !== undefined) {
      const parent = find(entry.canonicalOf);
      if (parent.id === coffee.id || parent.roaster_id !== coffee.roaster_id) throw new Error(`canonicalOf must name another coffee of the same roaster: ${entry.coffeeSlug}`);
      links.set(coffee.id, parent.id);
    }
  }
  if ([...links.values()].some(parent => links.has(parent))) throw new Error('canonicalOf cannot point at a coffee that is itself a child.');
  // Automatic links only for the safe case: same roaster, public, names equal once a size suffix is removed, and every name distinct
  // (identical names may be a relisted lot). The oldest coffee is the parent, so its URL stays the group's URL.
  const explicit = new Set([...links.keys(), ...links.values(), ...optOut]);
  const groups = new Map<string, (CoffeeRow & { folded: string })[]>();
  for (const coffee of coffees) {
    if ((overrides.get(coffee.id) ?? coffee.visibility) !== 'public' || explicit.has(coffee.id)) continue;
    const { folded, key } = sizeKey(coffee.name);
    if (!key) continue;
    groups.set(`${coffee.roaster_id}|${key}`, [...(groups.get(`${coffee.roaster_id}|${key}`) ?? []), { ...coffee, folded }]);
  }
  for (const [group, members] of groups) {
    const key = group.slice(group.indexOf('|') + 1);
    if (members.length < 2 || !members.some(member => member.folded !== key) || new Set(members.map(member => member.folded)).size !== members.length) continue;
    const [parent, ...children] = members.sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at) || a.id.localeCompare(b.id));
    for (const child of children) links.set(child.id, parent.id);
  }
  statements.push(
    db.prepare(`DELETE FROM coffee_feature_values WHERE source_type='MANUAL' AND version='${VERSION}' AND coffee_id||'|'||feature NOT IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(manualKeys)),
    db.prepare('UPDATE coffees SET visibility_override=NULL,updated_at=? WHERE visibility_override IS NOT NULL AND id NOT IN (SELECT value FROM json_each(?))').bind(now, JSON.stringify([...overrides.keys()])),
    db.prepare('UPDATE coffees SET canonical_coffee_id=NULL,updated_at=? WHERE canonical_coffee_id IS NOT NULL AND id NOT IN (SELECT value FROM json_each(?))').bind(now, JSON.stringify([...links.keys()])),
    // The crawled value is not kept apart; a cleared override is replaced by the next crawl.
    ...[...overrides].map(([id, visibility]) => db.prepare('UPDATE coffees SET visibility_override=?,visibility=?,updated_at=? WHERE id=? AND (visibility_override IS NOT ? OR visibility<>?)').bind(visibility, visibility, now, id, visibility, visibility)),
    ...[...links].map(([child, parent]) => db.prepare('UPDATE coffees SET canonical_coffee_id=?,updated_at=? WHERE id=? AND canonical_coffee_id IS NOT ?').bind(parent, now, child, parent)),
  );
  await db.batch(statements);
  const name = (id: string) => coffees.find(row => row.id === id)!.slug;
  return { features: manualKeys.length, overrides: overrides.size, links: [...links].map(([child, parent]) => `${name(child)} → ${name(parent)}`) };
}

async function main() {
  const db = new D1RestDatabase(process.env.CLOUDFLARE_ACCOUNT_ID ?? '', process.env.CLOUDFLARE_D1_DATABASE_ID ?? '', process.env.CLOUDFLARE_D1_API_TOKEN ?? '');
  const corrections = JSON.parse(await readFile(new URL('../data/corrections.json', import.meta.url), 'utf8')) as Correction[];
  if (!Array.isArray(corrections)) throw new Error('data/corrections.json must be an array.');
  const result = await applyCorrections(db, corrections);
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\nCorrections: ${result.features} manual features, ${result.overrides} visibility overrides, ${result.links.length} size-twin links.\n${result.links.map(link => `- ${link}`).join('\n')}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(safeDiagnostic(error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
