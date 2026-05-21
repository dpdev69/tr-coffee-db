import 'dotenv/config';
import { ShopifyAdapter } from './adapters/shopify-adapter.js';
import { WooCommerceAdapter } from './adapters/woocommerce-adapter.js';
import { HtmlAdapter } from './adapters/html-adapter.js';
import { ALL_ROASTER_CONFIGS } from './roasters/configs.js';
import type { RoasterConfig } from './types.js';
import type { ScrapeRunResult } from './base-scraper.js';

type OrchestratorResult =
  | ScrapeRunResult
  | { slug: string; status: 'skipped'; reason: string }
  | { slug: string; status: 'failed'; error: string };

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
  const allowedFailureSlugs = new Set(
    parseTargetSlugs([process.env.ALLOW_ROASTER_FAILURES ?? ''])
  );
  const skippedSlugs = new Set(parseTargetSlugs([process.env.SKIP_ROASTERS ?? '']));

  // Filter configs if specific slugs provided (e.g., `npx tsx src/index.ts petra montag`)
  const configs =
    targetSlugs.length > 0
      ? ALL_ROASTER_CONFIGS.filter((c) => targetSlugs.includes(c.slug))
      : ALL_ROASTER_CONFIGS;

  if (configs.length === 0) {
    console.error('No matching roaster configs found.');
    process.exit(1);
  }

  console.log(`Starting scrape for ${configs.length} roasters...`);
  console.log(`Roasters: ${configs.map((c) => c.slug).join(', ')}`);
  console.log('---');

  const results: OrchestratorResult[] = [];

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
      const result = await scraper.run();
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

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    console.log(`\n${failed.length} roaster(s) failed.`);
    const fatalFailures = failed.filter((r) => !allowedFailureSlugs.has(r.slug));
    const nonFatalFailures = failed.filter((r) => allowedFailureSlugs.has(r.slug));

    if (nonFatalFailures.length > 0) {
      console.log(
        `Allowed non-fatal failures: ${nonFatalFailures.map((r) => r.slug).join(', ')}`
      );
    }

    if (fatalFailures.length === 0) {
      return;
    }

    process.exit(1);
  }
}

main();
