import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { analyticsConsent, consentChoice } from '../shared/v2/consent';
import { POST } from '../src/app/api/events/route';
import { ConsentControls } from '../src/components/v2/consent-controls';

test('only an exact affirmative consent cookie enables analytics', () => {
  for (const cookie of [null, '', 'kahvedrop_consent=essential', 'fake_kahvedrop_consent=analytics', 'kahvedrop_consent=analytics-no', 'kahvedrop_consent=true']) assert.equal(analyticsConsent(cookie), false);
  assert.equal(analyticsConsent('other=1; kahvedrop_consent=analytics; x=2'), true);
  assert.equal(consentChoice('kahvedrop_consent=essential'), 'essential');
});
test('unconsented event endpoint does not access the absent Workers environment or database', async () => {
  const result = await POST(new Request('https://test.local/api/events', { method: 'POST', body: '{}' }));
  assert.equal(result.status, 204);
});
test('server markup always carries the banner; a stored choice hides it before hydration', () => {
  // The layout no longer reads cookies (pages stay cacheable). Its inline script marks <html data-consent>,
  // and globals.css hides .consent-banner:not([data-open]) under that attribute; the client then reads the cookie.
  const html = renderToStaticMarkup(createElement(ConsentControls));
  assert.match(html, /<section aria-label="Çerez tercihleri" class="consent-banner /);
  assert.doesNotMatch(html, /data-open/);
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.doesNotMatch(layout, /cookies\(\)/);
  assert.match(layout, /dataset\.consent/);
  assert.match(readFileSync('src/app/globals.css', 'utf8'), /html\[data-consent\] \.consent-banner:not\(\[data-open\]\)/);
  assert.equal(consentChoice('kahvedrop_consent=invalid'), null);
});
