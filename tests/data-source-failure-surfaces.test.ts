import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const catalogPageSource = readFileSync('src/app/coffees/page.tsx', 'utf8');
const coffeeDetailSource = readFileSync('src/app/coffees/[slug]/page.tsx', 'utf8');
const homepageSource = readFileSync('src/app/page.tsx', 'utf8');
const roastersPageSource = readFileSync('src/app/roasters/page.tsx', 'utf8');
const coffeeQueriesSource = readFileSync('src/lib/queries/coffees.ts', 'utf8');
const todosSource = readFileSync('TODOS.md', 'utf8');

describe('data-source failure surfaces', () => {
  it('keeps catalog outages separate from zero-result states', () => {
    assert.match(catalogPageSource, /Katalog geçici olarak yüklenemiyor\./);
    assert.match(catalogPageSource, /Coffee catalog failed to load/);
    assert.match(catalogPageSource, /Bu sıfır sonuç değil/);
  });

  it('does not advertise fallback homepage counts when live stats fail', () => {
    assert.match(homepageSource, /Katalog şu an yüklenemiyor\./);
    assert.match(homepageSource, /!catalogUnavailable && stats.totalCoffees > 0/);
    assert.doesNotMatch(homepageSource, /totalCoffees\s*\|\|\s*['"`]100\+/);
  });

  it('keeps detail query failures from becoming fake 404s', () => {
    assert.match(coffeeDetailSource, /Kahve detayı geçici olarak yüklenemiyor\./);
    assert.match(coffeeDetailSource, /Coffee detail failed to load/);
    assert.match(coffeeQueriesSource, /\.maybeSingle\(\)/);
    assert.match(coffeeQueriesSource, /if \(error\) throw error/);
  });

  it('keeps roaster outages separate from empty roaster states', () => {
    assert.match(roastersPageSource, /Kavurucu listesi geçici olarak yüklenemiyor\./);
    assert.match(roastersPageSource, /Roaster list failed to load/);
    assert.match(roastersPageSource, /Bu sıfır kavurucu olduğu anlamına gelmez/);
  });

  it('records deferred CEO-review work in the TODO ledger', () => {
    assert.match(todosSource, /Extend the Actions scrape summary with catalog freshness counts/);
    assert.match(todosSource, /Defer bespoke custom-platform adapters/);
    assert.match(todosSource, /Revisit external data API or partner feed surface/);
  });
});
