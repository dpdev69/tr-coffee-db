/** First step of the nightly refresh (scrape.yml): checks the shape of each secret the job uses, then asks Cloudflare whether
 * the D1 token is live and can see the database, before anything is crawled or written.
 *
 * It never prints a secret or any part of it, not even its length: a value pasted with extra text (a whole curl command,
 * a line break) is exactly the case where GitHub's log masking can miss a fragment. It names the secret, says what is wrong
 * and where to re-paste it.
 *
 * CLOUDFLARE_D1_API_TOKEN is required: a bad one stops the job here. CRAWL_RELAY_TOKEN and CACHE_PURGE_TOKEN are optional
 * (without them the relay sources are fetched directly and the edge is not purged); a malformed one is reported as an error
 * here but does not stop tonight's data, and the purge step then fails with the same message (scripts/purge-cache.mts). */
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface SecretSpec { name: string; required: boolean; minLength: number; where: string }
export const REFRESH_SECRETS: SecretSpec[] = [
  { name: 'CLOUDFLARE_D1_API_TOKEN', required: true, minLength: 32, where: 'a Cloudflare API token with D1 Edit on this account (Cloudflare dashboard > My Profile > API Tokens); paste the token only, not the curl command that tests it' },
  { name: 'CRAWL_RELAY_TOKEN', required: false, minLength: 16, where: 'the same value as the crawler Worker secret RELAY_TOKEN (docs/crawl-relay.md)' },
  // The web Worker's /api/cache treats a token under 32 characters as not configured (src/app/api/cache/route.ts).
  { name: 'CACHE_PURGE_TOKEN', required: false, minLength: 32, where: 'the same value as the web Worker secret CACHE_PURGE_TOKEN (docs/HANDOFF.md, owner to-do 1)' },
];

/** What is wrong with a secret's value, in words that never include the value. null when it looks right. */
export function secretProblem(value: string | undefined, spec: Pick<SecretSpec, 'required' | 'minLength'>): string | null {
  if (value === undefined || value === '') return spec.required ? 'is not set' : null;
  if (/[\r\n]/.test(value)) return 'contains a line break (it was probably pasted with extra lines)';
  if (/\s/.test(value)) return 'contains a space or tab (it was probably pasted with extra text around it)';
  // "curl" only in lower case, as a command is typed: a random token holds it in some case far more often.
  if (/curl|https?:/.test(value) || /bearer|authorization/i.test(value)) return 'contains command text such as "curl", "Bearer", "Authorization" or a URL; paste the token value alone';
  if (/["'`<>\\]/.test(value)) return 'contains quotes, angle brackets or a backslash; paste the token value alone';
  // Headers refuse anything outside visible ASCII; that was the 19 October failure ("is an invalid header value").
  if (!/^[\x21-\x7e]+$/.test(value)) return 'contains characters that cannot go in an HTTP header (non-ASCII or control characters)';
  if (value.length < spec.minLength) return `is shorter than ${spec.minLength} characters, so it is probably cut off`;
  if (value.length > 512) return 'is longer than 512 characters, so it probably includes more than the token';
  return null;
}

export function secretsPage(env: NodeJS.ProcessEnv = process.env) {
  const repo = env.GITHUB_REPOSITORY;
  return repo ? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/settings/secrets/actions` : 'the repository Settings > Secrets and variables > Actions';
}
export function rePaste(spec: SecretSpec, problem: string, env: NodeJS.ProcessEnv = process.env) {
  return `${spec.name} ${problem}. Re-paste it in GitHub: repository Settings > Secrets and variables > Actions > ${spec.name} (${secretsPage(env)}). It must be ${spec.where}.`;
}

type CloudflareReply = { success?: boolean; errors?: { code?: number; message?: string }[]; result?: { status?: string; expires_on?: string | null } };
/** Asks Cloudflare whether the token is active (user tokens, then account-owned tokens) and whether it can see this
 * database. The database lookup is the management API: it runs no SQL and reads no rows.
 * `errors` stop the job; `warnings` are reported and the job goes on (Cloudflare's API itself being down is a warning,
 * because the refresh's own requests then fail with their own message). */
export async function verifyD1Token(token: string, accountId: string, databaseId: string, request: typeof fetch = fetch, now = Date.now()) {
  const errors: string[] = [], warnings: string[] = [];
  const call = async (path: string) => {
    const response = await request(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => ({})) as CloudflareReply;
    return { status: response.status, body };
  };
  try {
    let verify = await call('/user/tokens/verify');
    if (!verify.body.success) verify = await call(`/accounts/${accountId}/tokens/verify`);
    if (verify.status >= 500) { warnings.push(`Cloudflare's token check answered ${verify.status}; carrying on.`); return { errors, warnings }; }
    if (!verify.body.success) {
      errors.push(`Cloudflare does not accept CLOUDFLARE_D1_API_TOKEN (${describe(verify)}): it is wrong, deleted or expired`);
      return { errors, warnings };
    }
    if (verify.body.result?.status && verify.body.result.status !== 'active') errors.push(`Cloudflare reports CLOUDFLARE_D1_API_TOKEN as ${verify.body.result.status}, not active`);
    const expires = verify.body.result?.expires_on ? Date.parse(verify.body.result.expires_on) : NaN;
    if (Number.isFinite(expires) && expires - now < 14 * 86_400_000) warnings.push(`CLOUDFLARE_D1_API_TOKEN expires on ${new Date(expires).toISOString().slice(0, 10)}; roll it before then.`);
    const database = await call(`/accounts/${accountId}/d1/database/${databaseId}`);
    if (database.status === 404) errors.push(`Cloudflare finds no D1 database ${databaseId} in account ${accountId}; check the repository variable CLOUDFLARE_D1_DATABASE_ID`);
    else if (database.status >= 500) warnings.push(`Cloudflare's D1 lookup answered ${database.status}; carrying on.`);
    else if (!database.body.success) errors.push(`CLOUDFLARE_D1_API_TOKEN is active but cannot reach D1 database ${databaseId} (${describe(database)}); it needs D1 Edit on account ${accountId}`);
  } catch (error) {
    warnings.push(`Could not reach Cloudflare to check the token (${error instanceof Error ? error.name : 'error'}); carrying on.`);
  }
  return { errors, warnings };
}
function describe(reply: { status: number; body: CloudflareReply }) {
  const codes = (reply.body.errors ?? []).map(error => `${error.code ?? '?'} ${String(error.message ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 80)}`).join('; ');
  return `HTTP ${reply.status}${codes ? `, ${codes}` : ''}`;
}

async function main() {
  const env = process.env, errors: string[] = [], warnings: string[] = [];
  for (const spec of REFRESH_SECRETS) {
    const problem = secretProblem(env[spec.name], spec);
    if (!problem) continue;
    const message = rePaste(spec, problem, env);
    if (spec.required) errors.push(message);
    else console.log(`::error title=${spec.name} needs re-pasting::${message} Tonight's data still refreshes; the edge purge will fail until it is fixed.`);
  }
  if (!errors.length) {
    const d1Spec = REFRESH_SECRETS[0];
    const checked = await verifyD1Token(env.CLOUDFLARE_D1_API_TOKEN!, env.CLOUDFLARE_ACCOUNT_ID ?? '', env.CLOUDFLARE_D1_DATABASE_ID ?? '');
    errors.push(...checked.errors.map(problem => `${problem}. Create or roll the token, then re-paste it in GitHub: repository Settings > Secrets and variables > Actions > ${d1Spec.name} (${secretsPage(env)}).`));
    warnings.push(...checked.warnings);
  }
  for (const warning of warnings) console.log(`::warning title=Secrets check::${warning}`);
  for (const error of errors) console.log(`::error title=Secret check failed (nothing was crawled)::${error}`);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, errors.length
    ? `## Secrets\n\n**Stopped before crawling; no catalog data was written.**\n\n${errors.map(error => `- ${error}`).join('\n')}\n\n`
    : `## Secrets\n\nAll set secrets look right; Cloudflare accepts the D1 token.${warnings.length ? `\n\n${warnings.map(warning => `- ${warning}`).join('\n')}` : ''}\n\n`);
  if (errors.length) process.exitCode = 1;
  else console.log('Secrets look right; Cloudflare accepts the D1 token.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Secrets check crashed: ${error instanceof Error ? error.name : 'error'}`); process.exitCode = 1; });
