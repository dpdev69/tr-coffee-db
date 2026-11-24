import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { googleSiteVerification } from '../src/lib/site-verification';

const root = new URL('../', import.meta.url).pathname;
const text = (path: string) => readFileSync(join(root, path), 'utf8');
const pages = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((name) => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? pages(path) : name === 'page.tsx' ? [path] : [];
});

/** Routes that only redirect: they render nothing, so they carry no metadata and stay out of the sitemap. */
const REDIRECT_ONLY = ['src/app/coffees/page.tsx', 'src/app/coffees/[slug]/page.tsx', 'src/app/rankings/page.tsx', 'src/app/roasters/page.tsx', 'src/app/roasters/[slug]/page.tsx'];
/** Pages kept out of the index on purpose (noindex, follow) whatever their query string. */
const NOINDEX = ['src/app/compare/page.tsx', 'src/app/listem/page.tsx', 'src/app/quiz/sonuc/page.tsx', 'src/app/tesekkurler/page.tsx'];

test('the root layout names no canonical, so no page inherits the home page as its own', () => {
  const layout = text('src/app/layout.tsx');
  assert.doesNotMatch(layout, /canonical\s*:/);
  assert.match(layout, /metadataBase: SITE_URL/);
  assert.match(text('src/app/page.tsx'), /alternates: \{ canonical: '\/' \}/);
});

test('every rendered page under src/app names its own canonical; redirect-only routes render none', () => {
  const all = pages('src/app').map((path) => relative(root, join(root, path))).sort();
  assert.ok(all.length >= 28, `found ${all.length} pages`);
  for (const path of REDIRECT_ONLY) {
    const source = text(path);
    assert.match(source, /permanentRedirect\(/, path);
    assert.doesNotMatch(source, /metadata/i, path);
  }
  for (const path of all.filter((path) => !REDIRECT_ONLY.includes(path))) {
    const source = text(path);
    // pageMetadata and listingMetadata always set alternates.canonical from their path argument.
    assert.match(source, /\b(pageMetadata|listingMetadata)\(|canonical: '\//, `${path} sets no canonical`);
    if (path !== 'src/app/page.tsx') assert.doesNotMatch(source, /(pageMetadata|listingMetadata)\([^;]*?, ['"]\/['"][,)]/, `${path} points its canonical at the home page`);
  }
  for (const path of NOINDEX) assert.match(text(path), /robots: \{ index: false, follow: true \}/, path);
});

test('literal canonical paths are unique across pages', () => {
  const seen = new Map<string, string>();
  for (const path of pages('src/app')) {
    // A "not found" branch drops its canonical right after the call, so its path is not claimed.
    const claimed = [...text(path).matchAll(/(?:pageMetadata|listingMetadata)\([^;]*?,\s*['"](\/[^'"]*)['"]\s*(?:,[^;]*?)?\)(,\s*alternates: \{ canonical: null \})?/g)]
      .filter((call) => !call[2]).map((call) => call[1]);
    for (const own of claimed) {
      assert.equal(seen.get(own), undefined, `${path} and ${seen.get(own)} both claim ${own}`);
      seen.set(own, path);
    }
  }
  assert.ok(seen.size >= 12, `only ${seen.size} literal canonicals found`);
});

test('a missing coffee, roaster or issue does not borrow another page as its canonical', () => {
  for (const path of ['src/app/kahve/[slug]/page.tsx', 'src/app/kavurucu/[slug]/page.tsx', 'src/app/bulten/[month]/page.tsx'])
    assert.match(text(path), /alternates: \{ canonical: null \}, robots: \{ index: false \}/, path);
  assert.match(text('src/app/not-found.tsx'), /alternates: \{ canonical: null \}/);
});

test('Google site verification: a trimmed token adds the meta tag, an unset or blank one adds nothing', () => {
  assert.deepEqual(googleSiteVerification('  abc123  '), { google: 'abc123' });
  assert.equal(googleSiteVerification(''), undefined);
  assert.equal(googleSiteVerification('   '), undefined);
  assert.equal(googleSiteVerification(undefined), undefined);
  assert.match(text('src/app/layout.tsx'), /\.\.\.\(verification \? \{ verification \} : \{\}\)/);
  assert.match(text('.env.example'), /^NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$/m);
});

/** brand.production and SITE_URL are fixed at import, so each stage is read in its own process. */
function stage(env: Record<string, string>) {
  const script = `
    const { brand } = await import('./src/lib/brand.ts');
    const { crawlRules } = await import('./src/lib/robots-rules.ts');
    const { staticSitemap } = await import('./src/lib/sitemap-entries.ts');
    const { pageMetadata } = await import('./src/lib/page-metadata.ts');
    const { SITE_URL } = await import('./src/lib/site.ts');
    console.log(JSON.stringify({ production: brand.production, origin: SITE_URL.origin, rules: crawlRules(brand.production),
      urls: staticSitemap().map((entry) => entry.url), canonical: pageMetadata('t', 'd', '/kahveler').alternates.canonical }));`;
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });
  return { status: run.status, stderr: run.stderr, out: run.status === 0 ? JSON.parse(run.stdout.trim().split('\n').at(-1)!) : null };
}

test('production stage: indexable robots, sitemap on the public origin, noindex and redirect routes left out', () => {
  for (const env of [{ DEPLOYMENT_STAGE: 'production' }, { NEXT_PUBLIC_DEPLOYMENT_STAGE: 'production' }]) {
    const { status, stderr, out } = stage({ ...env, NEXT_PUBLIC_SITE_URL: 'https://kahve.hellobasalt.dev' });
    assert.equal(status, 0, stderr);
    assert.equal(out.production, true);
    assert.equal(out.origin, 'https://kahve.hellobasalt.dev');
    assert.ok(Array.isArray(out.rules) && !out.rules.some((rule: { disallow?: string | string[] }) => [rule.disallow].flat().includes('/') && [rule.userAgent].flat().includes('*')));
    assert.equal(out.canonical, '/kahveler');
    for (const url of out.urls) assert.ok(url.startsWith('https://kahve.hellobasalt.dev/'), url);
    for (const path of ['/compare', '/coffees', '/rankings', '/roasters', '/listem', '/tesekkurler', '/quiz/sonuc'])
      assert.ok(!out.urls.includes(`https://kahve.hellobasalt.dev${path}`), path);
  }
});

test('any other stage keeps crawlers out, and production without a public origin refuses to start', () => {
  const staging = stage({ DEPLOYMENT_STAGE: 'staging' });
  assert.equal(staging.status, 0, staging.stderr);
  assert.equal(staging.out.production, false);
  assert.deepEqual(staging.out.rules, { userAgent: '*', disallow: '/' });
  assert.match(staging.out.origin, /\.workers\.dev$/);
  assert.equal(stage({}).out.production, false);
  const missing = stage({ DEPLOYMENT_STAGE: 'production' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /NEXT_PUBLIC_SITE_URL is required/);
});
