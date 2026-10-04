import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleSubscribe, sanitizeSubscribeReferrer, subscribeResponse, SUBSCRIBE_MESSAGE, type SubscribeEnvironment } from '../src/lib/v2-subscribe';

const origin = 'https://kahvedrop.test';
const fakeKey = 'test-key-only-not-a-real-credential';
const email = 'Reader+coffee@example.test';
function request(body: unknown = { email, website: '', source: 'home-hero', referrer: `${origin}/?utm_source=community` }, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/subscribe`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.4', ...headers }, body: JSON.stringify(body) });
}
function environment(success = true): SubscribeEnvironment {
  return { KIT_API_KEY: fakeKey, KIT_FORM_ID: '9918321', SUBSCRIBE_LIMITER: { limit: async () => ({ success }) } };
}
function provider(state = 'inactive', status = 201) {
  const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    const address = String(url); calls.push({ url: address, init: init!, body: JSON.parse(String(init!.body)) });
    return Response.json({ subscriber: { id: 735, state, first_name: 'Preserved name', email_address: email } }, { status: address.endsWith('/subscribers') ? status : 200 });
  };
  return { calls, fetcher };
}
test('new signup creates inactive subscriber without first_name and attaches to the confirmation form', async () => {
  const kit = provider(); const buckets: string[] = [];
  const env = environment(); env.SUBSCRIBE_LIMITER = { limit: async ({ key }) => { buckets.push(key); return { success: true }; } };
  const result = await handleSubscribe(request(), env, { fetch: kit.fetcher });
  assert.equal(result.status, 200); assert.equal(result.outcome, 'accepted');
  assert.deepEqual(result.body, { ok: true, message: SUBSCRIBE_MESSAGE });
  assert.deepEqual(kit.calls[0].body, { email_address: email, state: 'inactive' });
  assert.equal(kit.calls[0].url, 'https://api.kit.com/v4/subscribers');
  assert.equal(kit.calls[1].url, 'https://api.kit.com/v4/forms/9918321/subscribers/735');
  assert.deepEqual(kit.calls[1].body, { referrer: `${origin}/?utm_source=community&utm_content=home-hero` });
  for (const call of kit.calls) {
    assert.equal(call.init.redirect, 'manual'); assert.equal(call.init.method, 'POST');
    assert.equal(new Headers(call.init.headers).get('X-Kit-Api-Key'), fakeKey);
    assert(call.init.signal instanceof AbortSignal);
  }
  assert.deepEqual(buckets, ['subscribe:192.0.2.4']);
  const publicResponse = subscribeResponse(result);
  assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
  const responseBody = await publicResponse.text();
  assert.doesNotMatch(responseBody, /Reader|example\.test|test-key|735|outcome|inactive|accepted/);
});
test('existing active/inactive and repeated submissions preserve provider state, names and idempotent association', async () => {
  for (const state of ['active', 'inactive']) {
    const kit = provider(state, 200);
    for (let attempt = 0; attempt < 2; attempt++) assert.equal((await handleSubscribe(request(), environment(), { fetch: kit.fetcher })).status, 200);
    assert.equal(kit.calls.length, 4);
    assert.deepEqual(kit.calls[0].body, kit.calls[2].body);
    assert.deepEqual(kit.calls[1].body, kit.calls[3].body);
    assert(!kit.calls.some(call => 'first_name' in call.body));
    assert(!kit.calls.some(call => call.body.state === 'active'));
  }
});
test('documented 202 create response is validated then attached, and diagnostics never enter public responses', async () => {
  const kit = provider('inactive', 202);
  assert.equal((await handleSubscribe(request(), environment(), { fetch: kit.fetcher })).status, 200);
  assert.equal(kit.calls.length, 2);
  const broken: typeof fetch = async () => new Response(email + fakeKey, { status: 422 });
  const result = await handleSubscribe(request(), environment(), { fetch: broken });
  assert.deepEqual(result.diagnostic, { stage: 'create_subscriber', status: 422, errorClass: 'http' });
  const publicBody = await subscribeResponse(result).text();
  for (const privateValue of [email, fakeKey, 'diagnostic', '422', 'create_subscriber']) assert(!publicBody.includes(privateValue));
  let called = 0;
  const missingSubscriber: typeof fetch = async () => { called++; return Response.json({ accepted: true }, { status: 202 }); };
  const pending = await handleSubscribe(request(), environment(), { fetch: missingSubscriber });
  assert.equal(pending.status, 502); assert.equal(called, 1);
  assert.deepEqual(pending.diagnostic, { stage: 'create_subscriber', status: 202, errorClass: 'invalid_subscriber' });
});
test('Worker-compatible manual redirects never follow another host or advance to association', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    const redirects: typeof fetch = async (_url, init) => {
      calls++;
      if (init?.redirect === 'error') throw new TypeError('Unsupported Workers redirect mode');
      assert.equal(init?.redirect, 'manual');
      return new Response(null, { status, headers: { Location: 'https://untrusted.example/steal' } });
    };
    const result = await handleSubscribe(request(), environment(), { fetch: redirects });
    assert.equal(result.status, 502); assert.equal(calls, 1);
    assert.deepEqual(result.diagnostic, { stage: 'create_subscriber', status, errorClass: 'http' });
  }
});
test('cancelled, bounced and complained addresses are not attached or reactivated and receive the same response', async () => {
  for (const state of ['cancelled', 'bounced', 'complained']) {
    const kit = provider(state, 200);
    const result = await handleSubscribe(request(), environment(), { fetch: kit.fetcher });
    assert.equal(result.outcome, 'suppressed'); assert.equal(kit.calls.length, 1);
    assert.deepEqual(result.body, { ok: true, message: SUBSCRIBE_MESSAGE });
    assert.deepEqual(kit.calls[0].body, { email_address: email, state: 'inactive' });
  }
});
test('invalid JSON, content type, origin, emails and streaming byte limits fail before provider calls', async () => {
  const kit = provider(); const requests = [
    request({}, { origin: 'https://evil.test' }), request({}, { origin: 'null' }), request({}, { origin: '' }),
    request({}, { 'sec-fetch-site': 'cross-site' }), request({}, { 'content-type': 'text/plain' }),
    request({ email: 'not-an-email' }), request({ email: 'x..y@example.test' }), request({ email: 'x@-bad.test' }),
    request({ email: 'a'.repeat(65) + '@example.test' }), request({ email: '\r\nName@example.test\r\nfoo' }),
    request([]), request(null), request({ email, ignored: 'a'.repeat(4100) }), request({ email }, { 'content-length': '5000' }),
    new Request(`${origin}/api/subscribe`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{ broken' }),
    // Actual bytes exceed 4096 although UTF-16 string character count is lower.
    request({ email, ignored: 'ş'.repeat(2100) }),
  ];
  for (const input of requests) assert.equal((await handleSubscribe(input, environment(), { fetch: kit.fetcher })).status, 400);
  assert.equal(kit.calls.length, 0);
});
test('honeypot uses generic success and rate limits use only ephemeral IP, with failure closed', async () => {
  const kit = provider();
  const trapped = await handleSubscribe(request({ email, website: 'spam' }), environment(), { fetch: kit.fetcher });
  assert.equal(trapped.outcome, 'honeypot'); assert.deepEqual(trapped.body, { ok: true, message: SUBSCRIBE_MESSAGE });
  const limited = await handleSubscribe(request(), environment(false), { fetch: kit.fetcher });
  assert.equal(limited.status, 429); assert.equal(subscribeResponse(limited).headers.get('retry-after'), '60');
  for (const env of [{}, { ...environment(), KIT_API_KEY: '' }, { ...environment(), KIT_FORM_ID: '../1' }, { ...environment(), SUBSCRIBE_LIMITER: undefined },
    { ...environment(), SUBSCRIBE_LIMITER: { limit: async () => { throw new Error(email + fakeKey); } } }]) {
    const result = await handleSubscribe(request(), env, { fetch: kit.fetcher }); assert.equal(result.status, 503);
    assert(!JSON.stringify(result).includes(email)); assert(!JSON.stringify(result).includes(fakeKey));
  }
  assert.equal(kit.calls.length, 0);
});
test('referrers retain only safe same-origin routes and bounded campaign parameters', async () => {
  const endpoint = `${origin}/api/subscribe`;
  assert.equal(sanitizeSubscribeReferrer(`${origin}/kahve/ethiopia-a1?utm_source=forum&utm_campaign=September_2026&utm_medium=email&utm_content=Reader%40example.test&utm_term=${'x'.repeat(81)}&email=Reader@example.test&token=secret#Reader@example.test`, endpoint, 'detail'),
    `${origin}/kahve/ethiopia-a1?utm_source=forum&utm_medium=email&utm_campaign=September_2026&utm_content=detail`);
  for (const unsafe of ['https://evil.test/steal?utm_source=x', 'javascript:alert(1)', `${origin}/api/private?utm_source=x`, `${origin}/kahve/Reader%40example.test`, `https://Reader:secret@kahvedrop.test/`, '//evil.test/path']) {
    assert.equal(sanitizeSubscribeReferrer(unsafe, endpoint, 'catalog'), `${origin}/?utm_content=catalog`);
  }
  assert.equal(sanitizeSubscribeReferrer(`${origin}/?utm_source=Reader%2540example.test&utm_campaign=%3Cscript%3E`, endpoint, 'Reader@example.test'), `${origin}/`);
});
test('provider HTTP errors, malformed state/id, network failure and timeout have safe generic errors', async () => {
  const cases: Array<typeof fetch> = [
    async () => new Response(email + fakeKey, { status: 401 }),
    async () => new Response(email + fakeKey, { status: 429 }),
    async () => new Response(email + fakeKey, { status: 500 }),
    async () => new Response('bad json ' + email),
    async () => Response.json({ subscriber: { id: '735/steal', state: 'inactive' } }),
    async () => Response.json({ subscriber: { id: 735, state: 'unknown' } }),
    async () => { throw new Error(email + fakeKey); },
    async (_url, init) => new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(new Error(email + fakeKey)), { once: true }); }),
  ];
  for (const fetcher of cases) {
    const result = await handleSubscribe(request(), environment(), { fetch: fetcher, timeoutMs: 10 });
    assert.equal(result.status, 502); const body = await subscribeResponse(result).text();
    assert(!body.includes(email)); assert(!body.includes(fakeKey)); assert(!body.includes('subscriber'));
  }
  let calls = 0;
  const associationFails: typeof fetch = async () => ++calls === 1 ? Response.json({ subscriber: { id: 735, state: 'inactive' } }) : new Response(email, { status: 500 });
  assert.equal((await handleSubscribe(request(), environment(), { fetch: associationFails })).status, 502);
  assert.equal(calls, 2);
});

test('newsletter success telemetry is accepted-request only, allowlisted and cannot break signup', async () => {
  const events: unknown[] = [];
  const env = { ...environment(), ANALYTICS: { writeDataPoint: (point: unknown) => { events.push(point); } } };
  const kit = provider();
  const result = await handleSubscribe(request({ email, website: '', source: 'detail', referrer: `${origin}/kahve/a?email=${email}&utm_campaign=September` }), env, { fetch: kit.fetcher });
  assert.equal(result.status, 200); assert.equal(events.length, 1);
  const encoded = JSON.stringify(events);
  assert.match(encoded, /newsletter_signup_success/); assert.match(encoded, /coffee/); assert.match(encoded, /detail/);
  for (const privateValue of [email, fakeKey, 'September', 'referrer', '735', 'inactive']) assert(!encoded.includes(privateValue));
  // Every accepted request is counted; this is not a confirmed or unique-subscriber metric.
  await handleSubscribe(request({ email, source: 'attacker@evil.test' }), env, { fetch: kit.fetcher });
  assert.equal(events.length, 2); assert(!JSON.stringify(events).includes('attacker'));
  for (const state of ['cancelled', 'bounced', 'complained']) await handleSubscribe(request(), env, { fetch: provider(state).fetcher });
  await handleSubscribe(request({ email, website: 'spam' }), env, { fetch: kit.fetcher });
  await handleSubscribe(request(), env, { fetch: async () => new Response(null, { status: 503 }) });
  assert.equal(events.length, 2);
  const broken = { ...environment(), ANALYTICS: { writeDataPoint: () => { throw new Error('analytics unavailable'); } } };
  assert.equal((await handleSubscribe(request(), broken, { fetch: kit.fetcher })).status, 200);
});
