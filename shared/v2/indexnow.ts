/** IndexNow (Bing, Yandex, Seznam, Naver): tells those engines which pages changed instead of waiting for a recrawl.
 * The key is public by design; public/<key>.txt serves it so the engines can confirm a submission comes from this site. */
export const INDEXNOW_KEY = '690ab7fb5c041e49efa0500e0d647064';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
/** The engines accept up to 10,000 URLs per request. */
const MAX_URLS = 10_000;

/** The sitemap's addresses on the site's own host whose lastmod is within the window (or every address with all). */
export function changedSitemapUrls(xml: string, site: string, { now = Date.now(), windowHours = 36, all = false } = {}): string[] {
  const host = new URL(site).host, since = now - windowHours * 3_600_000, urls = new Set<string>();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    let url: URL;
    try { url = new URL(loc); } catch { continue; }
    if (url.host !== host) continue;
    const lastmod = Date.parse(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(block)?.[1] ?? '');
    if (all || (Number.isFinite(lastmod) && lastmod >= since)) urls.add(url.href);
  }
  return [...urls].slice(0, MAX_URLS);
}

export function indexNowBody(site: string, urlList: string[]) {
  const origin = new URL(site).origin;
  return { host: new URL(site).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList };
}
