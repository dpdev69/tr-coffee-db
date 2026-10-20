import type { Plugin } from 'vite';

/**
 * vinext marks each icon <link> it streams with data-vinext-streamed-icon="<pathname>:<hash>:<order>", for instance
 * "/kahveler/islem/naturel:1ur9nj5:0". Googlebot reads that value as a link and asks for it: on 20 October 2026 about 74 of
 * 178 sampled 404s in Search Console were such addresses, each one a full uncached render.
 *
 * The key only has to match between that attribute and the client component that reorders the icons (both get it from the
 * same createStreamedIconKey call), and to change when the page's metadata changes. This rewrites that one function so the
 * key no longer starts with the page's path: "vinext-icon-<hash of path and metadata>". The value then reads as a URL with
 * an unknown scheme, which crawlers do not fetch, and the client code (prefix match, order after the last colon) is unchanged.
 * The build fails if vinext changes that function, rather than shipping the path again unnoticed
 * (scripts/v2-sanitize-build.mjs checks the bundle too).
 */
export const STREAMED_ICON_MODULE = /[\\/]vinext[\\/]dist[\\/]server[\\/]app-page-route-wiring\.js$/;
export const ORIGINAL_KEY = 'return `${pathname}:${(hash >>> 0).toString(36)}`;';
export const PATHLESS_KEY = 'for (let index = 0; index < pathname.length; index++) { hash ^= pathname.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `vinext-icon-${(hash >>> 0).toString(36)}`;';

export function pathlessStreamedIconKey(code: string, id: string): string {
  if (!code.includes(ORIGINAL_KEY)) throw new Error(`vite-streamed-icons: createStreamedIconKey changed in ${id}; check that streamed icon keys still carry no path, then update this plugin.`);
  return code.replace(ORIGINAL_KEY, PATHLESS_KEY);
}

export function streamedIconKeyWithoutPath(): Plugin {
  return {
    name: 'kahvedrop:streamed-icon-key-without-path',
    enforce: 'pre',
    transform(code, id) {
      if (!STREAMED_ICON_MODULE.test(id.split('?')[0])) return null;
      return { code: pathlessStreamedIconKey(code, id), map: null };
    },
  };
}
