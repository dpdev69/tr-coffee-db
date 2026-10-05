// Refuses a production deploy while anything is still a placeholder. Run by the deploy:*:production npm scripts.
// Usage: node scripts/production-guard.mjs [--site-url] <wrangler config file>...
// Fails (exit 1) when a file still contains a REPLACE_* value, or, with --site-url, when NEXT_PUBLIC_SITE_URL is not a bare https origin.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const needSiteUrl = args.includes('--site-url');
const files = args.filter(arg => !arg.startsWith('--'));
const problems = [];
if (!files.length) problems.push('No configuration file was given to check.');
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { problems.push(`${file}: cannot be read.`); continue; }
  // Full-line comments may mention the prefix; only real values count.
  const unfilled = new Set(text.replace(/^\s*\/\/.*$/gm, '').match(/REPLACE_[A-Z0-9_]+/g) ?? []);
  for (const name of unfilled) problems.push(`${file}: ${name} is still a placeholder. Fill it from the resource created in the Cloudflare dashboard (docs/launch-day.md).`);
}
if (needSiteUrl) {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  let url = null;
  try { url = new URL(raw); } catch { /* reported below */ }
  if (!url || url.protocol !== 'https:' || url.origin !== raw || /workers\.dev$|localhost|example\./i.test(url.hostname)) {
    problems.push('NEXT_PUBLIC_SITE_URL must be the final public origin, for example https://kahvedrop.com (https, no path, no trailing slash, not a workers.dev or placeholder host).');
  }
}
if (problems.length) {
  console.error(`Production deploy refused:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Production guard: no placeholders left' + (needSiteUrl ? ' and the site address is set.' : '.'));
