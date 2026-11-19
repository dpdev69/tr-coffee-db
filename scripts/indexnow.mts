/** Tells IndexNow engines (Bing, Yandex, Seznam, Naver) which pages changed tonight, after the purge and warm-up.
 *
 *   tsx scripts/indexnow.mts [--all] [--dry-run]     (SITE_URL, and SITE_VIA + CRAWL_RELAY_TOKEN in the nightly job)
 *
 * Default: sitemap addresses whose lastmod is within the last 36 hours (new and changed coffees, the lists they appear
 * on). --all sends the whole sitemap (once, the first time). The sitemap is read through the crawler Worker's /site route
 * when SITE_VIA is set, because Bot Fight Mode answers GitHub's runners 403 on the site itself (docs/crawl-relay.md).
 * A failed submission is only reported; it never fails the nightly job. */
import { appendFile } from 'node:fs/promises';
import { changedSitemapUrls, indexNowBody, INDEXNOW_ENDPOINT } from '../shared/v2/indexnow';

const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(site)) { console.log('::notice::SITE_URL not set; IndexNow skipped.'); process.exit(0); }
const all = process.argv.includes('--all'), dry = process.argv.includes('--dry-run');
const via = process.env.SITE_VIA?.replace(/\/$/, ''), relayToken = process.env.CRAWL_RELAY_TOKEN;
const base = via && relayToken ? via : site;
const headers: Record<string, string> = via && relayToken ? { Authorization: `Bearer ${relayToken}` } : {};

async function summary(line: string) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

try {
  const sitemap = await fetch(`${base}/sitemap.xml`, { headers, signal: AbortSignal.timeout(60_000) });
  if (!sitemap.ok) throw new Error(`sitemap answered ${sitemap.status}`);
  const urls = changedSitemapUrls(await sitemap.text(), site, { all });
  if (!urls.length) { await summary('IndexNow: no sitemap address changed in the last 36 hours; nothing sent.'); process.exit(0); }
  if (dry) { console.log(`IndexNow (dry run): ${urls.length} URLs`); console.log(urls.slice(0, 20).join('\n')); process.exit(0); }
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(indexNowBody(site, urls)), signal: AbortSignal.timeout(30_000),
  });
  // 200 and 202 both mean accepted (202: the key is still being verified).
  if (response.ok) await summary(`IndexNow: ${response.status}, ${urls.length} URLs sent.`);
  else console.log(`::warning::IndexNow answered ${response.status} for ${urls.length} URLs: ${(await response.text()).slice(0, 200)}`);
} catch (error) {
  console.log(`::warning::IndexNow submission failed: ${error instanceof Error ? error.message : String(error)}`);
}
