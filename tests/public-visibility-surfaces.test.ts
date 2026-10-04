import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { POST as retiredClick } from '../src/app/api/click/route';

describe('public visibility query surfaces', () => {
  it('preserves the legacy fallback public gates and uses canonical D1 rows for the migrated filter loader', () => {
    const source = readSource('src/lib/queries/coffees.ts');
    const roasterSource = readSource('src/lib/queries/roasters.ts');
    const catalogPageSource = readSource('src/components/v2/discovery-catalog.tsx');

    assertSurfaceUsesPublicGate(source, 'getCoffees', /export async function getCoffees[\s\S]*?export async function getCoffeeBySlug/);
    assertSurfaceUsesPublicGate(source, 'getCoffeeIdsForSearch', /async function getCoffeeIdsForSearch[\s\S]*?export async function getCoffeeBySlug/);
    assertSurfaceUsesPublicGate(source, 'getCoffeeBySlug', /export async function getCoffeeBySlug[\s\S]*?async function getRoasterIdsForCities/);
    assertSurfaceUsesPublicGate(source, 'getSimilarCoffees', /export async function getSimilarCoffees[\s\S]*?export async function getFeaturedCoffees/);
    assertSurfaceUsesPublicGate(source, 'getFeaturedCoffees', /export async function getFeaturedCoffees[\s\S]*?export async function getStats/);
    assertSurfaceUsesPublicGate(source, 'getStats coffee counts and origins', /export async function getStats[\s\S]*$/);
    assertSurfaceUsesPublicGate(roasterSource, 'getRoasters public coffee counts', /export async function getRoasters[\s\S]*?export async function getRoasterBySlug/);
    assert.match(catalogPageSource, /listCatalog\(db,filters\)/);
    assert.match(catalogPageSource, /listRoasters\(db\)/);
    assert.match(catalogPageSource, /FROM public_catalog_coffees c/);
    assert.match(catalogPageSource, /JOIN public_catalog_coffees c ON c.id=f.coffee_id/);
    assert.doesNotMatch(catalogPageSource, /supabase/);
  });

  it('applies the catalog product exclusion rules to every public coffee surface', () => {
    const source = readSource('src/lib/queries/coffees.ts');

    assert.match(source, /function applyPublicCatalogCoffeeVisibility/);
    assertSurfaceUsesCatalogGate(source, 'getCoffees', /export async function getCoffees[\s\S]*?async function getCoffeeIdsForSearch/);
    assertSurfaceUsesCatalogGate(source, 'getCoffeeIdsForSearch', /async function getCoffeeIdsForSearch[\s\S]*?export async function getCoffeeBySlug/);
    assertSurfaceUsesCatalogGate(source, 'getCoffeeBySlug', /export async function getCoffeeBySlug[\s\S]*?async function getRoasterIdsForCities/);
    assertSurfaceUsesCatalogGate(source, 'getSimilarCoffees', /export async function getSimilarCoffees[\s\S]*?export async function getFeaturedCoffees/);
    assertSurfaceUsesCatalogGate(source, 'getFeaturedCoffees', /export async function getFeaturedCoffees[\s\S]*?export async function getStats/);
    assertSurfaceUsesCatalogGate(source, 'getStats', /export async function getStats[\s\S]*$/);
  });

  it('routes catalog search through the indexed database search contract with a fallback', () => {
    const source = readSource('src/lib/queries/coffees.ts');
    const migration = readSource('supabase/migrations/020_catalog_search_contract.sql');

    assert.match(source, /\.rpc\(\s*['"]search_coffees['"]/);
    assert.match(source, /falling back to local scan/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION is_public_catalog_coffee/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_coffees_fts_catalog_extended/);
    assertIndexUsesImmutableExpression(migration, 'idx_coffees_fts_catalog_extended');
    assert.match(migration, /CREATE OR REPLACE FUNCTION search_coffees/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION get_filter_options/);
  });

  it('gates durable sitemap routes and retires the old click write endpoint', async () => {
    const sitemap = readSource('src/app/sitemap.ts');
    assert.match(sitemap, /FROM public_catalog_coffees c WHERE/);
    assert.match(sitemap, /coffeeOnlySql/);
    // lastModified must come from real content changes, never from per-crawl touch stamps.
    assert.doesNotMatch(sitemap, /last_seen_at|last_success_at|updated_at/);
    assert.match(sitemap, /coffee_events e WHERE e.coffee_id=c.id/);
    assert.match(sitemap, /FROM roasters WHERE active=1/);
    assert.match(sitemap, /\/kahve\/\$\{encodeURIComponent\(c.slug\)/);
    assert.match(sitemap, /\/kavurucu\/\$\{encodeURIComponent\(r.slug\)/);
    assert.doesNotMatch(sitemap, /supabase/);
    const response = await retiredClick();
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(readSource('src/app/api/click/route.ts'), /import[^;]*supabase|createClient|\.insert\(|\.rpc\(/);
  });

  it('uses current canonical D1 lists and durable public-only details without a Supabase fallback on Workers', () => {
    const catalog = readSource('shared/v2/catalog.ts');
    const bridge = readSource('src/lib/v2-legacy.ts');
    const migration = readSource('migrations/d1/0001_catalog.sql');
    assert.match(catalog, /FROM public_catalog_coffees c JOIN roasters/);
    assert.match(catalog, /count\(DISTINCT c.id\) AS coffees[\s\S]*FROM public_catalog_coffees c JOIN offers o/);
    assert.match(catalog, /WHERE \$\{coffeeOnlySql\(\)\}/);
    assert.match(catalog, /WHERE c.visibility='public' AND/);
    assert.match(catalog, /JOIN public_catalog_coffees c ON c.roaster_id=r.id/);
    assert.match(migration, /CREATE VIEW public_catalog_coffees/);
    assert.match(migration, /c.visibility='public'/);
    assert.match(migration, /o.in_stock=1/);
    assert.match(bridge, /if \(!env.DB\) throw new Error\('Catalog binding unavailable'\)/);
    assert.match(bridge, /const result = await listCatalog\(db,/);
    assert.match(bridge, /const coffee = await getCoffeeDetail\(db, slug\)/);
  });

  it('keeps latest database function definitions aligned with public visibility when migration 015 defines them', () => {
    const migrationSource = readSource('supabase/migrations/015_add_specialty_visibility_controls.sql');

    if (/CREATE OR REPLACE FUNCTION\s+get_filter_options/i.test(migrationSource)) {
      assertSqlUsesPublicGate(migrationSource, 'latest get_filter_options');
    }
    if (/CREATE OR REPLACE FUNCTION\s+search_coffees/i.test(migrationSource)) {
      assertSqlUsesPublicGate(migrationSource, 'latest search_coffees');
    }

    assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_coffees_public_gate/);
    assert.match(migrationSource, /WHERE is_public = true/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertSurfaceUsesPublicGate(source: string, label: string, pattern: RegExp) {
  const match = source.match(pattern);
  assert.ok(match, `Could not locate ${label} in source`);

  assert.ok(
    hasPublicVisibilityGate(match[0]),
    `${label} must apply the shared public coffee visibility gate`
  );
}

function hasPublicVisibilityGate(source: string) {
  return (
    /\.eq\(['"]is_public['"],\s*true\)/.test(source) ||
    /\bapplyPublicCoffeeVisibility\b/.test(source) ||
    /\bapplyPublicCatalogCoffeeVisibility\b/.test(source) ||
    /\bPUBLIC_COFFEE_VISIBILITY\b/.test(source)
  );
}

function assertSqlUsesPublicGate(source: string, label: string) {
  assert.match(source, /\bis_public\s*=\s*true\b/i, `${label} must filter to is_public rows`);
  assert.match(
    source,
    /\bspecialty_status\s*=\s*'specialty'/i,
    `${label} must fail closed to specialty rows`
  );
}

function assertSurfaceUsesCatalogGate(source: string, label: string, pattern: RegExp) {
  const match = source.match(pattern);
  assert.ok(match, `Could not locate ${label} in source`);

  assert.match(
    match[0],
    /applyPublicCatalogCoffeeVisibility/,
    `${label} must apply the shared catalog exclusion gate`
  );
}

function assertIndexUsesImmutableExpression(source: string, indexName: string) {
  const match = source.match(new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}[\\s\\S]*?\\);`));
  assert.ok(match, `Could not locate ${indexName} definition`);

  assert.doesNotMatch(
    match[0],
    /\b(concat_ws|array_to_string)\s*\(/,
    `${indexName} must avoid stable functions that Postgres rejects in index expressions`
  );
}
