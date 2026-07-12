import type { ScrapeRunResult } from './base-scraper.js';

export type OrchestratorResult =
  | ScrapeRunResult
  | { slug: string; status: 'skipped'; reason: string }
  | { slug: string; status: 'failed'; error: string };

type FailedResult = Extract<OrchestratorResult, { status: 'failed' }>;

const RETRY_DELAY_STEP_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5_000;

export interface ScrapeRunEvaluation {
  allowedFailures: FailedResult[];
  attempted: number;
  failed: FailedResult[];
  minimumSuccessRate: number | null;
  policy: 'allowlist' | 'minimum-success-rate' | 'targeted';
  requiredSuccesses: number;
  shouldFail: boolean;
  skipped: number;
  succeeded: number;
  successRate: number;
  unexpectedFailures: FailedResult[];
}

export function parseMinimumSuccessRate(value: string | undefined): number | null {
  if (!value?.trim()) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error('MIN_SCRAPE_SUCCESS_RATE must be a number greater than 0 and at most 1.');
  }

  return parsed;
}

export function parseMaxAttempts(value: string | undefined): number {
  if (!value?.trim()) return 1;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error('SCRAPE_MAX_ATTEMPTS must be an integer between 1 and 5.');
  }

  return parsed;
}

export function findUnknownTargetSlugs(
  requestedSlugs: readonly string[],
  configuredSlugs: readonly string[]
): string[] {
  const configured = new Set(configuredSlugs);
  return [...new Set(requestedSlugs)].filter((slug) => !configured.has(slug));
}

export function evaluateScrapeRun({
  allowedFailureSlugs,
  minimumSuccessRate,
  results,
  targeted,
}: {
  allowedFailureSlugs: ReadonlySet<string>;
  minimumSuccessRate: number | null;
  results: OrchestratorResult[];
  targeted: boolean;
}): ScrapeRunEvaluation {
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const succeeded = results.filter((result) => result.status === 'success').length;
  const failed = results.filter(
    (result): result is FailedResult => result.status === 'failed'
  );
  const attempted = succeeded + failed.length;
  const successRate = attempted === 0 ? 0 : succeeded / attempted;
  const allowedFailures = failed.filter((result) => allowedFailureSlugs.has(result.slug));
  const unexpectedFailures = failed.filter(
    (result) => !allowedFailureSlugs.has(result.slug)
  );

  if (targeted) {
    return {
      allowedFailures,
      attempted,
      failed,
      minimumSuccessRate,
      policy: 'targeted',
      requiredSuccesses: attempted,
      shouldFail: failed.length > 0 || attempted === 0,
      skipped,
      succeeded,
      successRate,
      unexpectedFailures,
    };
  }

  if (minimumSuccessRate !== null) {
    const requiredSuccesses = Math.ceil(attempted * minimumSuccessRate);
    return {
      allowedFailures,
      attempted,
      failed,
      minimumSuccessRate,
      policy: 'minimum-success-rate',
      requiredSuccesses,
      shouldFail: attempted === 0 || succeeded < requiredSuccesses,
      skipped,
      succeeded,
      successRate,
      unexpectedFailures,
    };
  }

  return {
    allowedFailures,
    attempted,
    failed,
    minimumSuccessRate,
    policy: 'allowlist',
    requiredSuccesses: attempted - allowedFailures.length,
    shouldFail: unexpectedFailures.length > 0 || attempted === 0,
    skipped,
    succeeded,
    successRate,
    unexpectedFailures,
  };
}

export async function runWithRetries<T extends { status: 'success' | 'failed' }>({
  maxAttempts,
  onRetry,
  run,
  sleep = defaultSleep,
}: {
  maxAttempts: number;
  onRetry?: (context: {
    attempt: number;
    error: unknown | null;
    result: T | null;
  }) => void | Promise<void>;
  run: () => Promise<T>;
  sleep?: (delayMs: number) => Promise<void>;
}): Promise<T> {
  let lastResult: T | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: T;

    try {
      result = await run();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      await onRetry?.({ attempt, error, result: null });
      await sleep(retryDelayMs(attempt));
      continue;
    }

    lastResult = result;

    if (result.status === 'success' || attempt === maxAttempts) {
      return result;
    }

    await onRetry?.({ attempt, error: null, result });
    await sleep(retryDelayMs(attempt));
  }

  if (!lastResult) {
    throw new Error('Scrape retry loop completed without an attempt.');
  }

  return lastResult;
}

function retryDelayMs(attempt: number) {
  return Math.min(MAX_RETRY_DELAY_MS, attempt * RETRY_DELAY_STEP_MS);
}

export function buildGitHubStepSummary({
  elapsedSeconds,
  evaluation,
  results,
}: {
  elapsedSeconds: string;
  evaluation: ScrapeRunEvaluation;
  results: OrchestratorResult[];
}): string {
  const health = evaluation.shouldFail
    ? '❌ Failed'
    : evaluation.failed.length > 0
      ? '⚠️ Degraded'
      : '✅ Healthy';
  const policyDetail =
    evaluation.policy === 'minimum-success-rate'
      ? `Minimum success rate: ${formatPercent(evaluation.minimumSuccessRate ?? 0)}`
      : evaluation.policy === 'targeted'
        ? 'Targeted probes require every attempted roaster to succeed.'
        : 'Unexpected failures are fatal; configured failures are non-fatal.';

  const lines = [
    '## Scrape health',
    '',
    `**${health}** in ${elapsedSeconds}s. ${evaluation.succeeded}/${evaluation.attempted} attempted roasters succeeded (${formatPercent(evaluation.successRate)}).`,
    '',
    policyDetail,
    '',
    '| Outcome | Count |',
    '| --- | ---: |',
    `| Succeeded | ${evaluation.succeeded} |`,
    `| Failed | ${evaluation.failed.length} |`,
    `| Skipped | ${evaluation.skipped} |`,
    '',
    '### Roaster outcomes',
    '',
    '| Roaster | Status | Products found | Products upserted | Detail |',
    '| --- | --- | ---: | ---: | --- |',
  ];

  for (const result of results) {
    const productsFound = 'productsFound' in result ? result.productsFound : '—';
    const productsUpserted = 'productsUpserted' in result ? result.productsUpserted : '—';
    const detail =
      result.status === 'skipped'
        ? result.reason
        : result.status === 'failed'
          ? result.error || 'Unknown scrape failure'
          : `Specialty: ${result.specialtyQualified} qualified, ${result.specialtyRejected} rejected`;

    lines.push(
      `| ${escapeMarkdown(result.slug)} | ${result.status} | ${productsFound} | ${productsUpserted} | ${escapeMarkdown(detail).slice(0, 240)} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
