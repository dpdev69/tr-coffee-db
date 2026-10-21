/**
 * Links pasted from chat apps and AI answers often carry Markdown or punctuation stuck to the end ("/**", "/kahveler)."),
 * which used to land on the 404 page. The gateway (workers/web.ts) turns a 404 whose path ends in that junk into a 301 to
 * the path without it; whatever is left is served or 404s as usual, so a page that exists is never redirected and the
 * clean path cannot loop. API paths keep their own 404. Same rule as Göçmeden (gocmeden worker/index.js).
 */
const JUNK = /(?:[*_)\].,;:!'"`>]|%2A|%29|%5D|%22|%27|%60|%3E)+$/i;

export function tidyPath(pathname: string): string | null {
  const tidy = pathname.replace(JUNK, '');
  return tidy !== pathname ? tidy || '/' : null;
}

/** The 301 for a 404 with junk on the end of its path, or null. */
export function junkRedirect(url: URL, status: number): Response | null {
  if (status !== 404 || url.pathname.startsWith('/api/')) return null;
  const tidy = tidyPath(url.pathname);
  return tidy ? Response.redirect(new URL(tidy + url.search, url).toString(), 301) : null;
}
