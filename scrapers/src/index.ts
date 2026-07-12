import 'dotenv/config';
import { appendFile } from 'node:fs/promises';
import { ShopifyAdapter } from './adapters/shopify-adapter.js';
import { WooCommerceAdapter } from './adapters/woocommerce-adapter.js';
import { HtmlAdapter } from './adapters/html-adapter.js';
import { ALL_ROASTER_CONFIGS } from './roasters/configs.js';
import type { RoasterConfig } from './types.js';
import {
  buildGitHubStepSummary,
  evaluateScrapeRun,
  findUnknownTargetSlugs,
  parseMaxAttempts,
  parseMinimumSuccessRate,
  runWithRetries,
  type OrchestratorResult,
} from './run-policy.js';

function parseTargetSlugs(args: string[]): string[] {
  return args
    .flatMap((arg) => arg.split(/[\s,]+/))
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function createScraper(config: RoasterConfig) {
  switch (config.platform) {
    case 'shopify':
      return new ShopifyAdapter(config);
    case 'woocommerce':
      return new WooCommerceAdapter(config);
    case 'ikas':
    case 'ticimax':
    case 'custom':
      if (config.selectors || config.structuredDataParser) return new HtmlAdapter(config);
      console.warn(`[${config.slug}] HTML platform but no selectors configured, skipping`);
      return null;
    default:
      console.warn(`[${config.slug}] Platform "${config.platform}" not yet supported, skipping`);
      return null;
  }
}

async function main() {
  const startTime = Date.now();
  const targetSlugs = parseTargetSlugs(process.argv.slice(2));
  const maxAttempts = parseMaxAttempts(process.env.SCRAPE_MAX_ATTEMPTS);
  const minimumSuccessRate = parseMinimumSuccessRate(
    process.env.MIN_SCRAPE_SUCCESS_RATE
  );
  const allowedFailureSlugs = new Set(
    parseTargetSlugs([process.env.ALLOW_ROASTER_FAILURES ?? ''])
  );
  const skippedSlugs = new Set(parseTargetSlugs([process.env.SKIP_ROASTERS ?? '']));

  // Filter configs if specific slugs provided (e.g., `npx tsx src/index.ts petra montag`)
  const configs =
    targetSlugs.length > 0
      ? ALL_ROASTER_CONFIGS.filter((c) => targetSlugs.includes(c.slug))
      : ALL_ROASTER_CONFIGS;

  const unknownTargetSlugs = findUnknownTargetSlugs(
    targetSlugs,
    ALL_ROASTER_CONFIGS.map((config) => config.slug)
  );

  console.log(`Starting scrape for ${configs.length} roasters...`);
  console.log(`Roasters: ${configs.map((c) => c.slug).join(', ')}`);
  console.log(`Attempts per roaster: ${maxAttempts}`);
  if (minimumSuccessRate !== null) {
    console.log(
      `Broad-run health gate: ${(minimumSuccessRate * 100).toFixed(1)}% minimum success rate`
    );
  }
  console.log('---');

  const results: OrchestratorResult[] = unknownTargetSlugs.map((slug) => ({
    slug,
    status: 'failed',
    error: 'No matching roaster config found.',
  }));

  for (const config of configs) {
    if (skippedSlugs.has(config.slug)) {
      results.push({
        slug: config.slug,
        status: 'skipped',
        reason: 'Skipped by SKIP_ROASTERS',
      });
      continue;
    }

    const scraper = createScraper(config);
    if (!scraper) {
      results.push({
        slug: config.slug,
        status: 'skipped',
        reason: `Unsupported or unconfigured platform "${config.platform}"`,
      });
      continue;
    }

    try {
      const result = await runWithRetries({
        maxAttempts,
        run: () => scraper.run(),
        onRetry: ({ attempt, error, result: failedResult }) => {
          const reason =
            failedResult?.error ??
            (error instanceof Error ? error.message : error ? String(error) : 'unknown error');
          console.warn(
            `[${config.slug}] Attempt ${attempt}/${maxAttempts} failed: ${reason}. Retrying...`
          );
        },
      });
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ slug: config.slug, status: 'failed', error: msg });
    }
  }

  // Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Scrape Summary ===');
  console.log(`Total time: ${elapsed}s`);
  for (const r of results) {
    const icon = r.status === 'success' ? '+' : r.status === 'skipped' ? '-' : 'x';
    const context =
      r.status === 'skipped'
        ? ` (${r.reason})`
        : 'error' in r && r.error
          ? ` (${r.error})`
          : '';
    const classification =
      r.status === 'success'
        ? ` | specialty ${r.specialtyQualified} qualified / ${r.specialtyRejected} rejected / ${r.specialtyUnclassified} unclassified`
        : '';
    console.log(`  [${icon}] ${r.slug}: ${r.status}${classification}${context}`);
  }

  const evaluation = evaluateScrapeRun({
    allowedFailureSlugs,
    minimumSuccessRate,
    results,
    targeted: targetSlugs.length > 0,
  });

  if (evaluation.failed.length > 0) {
    console.log(`\n${evaluation.failed.length} roaster(s) failed.`);
    if (evaluation.allowedFailures.length > 0) {
      console.log(
        `Known failures: ${evaluation.allowedFailures.map((result) => result.slug).join(', ')}`
      );
    }

    for (const result of evaluation.failed) {
      console.log(
        `::warning title=Roaster scrape failed: ${escapeWorkflowCommand(result.slug)}::${escapeWorkflowCommand(result.error || 'Unknown scrape failure')}`
      );
    }
  }

  console.log(
    `Scrape health: ${evaluation.succeeded}/${evaluation.attempted} succeeded (${(
      evaluation.successRate * 100
    ).toFixed(1)}%)`
  );

  await writeGitHubStepSummary(results, evaluation, elapsed);

  if (evaluation.shouldFail) {
    const message =
      evaluation.policy === 'minimum-success-rate'
        ? `${evaluation.succeeded}/${evaluation.attempted} roasters succeeded; ${evaluation.requiredSuccesses} required.`
        : evaluation.policy === 'targeted'
          ? 'A targeted roaster probe failed.'
          : `Unexpected failures: ${evaluation.unexpectedFailures.map((result) => result.slug).join(', ')}`;
    console.error(`::error title=Scrape health gate failed::${escapeWorkflowCommand(message)}`);
    process.exitCode = 1;
  }
}

async function writeGitHubStepSummary(
  results: OrchestratorResult[],
  evaluation: ReturnType<typeof evaluateScrapeRun>,
  elapsedSeconds: string
) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  try {
    await appendFile(
      summaryPath,
      buildGitHubStepSummary({ elapsedSeconds, evaluation, results }),
      'utf8'
    );
  } catch (error) {
    console.warn('Failed to write GitHub Actions step summary', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function escapeWorkflowCommand(value: string) {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

main().catch((error) => {
  console.error('Scrape orchestration failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
