import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

type QueryCall =
  | { method: 'eq'; column: string; value: boolean }
  | { method: 'eq'; column: string; value: string }
  | { method: 'gte'; column: string; value: string };

type PublicVisibilityModule = {
  PUBLIC_COFFEE_VISIBILITY: {
    isPublicColumn: 'is_public';
    specialtyStatusColumn?: 'specialty_status';
    isAvailableColumn: 'is_available';
    freshnessColumn: 'last_seen_at';
  };
  isPublicCoffee: (coffee: { is_public?: boolean | null; specialty_status?: string | null }) => boolean;
  applyPublicCoffeeVisibility: <T extends RecordingQuery>(query: T, currentCutoff?: string) => T;
};

describe('public coffee visibility rule', () => {
  it('applies the shared fail-closed public query gate', async () => {
    const { applyPublicCoffeeVisibility, PUBLIC_COFFEE_VISIBILITY } =
      await loadPublicVisibilityModule();
    const query = new RecordingQuery();

    const returned = applyPublicCoffeeVisibility(query, '2026-05-01T00:00:00.000Z');

    assert.equal(returned, query);
    assert.equal(PUBLIC_COFFEE_VISIBILITY.isPublicColumn, 'is_public');
    assert.equal(PUBLIC_COFFEE_VISIBILITY.isAvailableColumn, 'is_available');
    assert.equal(PUBLIC_COFFEE_VISIBILITY.freshnessColumn, 'last_seen_at');
    assert.deepEqual(query.calls, [
      { method: 'eq', column: 'is_public', value: true },
      { method: 'eq', column: 'specialty_status', value: 'specialty' },
      { method: 'eq', column: 'is_available', value: true },
      { method: 'gte', column: 'last_seen_at', value: '2026-05-01T00:00:00.000Z' },
    ]);
  });

  it('classifies public rows from is_public plus specialty status only', async () => {
    const { isPublicCoffee } = await loadPublicVisibilityModule();

    assert.equal(isPublicCoffee({ is_public: true, specialty_status: 'specialty' }), true);
    assert.equal(isPublicCoffee({ is_public: true, specialty_status: 'unclassified' }), false);
    assert.equal(isPublicCoffee({ is_public: true, specialty_status: 'not_specialty' }), false);
    assert.equal(isPublicCoffee({ is_public: false, specialty_status: 'specialty' }), false);
  });

  it('migration defaults keep unclassified and not-specialty rows non-public until explicitly classified', () => {
    const migration = readMigration015();

    assert.match(migration, /specialty_status TEXT NOT NULL DEFAULT 'unclassified'/);
    assert.match(migration, /is_public BOOLEAN NOT NULL DEFAULT false/);
    assert.match(
      migration,
      /CHECK \(specialty_status IN \('unclassified', 'specialty', 'not_specialty'\)\)/
    );
    assert.match(migration, /support_tier TEXT NOT NULL DEFAULT 'unverified'/);
    assert.match(
      migration,
      /CHECK \(support_tier IN \('unverified', 'supported', 'priority', 'excluded'\)\)/
    );
  });

  it('migration stores manual overrides by roaster and external product id', () => {
    const migration = readMigration015();

    assert.match(migration, /CREATE TABLE IF NOT EXISTS coffee_specialty_overrides/);
    assert.match(migration, /roaster_id UUID NOT NULL REFERENCES roasters\(id\) ON DELETE CASCADE/);
    assert.match(migration, /external_id TEXT NOT NULL/);
    assert.match(migration, /UNIQUE \(roaster_id, external_id\)/);
    assert.match(migration, /CHECK \(override_action IN \('force_include', 'force_exclude'\)\)/);
  });
});

async function loadPublicVisibilityModule(): Promise<PublicVisibilityModule> {
  const mod = await import('../src/lib/public-coffee-visibility.ts');
  assert.equal(typeof mod.applyPublicCoffeeVisibility, 'function');
  assert.equal(typeof mod.isPublicCoffee, 'function');
  assert.ok(mod.PUBLIC_COFFEE_VISIBILITY);
  return mod as PublicVisibilityModule;
}

function readMigration015() {
  return readFileSyncFromTest('../supabase/migrations/015_add_specialty_visibility_controls.sql');
}

function readFileSyncFromTest(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

class RecordingQuery {
  readonly calls: QueryCall[] = [];

  eq(column: string, value: boolean | string) {
    this.calls.push({ method: 'eq', column, value });
    return this;
  }

  gte(column: string, value: string) {
    this.calls.push({ method: 'gte', column, value });
    return this;
  }
}
