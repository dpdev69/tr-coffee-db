import { stableId } from './identity';
import type { CoffeeEvent, Json, PriceObservation } from './types';

export const EVENT_RULE_VERSION = 'v2.1';
export const VERIFIED_DEAL_MIN_DROP_PERCENT = 10;
export const VERIFIED_DEAL_BASELINE_OBSERVATIONS = 2;

function comparable(left: PriceObservation, right: PriceObservation): boolean {
  return left.offerId === right.offerId && left.weightG !== null && left.weightG === right.weightG &&
    left.currency !== null && left.currency === right.currency && left.source === 'crawl' && right.source === 'crawl';
}
export async function deriveOfferEvents(input: {
  coffeeId: string; observation: PriceObservation; history: PriceObservation[]; mode: 'live' | 'baseline' | 'import';
}): Promise<CoffeeEvent[]> {
  if (input.mode !== 'live') return [];
  const current = input.observation;
  const history = input.history.filter(item => item.offerId === current.offerId && item.observedAt < current.observedAt)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const previous = history[0];
  if (!previous || current.source !== 'crawl' || previous.source !== 'crawl') return [];
  const events: CoffeeEvent[] = [];
  const emit = async (type: CoffeeEvent['type'], before: Json, after: Json) => {
    const key = `${EVENT_RULE_VERSION}:${type}:${current.id}`;
    events.push({ id: await stableId('event', key), coffeeId: input.coffeeId, offerId: current.offerId, type,
      createdAt: current.observedAt, before, after, idempotencyKey: key, observationId: current.id });
  };
  // The immediately previous stock observation must be explicit: unknown never becomes a restock.
  if (previous.inStock === false && current.inStock === true) {
    await emit('RESTOCKED', { inStock: false, observationId: previous.id }, { inStock: true, observationId: current.id });
  }
  if (previous.inStock === true && current.inStock === false) {
    await emit('OUT_OF_STOCK', { inStock: true, observationId: previous.id }, { inStock: false, observationId: current.id });
  }
  if (comparable(previous, current) && previous.priceMinor !== null && current.priceMinor !== null && current.priceMinor > 0 && current.priceMinor < previous.priceMinor) {
    const before = { priceMinor: previous.priceMinor, currency: previous.currency, weightG: previous.weightG, observationId: previous.id };
    const after = { priceMinor: current.priceMinor, currency: current.currency, weightG: current.weightG, observationId: current.id };
    await emit('PRICE_DROP', before, after);
    const baseline = history.slice(0, VERIFIED_DEAL_BASELINE_OBSERVATIONS);
    if (current.inStock === true && baseline.length >= VERIFIED_DEAL_BASELINE_OBSERVATIONS &&
      baseline.every(item => comparable(item, current) && item.priceMinor === previous.priceMinor) &&
      current.priceMinor * 100 <= previous.priceMinor * (100 - VERIFIED_DEAL_MIN_DROP_PERCENT)) {
      await emit('DEAL', { ...before, baselineObservationIds: baseline.map(item => item.id) }, { ...after, kind: 'VERIFIED_DEAL', ruleVersion: EVENT_RULE_VERSION });
    }
  }
  // Compare-at is retained as a roaster claim. It never creates DEAL without our own baseline.
  return events;
}

export async function deriveNewEvent(coffeeId: string, runId: string, observedAt: string, mode: 'live' | 'baseline' | 'import'): Promise<CoffeeEvent[]> {
  if (mode !== 'live') return [];
  const key = `${EVENT_RULE_VERSION}:NEW:${coffeeId}`;
  return [{ id: await stableId('event', key), coffeeId, offerId: null, type: 'NEW', createdAt: observedAt,
    before: null, after: { firstObservationRunId: runId }, idempotencyKey: key, observationId: null }];
}
