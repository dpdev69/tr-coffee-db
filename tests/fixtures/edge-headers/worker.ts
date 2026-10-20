import { secureResponse } from '../../../workers/edge-headers';
import { contentSecurityPolicy } from '../../../shared/v2/content-security-policy';
import { STORED } from './stored-page';

const LEGACY_POLICY = contentSecurityPolicy().replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");

/** Stands in for Workers Cache in tests/edge-headers.test.ts: every request gets the same stored page, with a stale CSP that
 * still allows unsafe-inline and an ETag, streamed in 7-byte chunks so tags are split across chunks. */
function stored(path: string): Response {
  if (path === '/api/since') return Response.json({ ok: true }, { headers: { 'Content-Security-Policy': LEGACY_POLICY } });
  const bytes = new TextEncoder().encode(STORED);
  const body = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close(); } });
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': LEGACY_POLICY, ETag: '"v1"', 'Last-Modified': 'Mon, 19 Oct 2026 00:00:00 GMT', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}

const fixture = {
  fetch(request: Request): Response {
    return secureResponse(request, stored(new URL(request.url).pathname));
  },
};
export default fixture;
