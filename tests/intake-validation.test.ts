import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  validateClickPayload,
  validateCorrectionPayload,
  validateJsonRequest,
} from '@/lib/api/intake-validation';

const UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';

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

describe('validateClickPayload', () => {
  it('accepts and normalizes a valid click payload', () => {
    const result = validateClickPayload({
      coffee_id: UUID.toUpperCase(),
      source: 'catalog_card',
      page_path: '/coffees/ethiopia-natural',
      filter_context: {
        origin: ['Ethiopia'],
        search: 'natural',
        singleOrigin: true,
        priceMin: 0,
        priceMax: 5000,
        sort: 'price_desc',
        page: 1000,
        perPage: 100,
      },
      quiz_context: {
        brew: 'filter',
        flavors: ['Fruity', 'Chocolate'],
        adventure: 'classic',
        roast: 'any',
        budget: 'mid',
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.data.coffee_id, UUID);
    assert.equal(result.data.source, 'catalog_card');
    assert.deepEqual(result.data.filter_context?.origin, ['Ethiopia']);
    assert.deepEqual(result.data.quiz_context?.flavors, ['Fruity', 'Chocolate']);
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
        quiz_context: { flavors: ['Fruity', 'Unknown'] },
      }),
      { ok: false, error: 'Invalid flavors' }
    );
  });
});

function makeRequest(headers: Record<string, string>) {
  return new Request('https://tr-coffee-db.vercel.app/api/test', {
    method: 'POST',
    headers,
  });
}

describe('validateCorrectionPayload', () => {
  it('accepts a valid correction and normalizes email and optional ids', () => {
    const result = validateCorrectionPayload({
      issue_type: 'stale_price',
      reporter_email: '  Person@Example.COM ',
      message: 'Price changed.',
      source_path: '/coffees/ethiopia-natural',
      coffee_id: UUID.toUpperCase(),
      roaster_id: '',
    });

    assert.equal(result.ok, true);
    if (!result.ok || result.spam) return;

    assert.equal(result.data.reporter_email, 'person@example.com');
    assert.equal(result.data.coffee_id, UUID);
    assert.equal(result.data.roaster_id, null);
  });

  it('returns spam for honeypot submissions before validating required fields', () => {
    assert.deepEqual(validateCorrectionPayload({ website: 'https://bot.test' }), {
      ok: true,
      spam: true,
    });
  });

  it('rejects invalid correction fields and message boundaries', () => {
    assert.deepEqual(
      validateCorrectionPayload({
        issue_type: 'not_allowed',
        reporter_email: 'person@example.com',
        message: 'Bad type.',
        source_path: '/coffees',
      }),
      { ok: false, error: 'Invalid issue_type' }
    );

    assert.deepEqual(
      validateCorrectionPayload({
        issue_type: 'other',
        reporter_email: 'not-an-email',
        message: 'Bad email.',
        source_path: '/coffees',
      }),
      { ok: false, error: 'Invalid reporter_email' }
    );

    assert.deepEqual(
      validateCorrectionPayload({
        issue_type: 'other',
        reporter_email: 'person@example.com',
        message: 'x'.repeat(2001),
        source_path: '/coffees',
      }),
      { ok: false, error: 'Invalid message' }
    );

    assert.deepEqual(
      validateCorrectionPayload({
        issue_type: 'other',
        reporter_email: 'person@example.com',
        message: 'Bad path.',
        source_path: '/admin',
      }),
      { ok: false, error: 'Invalid source_path' }
    );

    assert.deepEqual(
      validateCorrectionPayload({
        issue_type: 'other',
        reporter_email: 'person@example.com',
        message: 'Bad uuid.',
        source_path: '/coffees',
        roaster_id: OTHER_UUID.replace('4', '9'),
      }),
      { ok: false, error: 'Invalid roaster_id' }
    );
  });
});
