import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveNewEvent, deriveOfferEvents } from '../shared/v2/events';
import type { PriceObservation } from '../shared/v2/types';

const observation = (day: number, overrides: Partial<PriceObservation> = {}): PriceObservation => ({
  id: `p${day}`,offerId: 'offer',crawlRunId: `run${day}`,observedAt: `2026-01-0${day}T00:00:00.000Z`,
  priceMinor: 10000,compareAtMinor: null,weightG: 250,currency: 'TRY',inStock: true,source: 'crawl',...overrides,
});
const events = (current: PriceObservation, history: PriceObservation[], mode: 'live' | 'baseline' | 'import' = 'live') => deriveOfferEvents({ coffeeId: 'coffee',observation: current,history,mode });
test('NEW is deterministic and suppressed on imports and baseline', async () => {
  assert.deepEqual(await deriveNewEvent('c','r','2026-01-01','baseline'), []);
  assert.deepEqual(await deriveNewEvent('c','r','2026-01-01','import'), []);
  const [one] = await deriveNewEvent('c','r','2026-01-01','live');
  const [two] = await deriveNewEvent('c','r2','2026-01-02','live');
  assert.equal(one.id, two.id);
});
test('PRICE_DROP is exact SKU, known weight/currency, historical current price; DEAL requires two baselines and 10%', async () => {
  const baseline = [observation(1),observation(2)];
  assert.deepEqual((await events(observation(3,{priceMinor:9000}),baseline)).map(event => event.type), ['PRICE_DROP','DEAL']);
  assert.deepEqual((await events(observation(3,{priceMinor:9001}),baseline)).map(event => event.type), ['PRICE_DROP']);
  assert.deepEqual((await events(observation(3,{priceMinor:9000}),baseline.slice(0,1))).map(event => event.type), ['PRICE_DROP']);
  for (const override of [{weightG:1000},{weightG:null},{currency:'EUR'},{currency:null},{offerId:'another'},{priceMinor:null},{priceMinor:0}]) {
    assert.deepEqual(await events(observation(3,{priceMinor:9000,...override}),baseline), []);
  }
  assert.deepEqual(await events(observation(3,{compareAtMinor:20000}),baseline), []);
  assert.deepEqual(await events(observation(3,{priceMinor:9000}),[observation(2,{source:'import'})]), []);
  assert.deepEqual(await events(observation(3,{priceMinor:9000}),baseline,'baseline'), []);
});
test('confirmed stock transitions only; unknown never generates restock or out-of-stock', async () => {
  assert.deepEqual((await events(observation(3),[observation(2,{inStock:false})])).map(event => event.type), ['RESTOCKED']);
  assert.deepEqual((await events(observation(3,{inStock:false}),[observation(2)])).map(event => event.type), ['OUT_OF_STOCK']);
  assert.deepEqual(await events(observation(3),[observation(1,{inStock:false}),observation(2,{inStock:null})]), []);
  assert.deepEqual(await events(observation(3,{inStock:null}),[observation(2)]), []);
  assert.deepEqual(await events(observation(3),[observation(2,{offerId:'different',inStock:false})]), []);
});
