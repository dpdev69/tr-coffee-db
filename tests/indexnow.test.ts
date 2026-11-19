import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { changedSitemapUrls, indexNowBody, INDEXNOW_KEY } from '../shared/v2/indexnow';

const site = 'https://kahve.hellobasalt.dev';
const entry = (loc: string, lastmod?: string) => `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
const xml = `<?xml version="1.0"?><urlset>${[
  entry(`${site}/`, '2026-11-19T04:43:22.638Z'),
  entry(`${site}/kahve/yeni-kahve`, '2026-11-18T20:00:00.000Z'),
  entry(`${site}/kahve/eski-kahve`, '2026-11-10T00:00:00.000Z'),
  entry(`${site}/rehber`),
  entry('https://example.com/elsewhere', '2026-11-19T00:00:00.000Z'),
].join('')}</urlset>`;
const now = Date.parse('2026-11-19T06:00:00Z');

describe('IndexNow', () => {
  it('sends only this site\'s sitemap addresses that changed in the last 36 hours', () => {
    assert.deepEqual(changedSitemapUrls(xml, site, { now }), [`${site}/`, `${site}/kahve/yeni-kahve`]);
  });
  it('sends every address on this host with all', () => {
    assert.deepEqual(changedSitemapUrls(xml, site, { now, all: true }), [`${site}/`, `${site}/kahve/yeni-kahve`, `${site}/kahve/eski-kahve`, `${site}/rehber`]);
  });
  it('serves the key at the keyLocation it submits', () => {
    const body = indexNowBody(site, [`${site}/`]);
    assert.equal(body.host, 'kahve.hellobasalt.dev');
    assert.equal(body.keyLocation, `${site}/${INDEXNOW_KEY}.txt`);
    assert.equal(readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), 'utf8'), INDEXNOW_KEY);
  });
  it('pings after the nightly purge without failing the job', () => {
    const workflow = readFileSync(new URL('../.github/workflows/scrape.yml', import.meta.url), 'utf8');
    const step = workflow.slice(workflow.indexOf('- name: Ping IndexNow'));
    assert.match(step, /continue-on-error: true/);
    assert.match(step, /run: scrapers\/node_modules\/\.bin\/tsx scripts\/indexnow\.mts/);
    assert.ok(workflow.indexOf('- name: Ping IndexNow') > workflow.indexOf('- name: Warm the edge cache'));
  });
});
