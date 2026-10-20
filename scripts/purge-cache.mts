/** Purges the site's edge cache after the nightly write (scrape.yml, "Purge the edge cache").
 *
 * The request goes through the crawler Worker's /site route (SITE_VIA), authenticated with CRAWL_RELAY_TOKEN, and carries
 * CACHE_PURGE_TOKEN as X-Cache-Purge-Token; the crawler hands it to the web Worker's POST /api/cache over a service binding
 * (docs/crawl-relay.md). Bot Fight Mode answers GitHub's runners 403 on the site's own address.
 *
 * Writes `result=purged|skipped|failed` to GITHUB_OUTPUT for the job's outcome step. When it fails it says which side refused
 * and which secret to fix, never printing a secret. It does not decide whether the job fails; the outcome step does. */
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REFRESH_SECRETS, rePaste, secretProblem } from './check-refresh-secrets.mts';

/** What a refusal means, from the status and the (short, Worker-written) body. */
export function explainPurgeResponse(status: number, body: string): string {
  const text = body.trim();
  if (status === 401 && text === 'Unauthorized.') return 'the crawler Worker refused CRAWL_RELAY_TOKEN: the GitHub secret CRAWL_RELAY_TOKEN must equal the crawler Worker secret RELAY_TOKEN';
  if (status === 401) return 'the web Worker refused CACHE_PURGE_TOKEN: the GitHub secret CACHE_PURGE_TOKEN must equal the web Worker secret CACHE_PURGE_TOKEN';
  if (status === 404 && text === 'Not found.') return 'the crawler Worker has no such route: the repository variable SITE_VIA must end in /site';
  if (status === 404) return 'the web Worker has no CACHE_PURGE_TOKEN secret (or one under 32 characters), so its purge route is off';
  if (status === 503 && text === 'Relay is not configured.') return 'the crawler Worker has no RELAY_TOKEN secret';
  if (status === 503 && text === 'Site route is not configured.') return 'the crawler Worker has no SITE service binding or SITE_ORIGIN';
  if (status === 503) return 'the web Worker could not purge its cache (Workers Cache unavailable); try again later';
  if (status === 403) return 'refused before reaching a Worker (Bot Fight Mode or a WAF rule answers GitHub runners 403): the purge must go through SITE_VIA, the crawler Worker\'s /site route, not the site\'s own address';
  return `unexpected answer${text ? `: ${printable(text)}` : ''}`;
}
const printable = (text: string) => text.replace(/[^\x20-\x7e]/g, ' ').slice(0, 200);

export async function purge(env: NodeJS.ProcessEnv, request: typeof fetch = fetch): Promise<{ result: 'purged' | 'skipped' | 'failed'; message: string }> {
  const via = env.SITE_VIA?.replace(/\/$/, '');
  const missing = ['CACHE_PURGE_TOKEN', 'SITE_URL', 'CRAWL_RELAY_TOKEN', 'SITE_VIA'].filter(name => !env[name]);
  if (missing.length) return { result: 'skipped', message: `Edge purge not configured (${missing.join(', ')} not set); pages refresh within 48 hours.` };
  for (const spec of REFRESH_SECRETS.filter(spec => spec.name !== 'CLOUDFLARE_D1_API_TOKEN')) {
    const problem = secretProblem(env[spec.name], { ...spec, required: true });
    if (problem) return { result: 'failed', message: rePaste(spec, problem, env) };
  }
  try {
    const response = await request(`${via}/api/cache`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${env.CRAWL_RELAY_TOKEN}`, 'X-Cache-Purge-Token': env.CACHE_PURGE_TOKEN! } });
    const body = await response.text();
    if (response.ok) return { result: 'purged', message: `Edge cache purged: ${printable(body)}` };
    return { result: 'failed', message: `POST ${via}/api/cache answered ${response.status}: ${explainPurgeResponse(response.status, body)}.` };
  } catch (error) {
    return { result: 'failed', message: `POST ${via}/api/cache did not answer (${error instanceof Error ? error.name : 'error'}); the crawler Worker may be down.` };
  }
}

async function main() {
  const { result, message } = await purge(process.env);
  if (result === 'failed') console.log(`::error title=Edge purge failed::${message}`);
  else if (result === 'skipped') console.log(`::notice::${message}`);
  else console.log(message);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `result=${result}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && result !== 'purged') await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n**Edge purge ${result}:** ${message}\n`);
  if (result === 'failed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Purge crashed: ${error instanceof Error ? error.name : 'error'}`); process.exitCode = 1; });
