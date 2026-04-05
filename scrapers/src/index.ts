import 'dotenv/config';
import { ShopifyAdapter } from './adapters/shopify-adapter.js';
import { WooCommerceAdapter } from './adapters/woocommerce-adapter.js';
import { HtmlAdapter } from './adapters/html-adapter.js';
import { ALL_ROASTER_CONFIGS } from './roasters/configs.js';
import type { RoasterConfig } from './types.js';

function createScraper(config: RoasterConfig) {
  switch (config.platform) {
    case 'shopify':
      return new ShopifyAdapter(config);
    case 'woocommerce':
      return new WooCommerceAdapter(config);
    case 'ikas':
    case 'ticimax':
    case 'custom':
      if (config.selectors) return new HtmlAdapter(config);
      console.warn(`[${config.slug}] HTML platform but no selectors configured, skipping`);
      return null;
    default:
      console.warn(`[${config.slug}] Platform "${config.platform}" not yet supported, skipping`);
      return null;
  }
}

async function main() {
  const startTime = Date.now();
  const targetSlugs = process.argv.slice(2);

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

  const results: { slug: string; status: string; error?: string }[] = [];

  for (const config of configs) {
    const scraper = createScraper(config);
    if (!scraper) {
      results.push({ slug: config.slug, status: 'skipped' });
      continue;
    }

    try {
      await scraper.run();
      results.push({ slug: config.slug, status: 'success' });
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
    console.log(`  [${icon}] ${r.slug}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    console.log(`\n${failed.length} roaster(s) failed.`);
    process.exit(1);
  }
}

main();
