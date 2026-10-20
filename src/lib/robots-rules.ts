import type { MetadataRoute } from 'next';

/** Free-text and price inputs make endless addresses (each one a fresh render and catalog read), all noindex already.
 * Every catalog form submission carries `search=`, so this also keeps crawlers out of submitted forms; paths, pages and
 * removable filter chips stay crawlable. Quiz results are noindex too.
 * `/*:` is not a page: no route, coffee slug, roaster slug or id contains a colon (stableSlug and stableId write only
 * [a-z0-9_-]). Crawlers read such paths out of the framework's icon markup (for instance `/kahveler/islem/naturel:1ur9nj5:0`)
 * and got a 404 each; the miss guard answers them without the app (workers/miss-guard.ts). */
const CRAWL_TRAPS = ['/quiz/sonuc', '/*:', ...['search', 'priceMin', 'priceMax', 'farm', 'producer', 'variety', 'altitude'].map(key => `/*${key}=`)];

/** SEO-tool crawlers build backlink and keyword databases for other sites' customers; they send no visitors. On 20 October 2026
 * DataForSeoBot alone made about 480 uncached requests in one hour. Search engines (Googlebot, Bingbot, YandexBot, DuckDuckBot,
 * Applebot) and AI answer crawlers stay under `*`: being found and cited is the point. */
export const SEO_TOOL_CRAWLERS = ['DataForSeoBot', 'SemrushBot', 'AhrefsBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'Barkrowler', 'SeekportBot', 'serpstatbot'];

export function crawlRules(production: boolean): MetadataRoute.Robots['rules'] {
  return production
    ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/go/', '/compare', ...CRAWL_TRAPS] }, { userAgent: SEO_TOOL_CRAWLERS, disallow: '/' }]
    : { userAgent: '*', disallow: '/' };
}
