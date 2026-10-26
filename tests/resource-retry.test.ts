import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutOff, withRetry } from '../workers/resource-retry';

const page = new Request('https://kahve.hellobasalt.dev/kavurucu/molecule');
const bare = () => new Response(null, { status: 503 });

describe('CPU cut-off retry (workers/resource-retry.ts)', () => {
  it('treats only a bare 503 to a GET or HEAD as cut off', () => {
    assert.equal(cutOff(page, bare()), true);
    assert.equal(cutOff(new Request(page, { method: 'HEAD' }), bare()), true);
    assert.equal(cutOff(new Request(page, { method: 'POST', body: '{}' }), bare()), false);
    assert.equal(cutOff(page, new Response('x', { status: 503, headers: { 'Retry-After': '60' } })), false, 'the read brake');
    assert.equal(cutOff(page, Response.json({ error: 'x' }, { status: 503 })), false, 'an API route that cannot read D1');
    assert.equal(cutOff(page, new Response(null, { status: 500 })), false);
  });

  it('asks once more after a cut-off and never a third time', async () => {
    let calls = 0;
    const ok = await withRetry(page, async () => (++calls === 1 ? bare() : new Response('ok')));
    assert.equal(calls, 2); assert.equal(ok.status, 200);
    calls = 0;
    assert.equal((await withRetry(page, async () => { calls++; return bare(); })).status, 503);
    assert.equal(calls, 2);
    calls = 0;
    assert.equal((await withRetry(page, async () => { calls++; return new Response('ok'); })).status, 200);
    assert.equal(calls, 1);
  });
});
