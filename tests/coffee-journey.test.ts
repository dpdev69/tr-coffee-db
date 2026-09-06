import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { calculateTraceabilityScore, VALIDATION_STRENGTH } from '@/lib/coffee-journey';
import { rankCoffees } from '@/lib/coffee-rankings';
import type { CoffeeWithRoaster } from '@/lib/types/database';

const migrationPath =
  'supabase/migrations/20260712213742_coffee_lot_journey.sql';
const indexMigrationPath =
  'supabase/migrations/20260712220517_index_journey_foreign_keys.sql';

describe('coffee journey data contract', () => {
  it('scores traceability from disclosed metadata without treating it as verification', () => {
    assert.equal(
      calculateTraceabilityScore({
        origin_country: 'Colombia',
        origin_region: 'Huila',
        origin_farm: 'Finca Esperanza',
        origin_producer: 'Ana Gómez',
        origin_altitude: '1,850 m',
        harvest_year: '2025',
        process: 'washed',
        variety: 'Pink Bourbon',
        sca_score: 88,
      }),
      100
    );

    assert.equal(
      calculateTraceabilityScore({
        origin_country: 'Ethiopia',
        origin_region: null,
        origin_farm: null,
        origin_producer: null,
        origin_altitude: null,
        harvest_year: null,
        process: 'natural',
        variety: null,
        sca_score: null,
      }),
      25
    );
    assert.ok(VALIDATION_STRENGTH.document_verified > VALIDATION_STRENGTH.observed);
  });

  it('creates lot, evidence, assessment, certification, and trace-event tables', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    for (const table of [
      'coffee_lots',
      'supply_chain_organizations',
      'lot_organizations',
      'trace_sources',
      'coffee_claims',
      'trace_events',
      'coffee_assessments',
      'coffee_certifications',
    ]) {
      assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
      assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    }
  });

  it('backfills scraped facts as observed and keeps future ingestion synchronized', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    assert.match(migration, /Existing scraped facts are backfilled as `observed`, never as verified/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION sync_coffee_journey\(\)/);
    assert.match(migration, /AFTER INSERT OR UPDATE OF[\s\S]*last_seen_at[\s\S]*ON coffees/);
    assert.doesNotMatch(
      migration,
      /INSERT INTO coffee_claims[\s\S]{0,900}'document_verified'/
    );
  });

  it('keeps public journey tables read-only', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    assert.match(migration, /FOR SELECT TO anon, authenticated/);
    assert.match(
      migration,
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION sync_coffee_journey\(\) FROM PUBLIC, anon, authenticated/
    );
  });

  it('indexes every source and organization foreign key used by the journey graph', () => {
    const migration = readFileSync(indexMigrationPath, 'utf8');

    for (const index of [
      'idx_coffee_assessments_coffee',
      'idx_coffee_assessments_source',
      'idx_coffee_certifications_organization',
      'idx_coffee_certifications_source',
      'idx_coffee_claims_source',
      'idx_trace_events_source',
    ]) {
      assert.match(migration, new RegExp(`CREATE INDEX IF NOT EXISTS ${index}`));
    }
  });
});

describe('journey experience surfaces', () => {
  it('renders the journey, evidence ledger, and independent ranking categories', () => {
    const detail = readFileSync('src/app/coffees/[slug]/page.tsx', 'utf8');
    const journey = readFileSync('src/components/coffee/coffee-journey.tsx', 'utf8');
    const rankings = readFileSync('src/app/rankings/page.tsx', 'utf8');

    assert.match(detail, /CoffeeJourneySection/);
    assert.match(detail, /QualityDossier/);
    assert.match(detail, /EvidenceDrawer/);
    assert.match(journey, /Boşlukları tahminlerle doldurmuyoruz/);
    assert.match(rankings, /En izlenebilir kahveler/);
    assert.match(rankings, /Yayınlanan en yüksek puanlar/);
    assert.match(rankings, /En çok incelenen kahveler/);
  });

  it('keeps traceability, quality, price, and interest as independent rankings', () => {
    const coffees = [
      rankedCoffee('traceable', { traceability: 95, score: 82, price: 180, clicks: 5 }),
      rankedCoffee('quality', { traceability: 60, score: 91, price: 240, clicks: 10 }),
      rankedCoffee('price', { traceability: 45, score: null, price: 120, clicks: 1 }),
      rankedCoffee('interest', { traceability: 30, score: null, price: 100, clicks: 500 }),
    ];

    const rankings = rankCoffees(coffees, 4);

    assert.equal(rankings.traceability[0]?.slug, 'traceable');
    assert.equal(rankings.qualityEvidence[0]?.slug, 'quality');
    assert.equal(rankings.accessiblePrice[0]?.slug, 'price');
    assert.equal(rankings.marketInterest[0]?.slug, 'interest');
    assert.ok(rankings.accessiblePrice.every((coffee) => coffee.traceabilityScore >= 40));
  });

  it('does not turn missing or zero clicks into a popularity ranking', () => {
    const unvisited = rankedCoffee('unvisited', { traceability: 100, score: 91, price: 120, clicks: 0 });
    const invalid = rankedCoffee('invalid', { traceability: 80, score: null, price: 120, clicks: Number.NaN });
    const visited = rankedCoffee('visited', { traceability: 30, score: null, price: 120, clicks: 2 });

    assert.deepEqual(rankCoffees([unvisited, invalid]).marketInterest, []);
    assert.deepEqual(rankCoffees([unvisited, invalid, visited]).marketInterest.map((coffee) => coffee.slug), ['visited']);
    assert.equal(rankCoffees([unvisited]).traceability[0]?.slug, 'unvisited');
  });
});

function rankedCoffee(
  slug: string,
  values: { traceability: number; score: number | null; price: number; clicks: number }
) {
  return {
    id: slug,
    slug,
    name: slug,
    name_normalized: slug,
    sca_score: values.score,
    price_per_100g: values.price,
    click_count: values.clicks,
    last_seen_at: '2026-07-13T00:00:00.000Z',
    roasters: { name: 'Test Roaster', slug: 'test-roaster', city: 'Istanbul' },
    coffee_lots: {
      traceability_score: values.traceability,
      validation_status: 'observed' as const,
    },
  } as unknown as CoffeeWithRoaster & {
    coffee_lots: { traceability_score: number; validation_status: 'observed' };
  };
}
