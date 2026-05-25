import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseLimitedJsonBody,
  validateClickPayload,
  validateJsonRequest,
} from '@/lib/api/intake-validation';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('validateJsonRequest', () => {
  it('accepts same-origin JSON requests within the size limit', () => {
    const request = makeRequest({
      'content-type': 'application/json; charset=utf-8',
      'content-length': '128',
      host: 'tr-coffee-db.vercel.app',
      origin: 'https://tr-coffee-db.vercel.app',
    });

    assert.deepEqual(validateJsonRequest(request, 1024), { ok: true });
  });

  it('rejects cross-origin, non-json, and oversized requests', () => {
    assert.deepEqual(
      validateJsonRequest(
        makeRequest({
          'content-type': 'application/json',
          host: 'tr-coffee-db.vercel.app',
          origin: 'https://evil.example',
        }),
        1024
      ),
      { ok: false, error: 'Invalid request origin', status: 403 }
    );

    assert.deepEqual(
      validateJsonRequest(
        makeRequest({
          'content-type': 'application/json',
          host: 'tr-coffee-db.vercel.app',
        }),
        1024
      ),
      { ok: false, error: 'Missing request origin', status: 403 }
    );

    assert.deepEqual(
      validateJsonRequest(makeRequest({ 'content-type': 'text/plain' }), 1024),
      { ok: false, error: 'Invalid content type', status: 415 }
    );

    assert.deepEqual(
      validateJsonRequest(
        makeRequest({ 'content-type': 'application/json', 'content-length': '1025' }),
        1024
      ),
      { ok: false, error: 'Request body too large', status: 413 }
    );
  });
});

describe('parseLimitedJsonBody', () => {
  it('rejects oversized bodies even when content-length is absent', async () => {
    const request = new Request('https://tr-coffee-db.vercel.app/api/click', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ value: 'x'.repeat(32) }),
    });

    const result = await parseLimitedJsonBody(request, 16);

    assert.deepEqual(result, {
      ok: false,
      error: 'Request body too large',
      status: 413,
    });
  });

  it('parses valid JSON bodies inside the byte limit', async () => {
    const request = new Request('https://tr-coffee-db.vercel.app/api/click', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ok: true }),
    });

    const result = await parseLimitedJsonBody(request, 64);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.data, { ok: true });
  });
});

describe('validateClickPayload', () => {
  it('accepts and normalizes a valid click payload', () => {
    const result = validateClickPayload({
      coffee_id: UUID.toUpperCase(),
      source: 'catalog_card',
      page_path: '/coffees/ethiopia-natural',
      filter_context: {
        origin: ['Ethiopia'],
        process: ['washed'],
        roastLevel: ['medium'],
        flavorCategory: ['Fruity'],
        brewMethod: ['filter'],
        search: 'natural',
        singleOrigin: true,
        sort: 'price_desc',
        page: 1000,
        perPage: 100,
      },
      quiz_context: {
        brewMethod: ['filter'],
        flavorCategory: ['Fruity', 'Chocolate'],
        process: ['washed'],
        roastLevel: ['medium_light', 'medium'],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.data.coffee_id, UUID);
    assert.equal(result.data.source, 'catalog_card');
    assert.deepEqual(result.data.filter_context?.origin, ['Ethiopia']);
    assert.deepEqual(result.data.filter_context?.process, ['washed']);
    assert.deepEqual(result.data.quiz_context?.flavorCategory, ['Fruity', 'Chocolate']);
    assert.deepEqual(result.data.quiz_context?.roastLevel, ['medium_light', 'medium']);
  });

  it('rejects invalid source, path, and context boundaries', () => {
    assert.deepEqual(
      validateClickPayload({ coffee_id: UUID, source: 'ad', page_path: '/coffees' }),
      { ok: false, error: 'Invalid source' }
    );

    assert.deepEqual(
      validateClickPayload({ coffee_id: UUID, source: 'catalog_card', page_path: '//evil.test' }),
      { ok: false, error: 'Invalid page_path' }
    );

    assert.deepEqual(
      validateClickPayload({
        coffee_id: UUID,
        source: 'catalog_card',
        page_path: '/coffees',
        filter_context: { page: 1001 },
      }),
      { ok: false, error: 'Invalid page' }
    );

    assert.deepEqual(
      validateClickPayload({
        coffee_id: UUID,
        source: 'catalog_card',
        page_path: '/coffees',
        quiz_context: { flavorCategory: ['Fruity', 'Unknown'] },
      }),
      { ok: false, error: 'Invalid flavorCategory' }
    );

    assert.deepEqual(
      validateClickPayload({
        coffee_id: UUID,
        source: 'catalog_card',
        page_path: '/coffees',
        filter_context: { priceMin: 100 },
      }),
      { ok: false, error: 'Unsupported filter_context field: priceMin' }
    );

    assert.deepEqual(
      validateClickPayload({
        coffee_id: UUID,
        source: 'catalog_card',
        page_path: '/coffees',
        filter_context: { process: ['unknown-process'] },
      }),
      { ok: false, error: 'Invalid process' }
    );
  });
});

function makeRequest(headers: Record<string, string>) {
  return new Request('https://tr-coffee-db.vercel.app/api/test', {
    method: 'POST',
    headers,
  });
}
