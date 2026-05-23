import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CATALOG_NAME_EXCLUSION_PATTERNS,
  getCurrentCatalogCutoffIso,
} from '../src/lib/catalog-rules';
import { applyPublicCoffeeVisibility } from '../src/lib/public-coffee-visibility';
import type { Database } from '../src/lib/types/database';

type CoffeeRow = Pick<
  Database['public']['Tables']['coffees']['Row'],
  'id' | 'slug' | 'name' | 'image_url' | 'last_seen_at'
> & {
  roasters: {
    name: string;
    slug: string;
    logo_url: string | null;
  };
};

type RoasterRow = Pick<
  Database['public']['Tables']['roasters']['Row'],
  'id' | 'slug' | 'name' | 'logo_url'
>;

type OptimizerFailure = {
  kind: 'coffee' | 'roaster';
  owner: string;
  slug: string;
  imageUrl: string;
  status: number | null;
  error: string;
};

type CliOptions = {
  concurrency: number;
  json: boolean;
  limit: number | null;
  maxMissingCoffees: number;
  maxMissingCoffeeRatio: number;
  maxMissingRoasterLogos: number;
  maxOptimizerFailures: number;
  optimizerLimit: number;
  siteUrl: string | null;
  timeoutMs: number;
};

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MAX_MISSING_COFFEES = 20;
const DEFAULT_MAX_MISSING_COFFEE_RATIO = 0.08;
const DEFAULT_MAX_MISSING_ROASTER_LOGOS = 0;
const DEFAULT_MAX_OPTIMIZER_FAILURES = 0;
const DEFAULT_OPTIMIZER_LIMIT = 250;
const DEFAULT_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 500;

async function main() {
  loadEnvLocal();
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseClient();
  const cutoff = getCurrentCatalogCutoffIso();

  const [coffees, activeRoasters] = await Promise.all([
    fetchPublicAvailableCoffees(supabase, cutoff, options.limit),
    fetchActiveRoasters(supabase),
  ]);

  const missingCoffeeImages = coffees.filter((coffee) => !coffee.image_url);
  const missingRoasterLogos = activeRoasters.filter((roaster) => !roaster.logo_url);
  const roasterCoverage = buildRoasterCoverage(coffees);
  const optimizerFailures = options.siteUrl
    ? await auditOptimizerImages({ activeRoasters, coffees, options })
    : [];

  const missingCoffeeRatio =
    coffees.length === 0 ? 0 : missingCoffeeImages.length / coffees.length;
  const failures = [
    ...(missingCoffeeImages.length > options.maxMissingCoffees
      ? [
          `missing coffee images ${missingCoffeeImages.length} > ${options.maxMissingCoffees}`,
        ]
      : []),
    ...(missingCoffeeRatio > options.maxMissingCoffeeRatio
      ? [
          `missing coffee image ratio ${formatPercent(missingCoffeeRatio)} > ${formatPercent(
            options.maxMissingCoffeeRatio
          )}`,
        ]
      : []),
    ...(missingRoasterLogos.length > options.maxMissingRoasterLogos
      ? [
          `missing active roaster logos ${missingRoasterLogos.length} > ${options.maxMissingRoasterLogos}`,
        ]
      : []),
    ...(optimizerFailures.length > options.maxOptimizerFailures
      ? [
          `optimizer failures ${optimizerFailures.length} > ${options.maxOptimizerFailures}`,
        ]
      : []),
  ];

  const summary = {
    cutoff,
    scannedCoffees: coffees.length,
    missingCoffeeImages: missingCoffeeImages.length,
    missingCoffeeImageRatio: missingCoffeeRatio,
    activeRoasters: activeRoasters.length,
    missingRoasterLogos: missingRoasterLogos.length,
    optimizerChecked: options.siteUrl
      ? Math.min(options.optimizerLimit, countUniqueImages(coffees, activeRoasters))
      : 0,
    optimizerFailures,
    thresholds: {
      maxMissingCoffees: options.maxMissingCoffees,
      maxMissingCoffeeRatio: options.maxMissingCoffeeRatio,
      maxMissingRoasterLogos: options.maxMissingRoasterLogos,
      maxOptimizerFailures: options.maxOptimizerFailures,
    },
    topMissingCoffeeImagesByRoaster: roasterCoverage
      .filter((row) => row.missing > 0)
      .sort((left, right) => right.missing - left.missing || right.total - left.total)
      .slice(0, 20),
    missingRoasterLogoSlugs: missingRoasterLogos.map((roaster) => roaster.slug).sort(),
    failures,
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printTextReport(summary, options.siteUrl);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function createSupabaseClient() {
  const supabaseUrl = readFirstEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  const supabaseKey = readFirstEnv([
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);

  if (!supabaseUrl) {
    throw new Error('Missing required env var NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  }
  if (!supabaseKey) {
    throw new Error(
      'Missing required env var NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

async function fetchPublicAvailableCoffees(
  supabase: SupabaseClient<Database>,
  currentCutoff: string,
  limit: number | null
) {
  const coffees: CoffeeRow[] = [];
  let from = 0;

  while (limit === null || coffees.length < limit) {
    const remaining = limit === null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - coffees.length);
    const to = from + remaining - 1;
    let query = supabase
      .from('coffees')
      .select('id, slug, name, image_url, last_seen_at, roasters!inner(name, slug, logo_url)')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    query = applyPublicCoffeeVisibility(query, currentCutoff);

    for (const pattern of CATALOG_NAME_EXCLUSION_PATTERNS) {
      query = query.not('name', 'ilike', pattern);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as CoffeeRow[];
    coffees.push(...rows);
    if (rows.length < remaining) break;

    from += PAGE_SIZE;
  }

  return coffees;
}

async function fetchActiveRoasters(supabase: SupabaseClient<Database>) {
  const roasters: RoasterRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('roasters')
      .select('id, slug, name, logo_url')
      .eq('is_active', true)
      .order('name')
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as RoasterRow[];
    roasters.push(...rows);
    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return roasters;
}

function buildRoasterCoverage(coffees: CoffeeRow[]) {
  const coverage = new Map<
    string,
    { roaster: string; slug: string; total: number; missing: number }
  >();

  for (const coffee of coffees) {
    const key = coffee.roasters.slug;
    const row =
      coverage.get(key) ??
      {
        roaster: coffee.roasters.name,
        slug: coffee.roasters.slug,
        total: 0,
        missing: 0,
      };

    row.total += 1;
    if (!coffee.image_url) row.missing += 1;
    coverage.set(key, row);
  }

  return [...coverage.values()].map((row) => ({
    ...row,
    missingRatio: row.total === 0 ? 0 : row.missing / row.total,
  }));
}

async function auditOptimizerImages({
  activeRoasters,
  coffees,
  options,
}: {
  activeRoasters: RoasterRow[];
  coffees: CoffeeRow[];
  options: CliOptions;
}) {
  const siteUrl = options.siteUrl;
  if (!siteUrl || options.optimizerLimit <= 0) return [];

  const candidates = uniqueImageCandidates(coffees, activeRoasters).slice(0, options.optimizerLimit);
  const results = await mapWithConcurrency(candidates, options.concurrency, async (candidate) => {
    const result = await fetchOptimizedImage(siteUrl, candidate.imageUrl, options.timeoutMs);
    return result.ok
      ? null
      : {
          ...candidate,
          status: result.status,
          error: result.error,
        };
  });

  return results.filter((failure): failure is OptimizerFailure => Boolean(failure));
}

function uniqueImageCandidates(coffees: CoffeeRow[], activeRoasters: RoasterRow[]) {
  const seen = new Set<string>();
  const candidates: Array<Omit<OptimizerFailure, 'status' | 'error'>> = [];

  for (const roaster of activeRoasters) {
    if (!roaster.logo_url || seen.has(roaster.logo_url)) continue;
    seen.add(roaster.logo_url);
    candidates.push({
      kind: 'roaster',
      owner: roaster.name,
      slug: roaster.slug,
      imageUrl: roaster.logo_url,
    });
  }

  for (const coffee of coffees) {
    if (!coffee.image_url || seen.has(coffee.image_url)) continue;
    seen.add(coffee.image_url);
    candidates.push({
      kind: 'coffee',
      owner: `${coffee.roasters.name} / ${coffee.name}`,
      slug: coffee.slug,
      imageUrl: coffee.image_url,
    });
  }

  return candidates;
}

function countUniqueImages(coffees: CoffeeRow[], activeRoasters: RoasterRow[]) {
  return uniqueImageCandidates(coffees, activeRoasters).length;
}

async function fetchOptimizedImage(siteUrl: string, imageUrl: string, timeoutMs: number) {
  const optimizerUrl = new URL('/_next/image', siteUrl);
  optimizerUrl.searchParams.set('url', imageUrl);
  optimizerUrl.searchParams.set('w', '640');
  optimizerUrl.searchParams.set('q', '75');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(optimizerUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'TRCoffeeDBImageHealthAudit/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    if (!contentType.toLowerCase().startsWith('image/')) {
      return {
        ok: false as const,
        status: response.status,
        error: `Unexpected content-type ${contentType || 'unknown'}`,
      };
    }

    await response.arrayBuffer();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      status: null,
      error: error instanceof Error ? error.message : 'Fetch failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  fn: (item: TItem) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function printTextReport(
  summary: {
    cutoff: string;
    scannedCoffees: number;
    missingCoffeeImages: number;
    missingCoffeeImageRatio: number;
    activeRoasters: number;
    missingRoasterLogos: number;
    optimizerChecked: number;
    optimizerFailures: OptimizerFailure[];
    thresholds: {
      maxMissingCoffees: number;
      maxMissingCoffeeRatio: number;
      maxMissingRoasterLogos: number;
      maxOptimizerFailures: number;
    };
    topMissingCoffeeImagesByRoaster: Array<{
      roaster: string;
      slug: string;
      total: number;
      missing: number;
      missingRatio: number;
    }>;
    missingRoasterLogoSlugs: string[];
    failures: string[];
  },
  siteUrl: string | null
) {
  console.log('Image health audit');
  console.log(`Cutoff: ${summary.cutoff}`);
  console.log(`Public available coffees scanned: ${summary.scannedCoffees}`);
  console.log(
    `Missing coffee images: ${summary.missingCoffeeImages} (${formatPercent(
      summary.missingCoffeeImageRatio
    )}; max ${summary.thresholds.maxMissingCoffees} or ${formatPercent(
      summary.thresholds.maxMissingCoffeeRatio
    )})`
  );
  console.log(
    `Missing active roaster logos: ${summary.missingRoasterLogos}/${summary.activeRoasters} (max ${summary.thresholds.maxMissingRoasterLogos})`
  );
  console.log(
    siteUrl
      ? `Optimizer checks: ${summary.optimizerChecked}; failures: ${summary.optimizerFailures.length} (max ${summary.thresholds.maxOptimizerFailures})`
      : 'Optimizer checks: skipped (set AUDIT_IMAGES_SITE_URL or NEXT_PUBLIC_SITE_URL)'
  );

  if (summary.topMissingCoffeeImagesByRoaster.length > 0) {
    console.log('\nTop missing coffee images by roaster:');
    for (const row of summary.topMissingCoffeeImagesByRoaster.slice(0, 10)) {
      console.log(
        `- ${row.roaster} (${row.slug}): ${row.missing}/${row.total} missing (${formatPercent(
          row.missingRatio
        )})`
      );
    }
  }

  if (summary.missingRoasterLogoSlugs.length > 0) {
    console.log(`\nMissing roaster logos: ${summary.missingRoasterLogoSlugs.join(', ')}`);
  }

  if (summary.optimizerFailures.length > 0) {
    console.log('\nOptimizer failures:');
    for (const failure of summary.optimizerFailures.slice(0, 20)) {
      console.log(
        `- ${failure.kind} ${failure.owner} (${failure.slug}): ${
          failure.status ?? 'no status'
        } ${failure.error} ${failure.imageUrl}`
      );
    }
    if (summary.optimizerFailures.length > 20) {
      console.log(`Showing first 20 of ${summary.optimizerFailures.length} optimizer failures.`);
    }
  }

  if (summary.failures.length > 0) {
    console.log('\nFailing thresholds:');
    for (const failure of summary.failures) {
      console.log(`- ${failure}`);
    }
  }
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    process.env[key] ??= parseEnvValue(rawValue);
  }
}

function parseEnvValue(rawValue: string) {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    const unquoted = value.slice(1, -1);
    return quote === '"' ? unquoted.replace(/\\n/g, '\n').replace(/\\"/g, '"') : unquoted;
  }

  return value.replace(/\s+#.*$/, '');
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    concurrency: numberFromEnv('AUDIT_IMAGES_CONCURRENCY') ?? DEFAULT_CONCURRENCY,
    json: false,
    limit: numberFromEnv('AUDIT_IMAGES_LIMIT'),
    maxMissingCoffees:
      numberFromEnv('AUDIT_IMAGES_MAX_MISSING_COFFEES') ?? DEFAULT_MAX_MISSING_COFFEES,
    maxMissingCoffeeRatio:
      numberFromEnv('AUDIT_IMAGES_MAX_MISSING_COFFEE_RATIO') ??
      DEFAULT_MAX_MISSING_COFFEE_RATIO,
    maxMissingRoasterLogos:
      numberFromEnv('AUDIT_IMAGES_MAX_MISSING_ROASTER_LOGOS') ??
      DEFAULT_MAX_MISSING_ROASTER_LOGOS,
    maxOptimizerFailures:
      numberFromEnv('AUDIT_IMAGES_MAX_OPTIMIZER_FAILURES') ??
      DEFAULT_MAX_OPTIMIZER_FAILURES,
    optimizerLimit: numberFromEnv('AUDIT_IMAGES_OPTIMIZER_LIMIT') ?? DEFAULT_OPTIMIZER_LIMIT,
    siteUrl: readFirstEnv([
      'AUDIT_IMAGES_SITE_URL',
      'NEXT_PUBLIC_SITE_URL',
      'VERCEL_PROJECT_PRODUCTION_URL',
      'VERCEL_URL',
    ]),
    timeoutMs: numberFromEnv('AUDIT_IMAGES_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--concurrency':
        options.concurrency = readNumberArg(args, (index += 1), arg);
        break;
      case '--json':
        options.json = true;
        break;
      case '--limit':
        options.limit = readNumberArg(args, (index += 1), arg);
        break;
      case '--max-missing-coffees':
        options.maxMissingCoffees = readNumberArg(args, (index += 1), arg);
        break;
      case '--max-missing-coffee-ratio':
        options.maxMissingCoffeeRatio = readNumberArg(args, (index += 1), arg);
        break;
      case '--max-missing-roaster-logos':
        options.maxMissingRoasterLogos = readNumberArg(args, (index += 1), arg);
        break;
      case '--max-optimizer-failures':
        options.maxOptimizerFailures = readNumberArg(args, (index += 1), arg);
        break;
      case '--optimizer-limit':
        options.optimizerLimit = readNumberArg(args, (index += 1), arg);
        break;
      case '--site-url':
        options.siteUrl = normalizeSiteUrl(readStringArg(args, (index += 1), arg));
        break;
      case '--timeout-ms':
        options.timeoutMs = readNumberArg(args, (index += 1), arg);
        break;
      case '--help':
      case '-h':
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.concurrency = Math.max(1, Math.floor(options.concurrency));
  options.limit = options.limit === null ? null : Math.max(1, Math.floor(options.limit));
  options.maxMissingCoffees = Math.max(0, Math.floor(options.maxMissingCoffees));
  options.maxMissingCoffeeRatio = clampRatio(options.maxMissingCoffeeRatio);
  options.maxMissingRoasterLogos = Math.max(0, Math.floor(options.maxMissingRoasterLogos));
  options.maxOptimizerFailures = Math.max(0, Math.floor(options.maxOptimizerFailures));
  options.optimizerLimit = Math.max(0, Math.floor(options.optimizerLimit));
  options.siteUrl = options.siteUrl ? normalizeSiteUrl(options.siteUrl) : null;
  options.timeoutMs = Math.max(1_000, Math.floor(options.timeoutMs));

  return options;
}

function numberFromEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Env var ${name} must be a number`);
  return parsed;
}

function readFirstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  return null;
}

function readNumberArg(args: string[], index: number, flag: string) {
  const value = readStringArg(args, index, flag);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${flag} must be a number`);
  return parsed;
}

function readStringArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function normalizeSiteUrl(rawUrl: string) {
  const withProtocol = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  return new URL(withProtocol).origin;
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) throw new Error('Missing coffee image ratio must be a number');
  return Math.min(1, Math.max(0, value));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function printHelpAndExit(): never {
  console.log(`Usage: npm run audit:images -- [options]

Options:
  --concurrency <n>                   Image optimizer requests to run at once (default: ${DEFAULT_CONCURRENCY})
  --json                              Print machine-readable JSON
  --limit <n>                         Audit only the newest n public available coffees
  --max-missing-coffees <n>           Fail above this missing coffee image count (default: ${DEFAULT_MAX_MISSING_COFFEES})
  --max-missing-coffee-ratio <n>      Fail above this missing coffee image ratio, 0-1 (default: ${DEFAULT_MAX_MISSING_COFFEE_RATIO})
  --max-missing-roaster-logos <n>     Fail above this missing active roaster logo count (default: ${DEFAULT_MAX_MISSING_ROASTER_LOGOS})
  --max-optimizer-failures <n>        Fail above this optimized image failure count (default: ${DEFAULT_MAX_OPTIMIZER_FAILURES})
  --optimizer-limit <n>               Max unique non-null images to probe through /_next/image; 0 disables (default: ${DEFAULT_OPTIMIZER_LIMIT})
  --site-url <url>                    Site origin to use for /_next/image checks
  --timeout-ms <n>                    Per-image optimizer fetch timeout (default: ${DEFAULT_TIMEOUT_MS})

Environment:
  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY
  AUDIT_IMAGES_* equivalents for all thresholds/options
`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
