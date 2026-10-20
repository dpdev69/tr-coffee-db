import { imageHosts } from './image-hosts';

/** The beacon script, loaded only after analytics consent (src/components/v2/consent-controls.tsx). */
export const ANALYTICS_SCRIPT_ORIGIN = 'https://static.cloudflareinsights.com';

/**
 * The site's Content-Security-Policy, one place for next.config.ts (every response) and the Worker gateway (HTML).
 * script-src carries no 'unsafe-inline' outside development: inline scripts run only with the per-request nonce the
 * gateway adds to HTML responses (workers/edge-headers.ts), which is also the nonce Cloudflare's bot check copies onto
 * the script it injects. Development keeps 'unsafe-inline' and 'unsafe-eval' for Vite; a browser ignores
 * 'unsafe-inline' whenever a nonce is present.
 */
export function contentSecurityPolicy({ development = false }: { development?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self'${development ? " 'unsafe-inline' 'unsafe-eval'" : ''} ${ANALYTICS_SCRIPT_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${imageHosts.map((hostname) => `https://${hostname}`).join(' ')}`,
    "font-src 'self' data:",
    "connect-src 'self' https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/** The same policy with `'nonce-…'` in script-src (right after 'self') and without 'unsafe-inline' there. Every other
 * directive is left exactly as it was; a policy without script-src gets one. */
export function withScriptNonce(policy: string, nonce: string): string {
  const source = `'nonce-${nonce}'`;
  let found = false;
  const directives = policy.split(';').map((directive) => directive.trim()).filter(Boolean).map((directive) => {
    const [name, ...values] = directive.split(/\s+/);
    if (name.toLowerCase() !== 'script-src') return directive;
    found = true;
    const kept = values.filter((value) => value.toLowerCase() !== "'unsafe-inline'" && !/^'nonce-/i.test(value));
    const self = kept.indexOf("'self'");
    kept.splice(self + 1, 0, source);
    return [name, ...kept].join(' ');
  });
  if (!found) directives.push(`script-src 'self' ${source} ${ANALYTICS_SCRIPT_ORIGIN}`);
  return directives.join('; ');
}
