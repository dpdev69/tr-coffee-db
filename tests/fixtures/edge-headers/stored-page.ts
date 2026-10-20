/** The page the fixture Worker (worker.ts) hands the gateway on every request, as Workers Cache would hand back one stored
 * copy: the same string each time, with an old nonce on one script. */
export const STORED = '<!doctype html><html><head><script src="/_next/static/app.js" type="module" async></script>'
  + '<script>self.__next_f=self.__next_f||[]</script><script type="application/ld+json">{"@type":"WebPage"}</script></head>'
  + '<body><script>document.documentElement.dataset.consent="1"</script><p>kahve</p>'
  + '<script nonce="stale">self.__next_f.push([1,"x"])</script></body></html>';
