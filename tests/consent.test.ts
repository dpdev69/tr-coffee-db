import test from 'node:test';
import assert from 'node:assert/strict';
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
test('server markup shows consent for absent or invalid choices and hides remembered choices', () => {
  for (const cookie of [null, 'kahvedrop_consent=invalid', 'kahvedrop_consent=essential', 'kahvedrop_consent=analytics']) {
    const initialChoice = consentChoice(cookie);
    const html = renderToStaticMarkup(createElement(ConsentControls, { initialChoice }));
    assert.equal(html.includes('<section aria-label="Çerez tercihleri"'), initialChoice === null);
    if (cookie === 'kahvedrop_consent=invalid') assert.equal(initialChoice, null);
  }
});
