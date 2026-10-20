/** Last step of the nightly refresh (scrape.yml, "Report the outcome"): one table that keeps "was tonight's data written?"
 * apart from "was the edge purged and warmed?", and the job's final colour.
 *
 * The policy: the job is red whenever something needs a person, and the summary always says whether the data was written.
 *   - secrets check failed, or the refresh stopped before writing: red, "not written" (those steps already fail on their own);
 *   - data written but the edge purge failed: red, with an annotation that says the data WAS written, because visitors keep
 *     the previous catalog from the edge (6 hours, a quiet page up to 30 with stale-while-revalidate) until it is fixed;
 *   - the warm-up failed: a warning only; visitors get correct pages, the first ones are slower and cost D1 rows;
 *   - the purge is not configured: a notice, as before.
 * Inputs are the steps' outcomes (env) and .local/v2/refresh/summary.json, which scripts/v2-refresh.mts writes. */
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Outcome = 'success' | 'failure' | 'cancelled' | 'skipped' | '';
export interface OutcomeInput {
  secrets: Outcome; refresh: Outcome; corrections: Outcome; purge: Outcome; purgeResult: string; warm: Outcome;
  summary: { failure: string | null; results: { status?: unknown }[]; rowsWritten?: number; freshness?: { listed?: number; fresh?: number; stale?: number; error?: string } | null; sources?: { restored?: number } } | null;
}

export function refreshOutcome(input: OutcomeInput) {
  const annotations: string[] = [];
  const succeeded = input.summary?.results.filter(result => result.status === 'success' || result.status === 'already_completed').length ?? 0;
  const total = input.summary?.results.length ?? 0;
  // Written means at least one source's crawl is in D1 for today (already_completed: by an earlier run today).
  const written = input.secrets === 'success' && succeeded > 0;
  const data = input.secrets !== 'success' ? 'NOT written: the secrets check stopped the job before crawling'
    : !input.summary ? 'NOT written: the refresh did not report'
    : input.summary.failure ? `${succeeded ? `partly written (${succeeded}/${total} sources)` : 'NOT written'}; the refresh stopped: ${input.summary.failure}`
    : `written: ${succeeded}/${total} sources succeeded${input.refresh === 'failure' ? ' (some need attention, see above)' : ''}`;
  const f = input.summary?.freshness;
  const freshness = f && !f.error ? `${f.fresh} fresh, ${f.stale} stale, ${input.summary?.sources?.restored ?? 0} restored of ${f.listed} listed` : 'not counted';
  const purge = input.purge === 'skipped' || !input.purge ? (written ? 'not run' : 'not run: nothing was written, so the edge keeps its good copies')
    : input.purgeResult === 'skipped' ? 'not configured; pages refresh within 6 hours'
    : input.purge === 'success' ? 'purged'
    : 'FAILED: visitors see the previous catalog until the edge copies expire (6 hours; a quiet page up to 30)';
  const warm = input.warm === 'success' ? 'done' : input.warm === 'failure' ? 'incomplete: the first visitors compute what was not stored' : 'not run';
  const purgeFailed = input.purge === 'failure' || (input.purge === 'success' && input.purgeResult === 'failed');
  if (written) annotations.push(`::notice title=Catalog data written::${succeeded}/${total} sources succeeded; ${freshness}.`);
  if (purgeFailed && written) annotations.push('::error title=Edge purge failed (catalog data WAS written)::Tonight\'s data is in D1, but the edge still serves the previous pages. The purge step above says which secret or Worker to fix; re-run the workflow afterwards (finished sources are skipped).');
  if (input.warm === 'failure') annotations.push('::warning title=Edge warm-up incomplete::Pages are correct; the first visitors compute what the warm-up did not store. See the warm-up step.');
  const red = input.secrets !== 'success' || input.refresh === 'failure' || input.corrections === 'failure' || purgeFailed || !written;
  const markdown = `\n## Outcome\n\n| Stage | Result |\n|---|---|\n| Catalog data (D1) | ${data} |\n| Catalog freshness | ${freshness} |\n| Corrections | ${input.corrections === 'success' ? 'applied' : input.corrections === 'failure' ? 'FAILED (see that step)' : 'not run'} |\n| Edge purge | ${purge} |\n| Edge warm-up | ${warm} |\n\n`
    + (red ? `**Needs a person.** ${written ? 'The data was written; only the stages marked above need fixing.' : 'No new catalog data was written tonight; the site keeps showing the last good data.'}\n` : 'Nothing needs a person.\n');
  return { markdown, annotations, exitCode: red ? 1 : 0 };
}

async function main() {
  const env = process.env, outcome = (name: string) => (env[name] ?? '') as Outcome;
  const summary = await readFile(resolve('.local/v2/refresh/summary.json'), 'utf8').then(text => JSON.parse(text) as OutcomeInput['summary']).catch(() => null);
  const result = refreshOutcome({ secrets: outcome('SECRETS_OUTCOME'), refresh: outcome('REFRESH_OUTCOME'), corrections: outcome('CORRECTIONS_OUTCOME'),
    purge: outcome('PURGE_OUTCOME'), purgeResult: env.PURGE_RESULT ?? '', warm: outcome('WARM_OUTCOME'), summary });
  for (const line of result.annotations) console.log(line);
  console.log(result.markdown);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, result.markdown);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
