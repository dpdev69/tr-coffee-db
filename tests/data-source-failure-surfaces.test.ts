import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscoveryCatalog } from '../src/components/v2/discovery-catalog';
import CoffeePage from '../src/app/kahve/[slug]/page';
import RoasterPage from '../src/app/kavurucu/[slug]/page';
import RoastersPage from '../src/app/kavurucular/page';
import HomePage from '../src/app/page';
import { getCoffeeDetail, getCatalogCounts, listCatalog, listRoasters } from '../shared/v2/catalog';
import type { CatalogDatabase } from '../shared/v2/database';

// No Workers module/binding exists in this Node test. Exercise actual route error branches.
describe('data-source failure surfaces', () => {
  it('renders a catalog outage without presenting it as an empty result', async () => {
    const html = renderToStaticMarkup(await DiscoveryCatalog({ params: {} }));
    assert.match(html, /role="alert"/); assert.match(html, /Katalog şu an yüklenemiyor/);
    assert.doesNotMatch(html, /Bu filtrelerle kahve bulamadık|Henüz doğrulanmış bir değişiklik yok|0 kahve/);
  });
  it('renders homepage outage without invented counts or zero-result feeds', async () => {
    const html = renderToStaticMarkup(await HomePage());
    assert.match(html, /role="alert"/); assert.match(html, /Kahveler şu an yüklenemiyor/);
    assert.doesNotMatch(html, /satıştaki kahve|satıştaki paket|Henüz doğrulanmış bir değişiklik yok|100\+/);
  });
  it('renders coffee and roaster detail outages rather than throwing a fake 404', async () => {
    const coffee = renderToStaticMarkup(await CoffeePage({ params: Promise.resolve({ slug: 'unavailable' }) }));
    const roaster = renderToStaticMarkup(await RoasterPage({ params: Promise.resolve({ slug: 'unavailable' }) }));
    assert.match(coffee, /role="alert"/); assert.match(coffee, /Kahve bilgileri şu an yüklenemiyor/);
    assert.match(roaster, /role="alert"/); assert.match(roaster, /Kavurucu bilgileri şu an yüklenemiyor/);
    // The successful no-row result still owns the actual 404 path, after the unavailable branch.
    for (const path of ['src/app/kahve/[slug]/page.tsx', 'src/app/kavurucu/[slug]/page.tsx']) {
      const source = readFileSync(path, 'utf8');
      assert.ok(source.indexOf('if (unavailable)') < source.indexOf('notFound();'));
      assert.match(source, /if \(!(coffee|result)\) notFound\(\)/);
    }
  });
  it('renders roaster outage without the successful empty-list message', async () => {
    const html = renderToStaticMarkup(await RoastersPage());
    assert.match(html, /role="alert"/); assert.match(html, /Kavurucular şu an yüklenemiyor/);
    assert.doesNotMatch(html, /Kavurucu listesi henüz oluşmadı|0 kavurucu/);
  });
  it('D1 query failures reject; successful missing details and empty lists remain separate results', async () => {
    const failing: CatalogDatabase = { prepare() { throw new Error('Database unavailable'); }, async batch() { throw new Error('Unexpected write'); } };
    await assert.rejects(getCoffeeDetail(failing, 'coffee'), /Database unavailable/);
    await assert.rejects(listCatalog(failing), /Database unavailable/);
    await assert.rejects(getCatalogCounts(failing), /Database unavailable/);
    await assert.rejects(listRoasters(failing), /Database unavailable/);
    const empty: CatalogDatabase = { prepare() { return { bind() { return this; }, async first() { return null; }, async all() { return { results: [], success: true }; } }; }, async batch() { throw new Error('Unexpected write'); } };
    assert.equal(await getCoffeeDetail(empty, 'missing'), null);
    assert.equal((await listCatalog(empty)).total, 0); assert.deepEqual(await listRoasters(empty), []);
  });
  it('records deferred CEO-review work in the TODO ledger', () => {
    const todos = readFileSync('TODOS.md', 'utf8');
    assert.match(todos, /Extend the Actions scrape summary with catalog freshness counts/);
    assert.match(todos, /Defer bespoke custom-platform adapters/);
    assert.match(todos, /Revisit external data API or partner feed surface/);
  });
});
