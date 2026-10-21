import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { junkRedirect, tidyPath } from '../workers/junk-suffix';

describe('junk-suffix links (workers/junk-suffix.ts)', () => {
  it('strips Markdown and punctuation stuck to the end of a path', () => {
    assert.equal(tidyPath('/**'), '/');
    assert.equal(tidyPath('/kahveler).'), '/kahveler');
    assert.equal(tidyPath('/kahveler%2A%2A'), '/kahveler');
    assert.equal(tidyPath('/kahveler'), null);
    assert.equal(tidyPath('/'), null);
  });

  it('redirects only 404s, keeps the query, and leaves API paths alone', () => {
    const moved = junkRedirect(new URL('https://kahve.hellobasalt.dev/kahveler**?utm_source=x'), 404);
    assert.equal(moved?.status, 301);
    assert.equal(moved?.headers.get('location'), 'https://kahve.hellobasalt.dev/kahveler?utm_source=x');
    assert.equal(junkRedirect(new URL('https://kahve.hellobasalt.dev/**'), 404)?.headers.get('location'), 'https://kahve.hellobasalt.dev/');
    assert.equal(junkRedirect(new URL('https://kahve.hellobasalt.dev/kahveler**'), 200), null);
    assert.equal(junkRedirect(new URL('https://kahve.hellobasalt.dev/nope'), 404), null);
    assert.equal(junkRedirect(new URL('https://kahve.hellobasalt.dev/api/x**'), 404), null);
  });
});
