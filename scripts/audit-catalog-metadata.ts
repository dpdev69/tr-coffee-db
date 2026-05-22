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
  | 'id'
  | 'slug'
  | 'name'
  | 'origin_country'
  | 'process'
  | 'roast_level'
  | 'product_url'
  | 'last_seen_at'
> & {
  roasters: {
    name: string;
    slug: string;
  };
};

type CandidateValue = string;

type CandidateDefinition<TValue extends CandidateValue> = {
  value: TValue;
  label: string;
  patterns: RegExp[];
};

type CandidateHit<TValue extends CandidateValue> = {
  value: TValue;
  label: string;
  evidence: string;
  index: number;
};

type IssueSeverity = 'high' | 'medium';

type AuditIssue = {
  severity: IssueSeverity;
  type:
    | 'origin_country_mismatch'
    | 'origin_country_missing'
    | 'process_mismatch'
    | 'process_missing'
    | 'roast_level_mismatch'
    | 'roast_level_missing';
  coffee: {
    id: string;
    slug: string;
    name: string;
    roaster: string;
  };
  stored: string | null;
  page: string[];
  evidence: string;
  productUrl: string;
};

type FetchFailure = {
  coffee: CoffeeRow;
  status: number | null;
  error: string;
};

type CliOptions = {
  concurrency: number;
  failOnIssues: boolean;
  json: boolean;
  limit: number | null;
  maxIssues: number;
  timeoutMs: number;
};

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ISSUES = 100;
const PAGE_SIZE = 200;
const MAX_HTML_BYTES = 2_500_000;

const PROCESS_DEFINITIONS = [
  defineCandidate('anaerobic', 'anaerobic', [
    '(?:islem|process|processing)\\s*:?\\s*(?:natural|washed|yikanmis|dogal)\\s+anaerobic',
    '(?:islem|process|processing)\\s*:?\\s*(?:natural|washed|yikanmis|dogal)\\s+anaerobik',
    '(?:islem|process|processing)\\s*:?\\s*(?:natural|washed|yikanmis|dogal)\\s+carbonic\\s*maceration',
    '(?:islem|process|processing)\\s*:?\\s*anaerobic',
    '(?:islem|process|processing)\\s*:?\\s*anaerobik',
    '(?:islem|process|processing)\\s*:?\\s*carbonic\\s*maceration',
    '(?:islem|process|processing)\\s*:?\\s*karbonik\\s*maserasyon',
    '(?:islem|process|processing)\\s*:?\\s*karbik\\s*maserasyon',
  ]),
  defineCandidate('experimental', 'experimental', [
    '(?:islem|process|processing)\\s*:?\\s*experimental',
    '(?:islem|process|processing)\\s*:?\\s*deneysel',
    '(?:islem|process|processing)\\s*:?\\s*double\\s*ferment(?:ation)?',
    '(?:islem|process|processing)\\s*:?\\s*extended\\s*ferment(?:ation)?',
    '(?:islem|process|processing)\\s*:?\\s*lactic',
    '(?:islem|process|processing)\\s*:?\\s*thermal\\s*shock',
  ]),
  defineCandidate('semi_washed', 'semi-washed', [
    '(?:islem|process|processing)\\s*:?\\s*semi\\s*washed',
    '(?:islem|process|processing)\\s*:?\\s*semi-washed',
    '(?:islem|process|processing)\\s*:?\\s*yari\\s*yikanmis',
    '(?:islem|process|processing)\\s*:?\\s*yari\\s*yikama',
  ]),
  defineCandidate('wet_hulled', 'wet-hulled', [
    '(?:islem|process|processing)\\s*:?\\s*wet\\s*hulled',
    '(?:islem|process|processing)\\s*:?\\s*wet-hulled',
    '(?:islem|process|processing)\\s*:?\\s*giling\\s*basah',
  ]),
  defineCandidate('honey', 'honey', [
    '(?:islem|process|processing)\\s*:?\\s*honey',
    '(?:islem|process|processing)\\s*:?\\s*bal\\s*islem',
    '(?:islem|process|processing)\\s*:?\\s*pulped\\s*natural',
  ]),
  defineCandidate('washed', 'washed', [
    '(?:islem|process|processing)\\s*:?\\s*washed',
    '(?:islem|process|processing)\\s*:?\\s*fully\\s*washed',
    '(?:islem|process|processing)\\s*:?\\s*yikanmis',
  ]),
  defineCandidate('natural', 'natural', [
    '(?:islem|process|processing)\\s*:?\\s*natural',
    '(?:islem|process|processing)\\s*:?\\s*naturel',
    '(?:islem|process|processing)\\s*:?\\s*dogal',
    '(?:islem|process|processing)\\s*:?\\s*kuru\\s*islem',
  ]),
] as const;

const ROAST_DEFINITIONS = [
  defineCandidate('medium_light', 'medium-light', [
    'medium\\s*light',
    'medium-light',
    'orta\\s*acik',
    'orta-acik',
    'acik\\s*orta',
    'acik-orta',
  ]),
  defineCandidate('medium_dark', 'medium-dark', [
    'medium\\s*dark',
    'medium-dark',
    'orta\\s*koyu',
    'orta-koyu',
    'espresso\\s*(?:roast|kavrum|kavurma)',
    '(?:kavrum|kavurma)\\s*:?\\s*espresso',
  ]),
  defineCandidate('light', 'light', [
    'light\\s*roast',
    'filter\\s*roast',
    'filter\\s*profile',
    'filtre\\s*(?:kavrum|kavurma)',
    '(?:kavrum|kavurma)\\s*:?\\s*filtre',
    'acik\\s*(?:kavrum|kavurma)',
  ]),
  defineCandidate('medium', 'medium', [
    'medium\\s*roast',
    'orta\\s*(?:kavrum|kavurma)',
    '(?:kavrum|kavurma)\\s*:?\\s*orta',
  ]),
  defineCandidate('dark', 'dark', [
    'dark\\s*roast',
    'french\\s*roast',
    'koyu\\s*(?:kavrum|kavurma)',
    '(?:kavrum|kavurma)\\s*:?\\s*koyu',
  ]),
] as const;

const ORIGIN_DEFINITIONS = [
  defineCandidate('Ethiopia', 'Ethiopia', ['ethiopia', 'ethiopian', 'etiyopya']),
  defineCandidate('Colombia', 'Colombia', ['colombia', 'colombian', 'kolombiya']),
  defineCandidate('Brazil', 'Brazil', ['brazil', 'brazilian', 'brasil', 'brezilya']),
  defineCandidate('Kenya', 'Kenya', ['kenya', 'kenyan']),
  defineCandidate('Guatemala', 'Guatemala', ['guatemala', 'guatemalan']),
  defineCandidate('Costa Rica', 'Costa Rica', ['costa\\s*rica', 'kosta\\s*rika', 'kostarika']),
  defineCandidate('Panama', 'Panama', ['panama', 'panamanian']),
  defineCandidate('Peru', 'Peru', ['peru', 'peruvian']),
  defineCandidate('Honduras', 'Honduras', ['honduras', 'honduran']),
  defineCandidate('El Salvador', 'El Salvador', ['el\\s*salvador', 'salvadoran']),
  defineCandidate('Mexico', 'Mexico', ['mexico', 'mexican', 'meksika']),
  defineCandidate('Indonesia', 'Indonesia', ['indonesia', 'indonesian', 'endonezya', 'sumatra']),
  defineCandidate('Rwanda', 'Rwanda', ['rwanda', 'rwandan', 'ruanda']),
  defineCandidate('Burundi', 'Burundi', ['burundi', 'burundian']),
  defineCandidate('Tanzania', 'Tanzania', ['tanzania', 'tanzanian', 'tanzanya']),
  defineCandidate('Uganda', 'Uganda', ['uganda', 'ugandan']),
  defineCandidate('Nicaragua', 'Nicaragua', ['nicaragua', 'nikaragua']),
  defineCandidate('Bolivia', 'Bolivia', ['bolivia', 'bolivya']),
  defineCandidate('Ecuador', 'Ecuador', ['ecuador', 'ekvador']),
  defineCandidate('India', 'India', ['india', 'indian', 'hindistan']),
  defineCandidate('Yemen', 'Yemen', ['yemen', 'yemeni']),
  defineCandidate('DR Congo', 'DR Congo', ['dr\\s*congo', 'drc', 'congo', 'kongo']),
  defineCandidate('Dominican Republic', 'Dominican Republic', ['dominican', 'dominik']),
  defineCandidate('Cuba', 'Cuba', ['cuba', 'kuba']),
  defineCandidate('Papua New Guinea', 'Papua New Guinea', ['papua\\s*new\\s*guinea']),
  defineCandidate('China', 'China', ['china', 'chinese', 'yunnan', 'cin']),
  defineCandidate('Myanmar', 'Myanmar', ['myanmar', 'burma']),
  defineCandidate('Vietnam', 'Vietnam', ['vietnam']),
] as const;

const ROAST_COMPATIBILITY: Record<string, Set<string>> = {
  light: new Set(['light']),
  medium_light: new Set(['light', 'medium_light', 'medium']),
  medium: new Set(['medium_light', 'medium', 'medium_dark']),
  medium_dark: new Set(['medium', 'medium_dark', 'dark']),
  dark: new Set(['dark']),
  unknown: new Set(['unknown']),
};

async function main() {
  const options = parseArgs(process.argv.slice(2));

  loadEnvLocal();

  const supabaseUrl = readRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
  const currentCutoff = getCurrentCatalogCutoffIso();
  const coffees = await fetchPublicAvailableCoffees(supabase, currentCutoff, options.limit);

  if (!options.json) {
    console.error(
      `Auditing ${coffees.length} public available coffees with concurrency ${options.concurrency}...`
    );
  }

  let completed = 0;
  const results = await mapWithConcurrency(coffees, options.concurrency, async (coffee) => {
    const result = await auditCoffee(coffee, options.timeoutMs);
    completed += 1;
    if (!options.json && (completed % 25 === 0 || completed === coffees.length)) {
      console.error(`Fetched ${completed}/${coffees.length} product pages...`);
    }
    return result;
  });

  const issues = results.flatMap((result) => result.issues);
  const fetchFailures = results
    .map((result) => result.fetchFailure)
    .filter((failure): failure is FetchFailure => Boolean(failure));

  const summary = {
    cutoff: currentCutoff,
    scanned: coffees.length,
    fetched: coffees.length - fetchFailures.length,
    fetchFailures,
    issues,
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printTextReport(summary, options.maxIssues);
  }

  if (options.failOnIssues && issues.length > 0) {
    process.exitCode = 1;
  }
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
      .select(
        'id, slug, name, origin_country, process, roast_level, product_url, last_seen_at, roasters!inner(name, slug)'
      )
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

async function auditCoffee(coffee: CoffeeRow, timeoutMs: number) {
  const fetched = await fetchProductPage(coffee.product_url, timeoutMs);
  if (!fetched.ok) {
    return {
      issues: [],
      fetchFailure: {
        coffee,
        status: fetched.status,
        error: fetched.error,
      },
    };
  }

  const pageText = htmlToText(fetched.html);
  const searchableText = normalizeForSearch(pageText);
  const issues = [
    ...auditProcess(coffee, pageText, searchableText),
    ...auditRoastLevel(coffee, pageText, searchableText),
    ...auditOriginCountry(coffee, pageText, searchableText),
  ];

  return {
    issues,
    fetchFailure: null,
  };
}

function auditProcess(coffee: CoffeeRow, pageText: string, searchableText: string): AuditIssue[] {
  const candidates = detectCandidates(PROCESS_DEFINITIONS, pageText, searchableText);
  return auditEnumField({
    candidates,
    coffee,
    fieldName: 'process',
    missingType: 'process_missing',
    mismatchType: 'process_mismatch',
    stored: coffee.process,
  });
}

function auditRoastLevel(coffee: CoffeeRow, pageText: string, searchableText: string): AuditIssue[] {
  const candidates = detectCandidates(ROAST_DEFINITIONS, pageText, searchableText);
  return auditEnumField({
    candidates,
    coffee,
    fieldName: 'roast_level',
    isCompatible: (stored, detected) => ROAST_COMPATIBILITY[stored]?.has(detected) ?? stored === detected,
    missingType: 'roast_level_missing',
    mismatchType: 'roast_level_mismatch',
    stored: coffee.roast_level,
  });
}

function auditOriginCountry(
  coffee: CoffeeRow,
  pageText: string,
  searchableText: string
): AuditIssue[] {
  const candidates = detectCandidates(ORIGIN_DEFINITIONS, pageText, searchableText);
  const stored = coffee.origin_country;

  if (!stored) {
    if (candidates.length === 0) return [];

    return [
      createIssue({
        candidates,
        coffee,
        severity: candidates.length === 1 ? 'high' : 'medium',
        stored,
        type: 'origin_country_missing',
      }),
    ];
  }

  if (candidates.length === 0) return [];

  const storedKey = normalizeCountryKey(stored);
  const hasStoredCountry = candidates.some((candidate) => normalizeCountryKey(candidate.value) === storedKey);

  if (hasStoredCountry || candidates.length > 2) return [];

  return [
    createIssue({
      candidates,
      coffee,
      severity: candidates.length === 1 ? 'high' : 'medium',
      stored,
      type: 'origin_country_mismatch',
    }),
  ];
}

function auditEnumField<TValue extends string>({
  candidates,
  coffee,
  fieldName,
  isCompatible = (stored, detected) => stored === detected,
  missingType,
  mismatchType,
  stored,
}: {
  candidates: CandidateHit<TValue>[];
  coffee: CoffeeRow;
  fieldName: 'process' | 'roast_level';
  isCompatible?: (stored: string, detected: TValue) => boolean;
  missingType: AuditIssue['type'];
  mismatchType: AuditIssue['type'];
  stored: string | null;
}): AuditIssue[] {
  const knownStored = stored && stored !== 'unknown' ? stored : null;

  if (!knownStored) {
    if (candidates.length !== 1) return [];

    return [
      createIssue({
        candidates,
        coffee,
        severity: 'high',
        stored,
        type: missingType,
      }),
    ];
  }

  if (candidates.length === 0 || candidates.length > 2) return [];

  const hasCompatibleCandidate = candidates.some((candidate) => isCompatible(knownStored, candidate.value));
  if (hasCompatibleCandidate) return [];

  return [
    createIssue({
      candidates,
      coffee,
      severity: candidates.length === 1 ? 'high' : 'medium',
      stored: `${fieldName}=${knownStored}`,
      type: mismatchType,
    }),
  ];
}

function createIssue<TValue extends string>({
  candidates,
  coffee,
  severity,
  stored,
  type,
}: {
  candidates: CandidateHit<TValue>[];
  coffee: CoffeeRow;
  severity: IssueSeverity;
  stored: string | null;
  type: AuditIssue['type'];
}): AuditIssue {
  const firstCandidate = candidates[0];

  return {
    severity,
    type,
    coffee: {
      id: coffee.id,
      slug: coffee.slug,
      name: coffee.name,
      roaster: coffee.roasters.name,
    },
    stored,
    page: candidates.map((candidate) => candidate.label),
    evidence: firstCandidate?.evidence ?? '',
    productUrl: coffee.product_url,
  };
}

async function fetchProductPage(url: string, timeoutMs: number) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return {
      ok: false as const,
      status: null,
      error: error instanceof Error ? error.message : 'Invalid product URL',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'user-agent':
          'TRCoffeeDBMetadataAudit/1.0 (+https://trcoffeedb.local; internal data quality check)',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    return {
      ok: true as const,
      html: html.slice(0, MAX_HTML_BYTES),
      status: response.status,
    };
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

function detectCandidates<TValue extends string>(
  definitions: readonly CandidateDefinition<TValue>[],
  pageText: string,
  searchableText: string
) {
  return definitions
    .map((definition) => {
      let bestMatch: CandidateHit<TValue> | null = null;

      for (const pattern of definition.patterns) {
        const match = pattern.exec(searchableText);
        if (match?.index == null) continue;

        if (!bestMatch || match.index < bestMatch.index) {
          bestMatch = {
            value: definition.value,
            label: definition.label,
            evidence: snippet(pageText, match.index),
            index: match.index,
          };
        }
      }

      return bestMatch;
    })
    .filter((candidate): candidate is CandidateHit<TValue> => Boolean(candidate))
    .sort((left, right) => left.index - right.index);
}

function defineCandidate<TValue extends string>(
  value: TValue,
  label: string,
  patterns: string[]
): CandidateDefinition<TValue> {
  return {
    value,
    label,
    patterns: patterns.map((pattern) => tokenRegex(pattern)),
  };
}

function tokenRegex(source: string) {
  return new RegExp(`(?:^|[^a-z0-9])(${source})(?=$|[^a-z0-9])`, 'i');
}

function htmlToText(html: string) {
  const structuredText = [
    extractTitleText(html),
    extractMetaText(html),
    extractJsonLdText(html),
  ].join(' ');
  const bodyText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(`${structuredText} ${bodyText}`).replace(/\s+/g, ' ').trim();
}

function extractTitleText(html: string) {
  return [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => match[1])
    .join(' ');
}

function extractMetaText(html: string) {
  return (html.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) =>
      /\b(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["']/i.test(
        tag
      )
    )
    .map((tag) => tag.match(/\bcontent=(["'])(.*?)\1/i)?.[2] ?? '')
    .join(' ');
}

function extractJsonLdText(html: string) {
  return [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ]
    .map((match) => match[1])
    .join(' ');
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_entity, codepoint: string) => String.fromCodePoint(Number(codepoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_entity, codepoint: string) =>
      String.fromCodePoint(Number.parseInt(codepoint, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity);
}

function normalizeForSearch(value: string) {
  return value
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

function normalizeCountryKey(value: string) {
  return normalizeForSearch(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function snippet(text: string, index: number) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + 160);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';

  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
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
    scanned: number;
    fetched: number;
    fetchFailures: FetchFailure[];
    issues: AuditIssue[];
  },
  maxIssues: number
) {
  const byType = countBy(summary.issues, (issue) => issue.type);

  console.log('Catalog metadata quality audit');
  console.log(`Cutoff: ${summary.cutoff}`);
  console.log(`Scanned: ${summary.scanned}`);
  console.log(`Fetched: ${summary.fetched}`);
  console.log(`Fetch failures: ${summary.fetchFailures.length}`);
  console.log(`Likely metadata issues: ${summary.issues.length}`);

  if (summary.issues.length > 0) {
    console.log('\nIssue counts:');
    for (const [type, count] of Object.entries(byType).sort((left, right) => right[1] - left[1])) {
      console.log(`- ${type}: ${count}`);
    }

    console.log('\nIssues:');
    for (const issue of summary.issues.slice(0, maxIssues)) {
      console.log(`\n[${issue.severity.toUpperCase()}] ${issue.type}`);
      console.log(`Coffee: ${issue.coffee.roaster} / ${issue.coffee.name} (${issue.coffee.slug})`);
      console.log(`Stored: ${issue.stored ?? 'null/unknown'}`);
      console.log(`Page hints: ${issue.page.join(', ')}`);
      console.log(`Evidence: ${issue.evidence}`);
      console.log(`URL: ${issue.productUrl}`);
    }

    if (summary.issues.length > maxIssues) {
      console.log(`\nShowing first ${maxIssues} of ${summary.issues.length} issues.`);
    }
  }

  if (summary.fetchFailures.length > 0) {
    console.log('\nFetch failures:');
    for (const failure of summary.fetchFailures.slice(0, 20)) {
      console.log(
        `- ${failure.coffee.roasters.name} / ${failure.coffee.name}: ${
          failure.status ?? 'no status'
        } ${failure.error} (${failure.coffee.product_url})`
      );
    }
    if (summary.fetchFailures.length > 20) {
      console.log(`Showing first 20 of ${summary.fetchFailures.length} fetch failures.`);
    }
  }
}

function countBy<TItem>(items: TItem[], keyFor: (item: TItem) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');

  if (!existsSync(envPath)) {
    throw new Error(`Expected .env.local at ${envPath}`);
  }

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

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    concurrency: numberFromEnv('AUDIT_METADATA_CONCURRENCY') ?? DEFAULT_CONCURRENCY,
    failOnIssues: false,
    json: false,
    limit: numberFromEnv('AUDIT_METADATA_LIMIT'),
    maxIssues: numberFromEnv('AUDIT_METADATA_MAX_ISSUES') ?? DEFAULT_MAX_ISSUES,
    timeoutMs: numberFromEnv('AUDIT_METADATA_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--concurrency':
        options.concurrency = readNumberArg(args, (index += 1), arg);
        break;
      case '--fail-on-issues':
        options.failOnIssues = true;
        break;
      case '--help':
      case '-h':
        printHelpAndExit();
        break;
      case '--json':
        options.json = true;
        break;
      case '--limit':
        options.limit = readNumberArg(args, (index += 1), arg);
        break;
      case '--max-issues':
        options.maxIssues = readNumberArg(args, (index += 1), arg);
        break;
      case '--timeout-ms':
        options.timeoutMs = readNumberArg(args, (index += 1), arg);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.concurrency = Math.max(1, options.concurrency);
  options.timeoutMs = Math.max(1_000, options.timeoutMs);
  options.maxIssues = Math.max(1, options.maxIssues);
  if (options.limit !== null) options.limit = Math.max(1, options.limit);

  return options;
}

function numberFromEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Env var ${name} must be a number`);
  return parsed;
}

function readNumberArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`${flag} requires a number`);

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${flag} must be a number`);
  return parsed;
}

function printHelpAndExit(): never {
  console.log(`Usage: npm run audit:metadata -- [options]

Options:
  --concurrency <n>   Product pages to fetch at once (default: ${DEFAULT_CONCURRENCY})
  --fail-on-issues    Exit 1 when metadata issues are found
  --json              Print machine-readable JSON
  --limit <n>         Audit only the newest n public available coffees
  --max-issues <n>    Max text issues to print (default: ${DEFAULT_MAX_ISSUES})
  --timeout-ms <n>    Product page fetch timeout (default: ${DEFAULT_TIMEOUT_MS})
`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
