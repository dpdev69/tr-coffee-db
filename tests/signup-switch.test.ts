import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signupsEnabled } from '../src/lib/signups';
import { handleSubscribe, subscribeResponse, type SubscribeEnvironment } from '../src/lib/v2-subscribe';
import { Footer } from '../src/components/layout/footer';
import ThankYouPage from '../src/app/tesekkurler/page';
import IssueIndexPage from '../src/app/bulten/page';
import PrivacyPage from '../src/app/privacy/page';
import SavedPage from '../src/app/listem/page';

const origin = 'https://kahvedrop.test';
const original = process.env.SIGNUPS_ENABLED;
afterEach(() => { if (original === undefined) delete process.env.SIGNUPS_ENABLED; else process.env.SIGNUPS_ENABLED = original; });
const withSwitch = (value: string | undefined) => { if (value === undefined) delete process.env.SIGNUPS_ENABLED; else process.env.SIGNUPS_ENABLED = value; };

test('the switch is off unless it is exactly "true"', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) { withSwitch(value); assert.equal(signupsEnabled(), false, String(value)); }
  withSwitch('true'); assert.equal(signupsEnabled(), true);
  assert.equal(signupsEnabled({}), false); assert.equal(signupsEnabled({ SIGNUPS_ENABLED: 'true' }), true);
  // An explicit Worker env wins over the process environment.
  assert.equal(signupsEnabled({ SIGNUPS_ENABLED: 'false' }), false);
});

test('every place that renders the signup form is behind the switch', () => {
  const offenders: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.tsx$/.test(name) || name === 'newsletter-form.tsx') continue;
      readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        if (/<NewsletterForm\b/.test(line) && !/signupsEnabled\(\) && <NewsletterForm\b/.test(line)) offenders.push(`${path}:${index + 1}`);
      });
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  assert.deepEqual(offenders, []);
});

const pages = { footer: () => createElement(Footer), thanks: () => createElement(ThankYouPage), issues: () => createElement(IssueIndexPage), saved: () => createElement(SavedPage) };

test('with the switch off no rendered page shows a form or a newsletter promise', () => {
  withSwitch(undefined);
  for (const [name, page] of Object.entries(pages)) {
    const html = renderToStaticMarkup(page());
    assert.ok(!/<form|data-newsletter="(?!done)|name="email"|Abone ol/i.test(html), `${name} still has a form`);
    assert.ok(!/e-postana gelsin|onay iletisindeki|haftada bir fiyat özeti|Haftalık Drop/.test(html), `${name} still promises the newsletter`);
  }
  const privacy = renderToStaticMarkup(createElement(PrivacyPage));
  assert.ok(!/Bülten aboneliği|Kit|bülten başvurusu|Aydınlatma/.test(privacy));
  assert.match(privacy, /Cloudflare tarafından yurt dışındaki/);
  assert.match(renderToStaticMarkup(createElement(ThankYouPage)), /Şu an abonelik almıyoruz/);
});

test('with the switch on the forms and the privacy section are there as before', () => {
  withSwitch('true');
  assert.match(renderToStaticMarkup(createElement(Footer)), /<form[^>]*action="\/api\/subscribe\?source=footer"/);
  assert.match(renderToStaticMarkup(createElement(SavedPage)), /data-newsletter="saved"/);
  assert.match(renderToStaticMarkup(createElement(IssueIndexPage)), /data-newsletter="issue"/);
  assert.match(renderToStaticMarkup(createElement(ThankYouPage)), /onay iletisindeki/);
  assert.match(renderToStaticMarkup(createElement(PrivacyPage)), /Bülten aboneliği/);
});

const post = (type: string, body: string) => new Request(`${origin}/api/subscribe?source=footer`, { method: 'POST', headers: { origin, 'content-type': type }, body });

test('with the switch off the endpoint refuses plainly and never touches the limiter or the provider', async () => {
  let touched = 0;
  const fetcher: typeof fetch = async () => { touched++; throw new Error('provider must not be called'); };
  for (const SIGNUPS_ENABLED of [undefined, 'false']) {
    const env: SubscribeEnvironment = { SIGNUPS_ENABLED, KIT_API_KEY: 'test-key-only', KIT_FORM_ID: '1', SUBSCRIBE_LIMITER: { limit: async () => { touched++; return { success: true }; } } };
    const json = await handleSubscribe(post('application/json', JSON.stringify({ email: 'a@example.test', consent: true, website: '' })), env, { fetch: fetcher });
    assert.equal(json.outcome, 'disabled'); assert.equal(json.status, 200);
    const response = subscribeResponse(json);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: false, message: 'Bülten kayıtları şu anda kapalı. E-posta adresi toplamıyoruz.' });
    const form = subscribeResponse(await handleSubscribe(post('application/x-www-form-urlencoded', 'email=a%40example.test&consent=on'), env, { fetch: fetcher }));
    assert.equal(form.status, 303); assert.equal(form.headers.get('location'), '/tesekkurler');
    // Even a malformed or cross-origin post gets the same plain answer and nothing else happens.
    assert.equal((await handleSubscribe(new Request(`${origin}/api/subscribe`, { method: 'GET' }), env, { fetch: fetcher })).outcome, 'disabled');
  }
  assert.equal(touched, 0);
});
