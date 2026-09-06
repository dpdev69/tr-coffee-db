import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { parseCoffeeFilters } from '@/lib/coffee-filters';
import { SORT_OPTIONS } from '@/lib/constants/filter-options';
import {
  getCoffees,
  getFeaturedCoffees,
  getSimilarCoffees,
  getStats,
  selectDiverseFeaturedCoffees,
} from '@/lib/queries/coffees';
import type { CoffeeWithRoaster, Database } from '@/lib/types/database';

function queryClient(respond: (url: URL, method: string) => Response) {
  return createClient<Database>('https://catalog.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => respond(new URL(String(input)), init?.method ?? 'GET'),
    },
  });
}

function success(data: unknown = [], count = 0, method = 'GET') {
  return new Response(method === 'HEAD' ? null : JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', 'content-range': `0-0/${count}` },
  });
}

function failure() {
  return new Response(JSON.stringify({ code: '42501', message: 'Catalog query denied' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

describe('catalog queries', () => {
  it('preserves package price sorting and serializes distinct unit-price sorts', async () => {
    for (const [sort, order] of [
      ['price_asc', 'price_amount.asc.nullslast'],
      ['price_desc', 'price_amount.desc.nullslast'],
      ['unit_price_asc', 'price_per_100g.asc.nullslast'],
      ['unit_price_desc', 'price_per_100g.desc.nullslast'],
    ]) {
      const requests: URL[] = [];
      const client = queryClient((url) => {
        requests.push(url);
        return success();
      });

      const filters = parseCoffeeFilters({ sort });
      assert.equal(filters.sort, sort);
      await getCoffees(filters, client);

      assert.equal(requests.length, 1);
      assert.equal(requests[0].searchParams.get('order'), order);
      assert.equal(requests[0].searchParams.get('price_currency'), sort.startsWith('unit_') ? 'eq.TRY' : null);
    }

    assert.equal(SORT_OPTIONS.find((option) => option.value === 'price_asc')?.label, 'Paket fiyatı: Artan');
    assert.equal(SORT_OPTIONS.find((option) => option.value === 'unit_price_asc')?.label, '100 g fiyatı: Artan');
  });

  it('propagates featured and similar-coffee query failures instead of returning empty lists', async () => {
    const client = queryClient(failure);
    const coffee = { id: 'coffee-1', origin_country: 'Kenya', process: 'unknown' } as CoffeeWithRoaster;

    await assert.rejects(getFeaturedCoffees(4, client), { code: '42501', message: 'Catalog query denied' });
    await assert.rejects(getSimilarCoffees(coffee, 4, client), { code: '42501', message: 'Catalog query denied' });
  });

  it('propagates any failed statistics query rather than displaying partial counts', async () => {
    for (const failedField of ['id', 'roaster_id', 'origin_country']) {
      const requests: string[] = [];
      const client = queryClient((url, method) => {
        const field = url.searchParams.get('select') ?? '';
        requests.push(field);
        return field === failedField ? failure() : success([], 0, method);
      });

      await assert.rejects(getStats(client));
      assert.deepEqual(requests.sort(), ['id', 'origin_country', 'roaster_id']);
    }
  });

  it('retains real empty results and distinct counts when queries succeed', async () => {
    const client = queryClient((url, method) => {
      switch (url.searchParams.get('select')) {
        case 'id': return success([], 3, method);
        case 'roaster_id': return success([{ roaster_id: 'a' }, { roaster_id: 'a' }, { roaster_id: 'b' }]);
        case 'origin_country': return success([{ origin_country: 'Kenya' }, { origin_country: 'Kenya' }]);
        default: return success();
      }
    });

    assert.deepEqual(await getStats(client), { totalCoffees: 3, totalRoasters: 2, totalOrigins: 1 });
    assert.deepEqual(await getFeaturedCoffees(4, client), []);
  });

  it('selects varied roasters from a bounded, deterministic current candidate query', async () => {
    const candidates = [
      { id: 'a-newest', roaster_id: 'a' },
      { id: 'a-next', roaster_id: 'a' },
      { id: 'b-newest', roaster_id: 'b' },
    ];

    for (const [limit, candidateLimit] of [[2, 20], [12, 100]]) {
      const requests: URL[] = [];
      const client = queryClient((url) => {
        requests.push(url);
        return success(candidates);
      });

      const coffees = await getFeaturedCoffees(limit, client);
      assert.deepEqual(coffees.map((coffee) => coffee.id), limit === 2
        ? ['a-newest', 'b-newest']
        : ['a-newest', 'b-newest', 'a-next']);
      assert.equal(requests.length, 1);
      const params = requests[0].searchParams;
      assert.equal(params.get('limit'), String(candidateLimit));
      assert.equal(params.get('order'), 'created_at.desc,id.asc');
      assert.equal(params.get('is_public'), 'eq.true');
      assert.equal(params.get('specialty_status'), 'eq.specialty');
      assert.equal(params.get('is_available'), 'eq.true');
      assert.match(params.get('last_seen_at') ?? '', /^gte\./);
      assert.equal(params.get('image_url'), 'not.is.null');
    }
  });

  it('does not query for a zero or invalid feature limit', async () => {
    const client = queryClient(() => {
      assert.fail('An empty feature request should not query the catalog');
    });

    for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(await getFeaturedCoffees(limit, client), []);
    }
  });
});

describe('featured coffee selection', () => {
  const candidates = [
    { id: 'a-newest', roaster_id: 'a' },
    { id: 'a-second', roaster_id: 'a' },
    { id: 'a-third', roaster_id: 'a' },
    { id: 'b-newest', roaster_id: 'b' },
    { id: 'c-newest', roaster_id: 'c' },
    { id: 'b-second', roaster_id: 'b' },
  ];

  it('prioritizes the newest coffee from each roaster before repeat roasters', () => {
    assert.deepEqual(selectDiverseFeaturedCoffees(candidates, 4).map((coffee) => coffee.id), [
      'a-newest', 'b-newest', 'c-newest', 'a-second',
    ]);
    assert.deepEqual(selectDiverseFeaturedCoffees(candidates, 2).map((coffee) => coffee.id), [
      'a-newest', 'b-newest',
    ]);
  });

  it('fills remaining slots in recency order when distinct roasters are insufficient', () => {
    assert.deepEqual(selectDiverseFeaturedCoffees(candidates, 6).map((coffee) => coffee.id), [
      'a-newest', 'b-newest', 'c-newest', 'a-second', 'a-third', 'b-second',
    ]);
    assert.deepEqual(selectDiverseFeaturedCoffees(candidates.slice(0, 3), 4), candidates.slice(0, 3));
  });

  it('keeps unique products, respects result limits, and leaves input unchanged', () => {
    const input = [candidates[0], candidates[0], candidates[1], candidates[3]];
    const original = [...input];

    assert.deepEqual(selectDiverseFeaturedCoffees(input, 10).map((coffee) => coffee.id), [
      'a-newest', 'b-newest', 'a-second',
    ]);
    assert.equal(selectDiverseFeaturedCoffees(input, 2.9).length, 2);
    assert.deepEqual(selectDiverseFeaturedCoffees(input, 0), []);
    assert.deepEqual(selectDiverseFeaturedCoffees([], 4), []);
    assert.deepEqual(input, original);
  });
});
