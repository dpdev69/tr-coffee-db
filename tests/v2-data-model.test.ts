import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { canonicalizeUrl, offerIdentity, productIdentity, stableId, toMinorUnits, unitPriceTry, validWeight } from '../shared/v2/identity';

test('canonical identity preserves SKU parameters and removes only tracking', async () => {
  assert.equal(canonicalizeUrl('https://shop.test/cup/?utm_source=xx&variant=13#top'), 'https://shop.test/cup?variant=13');
  assert.throws(() => canonicalizeUrl('https://evil.test/a', ['shop.test']));
  assert.throws(() => canonicalizeUrl('javascript:alert(1)'));
  assert.throws(() => canonicalizeUrl('https://user:password@shop.test'));
  assert.equal(productIdentity({ sourceProductId: '123', canonicalUrl: 'https://shop.test/new-name' }), 'source:123');
  assert.equal(await stableId('coffee', 'a|b', 'c'), await stableId('coffee', 'a|b', 'c'));
  assert.notEqual(await stableId('coffee', 'a|b', 'c'), await stableId('coffee', 'a', 'b|c'));
  assert.notEqual(offerIdentity({ sourceVariantId: '1' } as never), offerIdentity({ sourceVariantId: '2' } as never));
});
test('unit prices require trustworthy weight, price and TRY currency', () => {
  assert.equal(toMinorUnits(599.90), 59990);
  assert.equal(unitPriceTry(59990, 250, 'TRY'), 239.96);
  assert.equal(unitPriceTry(59990, null, 'TRY'), null);
  assert.equal(unitPriceTry(59990, 250, 'EUR'), null);
  assert.equal(unitPriceTry(59990, 0, 'TRY'), null);
  assert.throws(() => validWeight(-1));
  assert.throws(() => toMinorUnits(Number.NaN));
});
test('SQLite schema enforces identities and immutable historical observations', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/d1/0001_catalog.sql', import.meta.url), 'utf8'));
  db.exec(`INSERT INTO roasters(id,slug,name,website_url,adapter,trusted_hosts_json,created_at,updated_at) VALUES('r','r','R','https://shop.test','test','[]','2026-01-01','2026-01-01');
    INSERT INTO coffees(id,roaster_id,identity_key,canonical_url,name,slug,raw_metadata_json,visibility,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c','r','source:c','https://shop.test/c','C','c','{}','public','2026-01-01','2026-01-01','2026-01-01','2026-01-01');
    INSERT INTO offers(id,coffee_id,identity_key,purchase_url,in_stock,first_seen_at,last_seen_at,created_at,updated_at) VALUES('o','c','source:o','https://shop.test/c',1,'2026-01-01','2026-01-01','2026-01-01','2026-01-01');
    INSERT INTO crawl_runs(id,roaster_id,started_at,status,mode,parser_version,created_at) VALUES('run','r','2026-01-01','success','baseline','test','2026-01-01');
    INSERT INTO price_observations(id,offer_id,crawl_run_id,observed_at,source) VALUES('p','o','run','2026-01-01','crawl');`);
  assert.throws(() => db.exec("UPDATE price_observations SET price_minor=1 WHERE id='p'"), /immutable/);
  assert.throws(() => db.exec("DELETE FROM price_observations WHERE id='p'"), /immutable/);
  assert.throws(() => db.exec("INSERT INTO price_observations(id,offer_id,crawl_run_id,observed_at,source) VALUES('p2','o','run','2026-01-01','crawl')"), /UNIQUE/);
  assert.throws(() => db.exec("UPDATE offers SET weight_g=0 WHERE id='o'"), /CHECK/);
  assert.deepEqual({ ...db.prepare('SELECT * FROM catalog_counts').get() }, { coffees: 1, roasters: 1, offers: 1 });
  assert.match(JSON.stringify(db.prepare("EXPLAIN QUERY PLAN SELECT * FROM price_observations WHERE offer_id='o' ORDER BY observed_at DESC").all()), /observations_offer_time/);
  db.close();
});
