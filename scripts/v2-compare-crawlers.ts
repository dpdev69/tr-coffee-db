/** Read-only source probes. Never invokes legacy run(), and never writes a remote DB. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_ROASTER_CONFIGS } from '../scrapers/src/roasters/configs.js';
import { crawlRoaster } from '../scrapers/src/v2/crawl.js';
import { compareSnapshots } from '../scrapers/src/v2/compare.js';
import type { RawProduct } from '../scrapers/src/types.js';

type LegacyRow = Record<string, unknown>;
function legacyRaw(row: LegacyRow): RawProduct {
  return { externalId: String(row.external_id), name: String(row.name), description: '',
    price: typeof row.price_amount === 'number' ? row.price_amount : null, currency: String(row.price_currency ?? 'TRY'),
    weightGrams: typeof row.weight_grams === 'number' ? row.weight_grams : null,
    imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
    productUrl: String(row.product_url), isAvailable: row.is_available === true };
}
export async function compareLiveSources(slugs: string[], root = process.cwd()) {
  const snapshot = JSON.parse(await readFile(resolve(root, '.local/v2/source.json'), 'utf8')) as {
    completedAt: string; tables: { roasters: LegacyRow[]; coffees: LegacyRow[] };
  };
  const directory = resolve(root, '.local/v2/crawls');
  await mkdir(directory, { recursive: true });
  const summaries = [];
  for (const slug of slugs) {
    const config = ALL_ROASTER_CONFIGS.find(item => item.slug === slug);
    if (!config) throw new Error(`Unknown roaster: ${slug}`);
    const startedAt = new Date().toISOString();
    const responses: Array<{ url: string; requestBody?: string; status: number; body: string; headers: Record<string, string> }> = [];
    const captureFetch: typeof fetch = async (url, init) => {
      const response = await fetch(url, init);
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 5_000_000) { await reader.cancel(); throw new Error('Captured source response exceeded 5 MB.'); }
        chunks.push(chunk.value);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const headers = Object.fromEntries(['content-type', 'x-wp-totalpages', 'location', 'retry-after'].flatMap(key => response.headers.has(key) ? [[key, response.headers.get(key)!]] : []));
      responses.push({ url: String(url), requestBody: typeof init?.body === 'string' ? init.body : undefined, status: response.status, body, headers });
      return new Response(body, { status: response.status, headers: response.headers });
    };
    const next = await crawlRoaster(config, { fetch: captureFetch, maxRequests: 250, maxPages: 20, timeoutMs: 20_000, requestDelayMs: 500 });
    const completedAt = new Date().toISOString();
    const roaster = snapshot.tables.roasters.find(row => row.slug === slug);
    const previous = snapshot.tables.coffees.filter(row => row.roaster_id === roaster?.id);
    const comparison = compareSnapshots(previous.map(legacyRaw), next, config);
    const offers = next.products.flatMap(product => product.offers);
    const summary = { slug, startedAt, completedAt, requestPolicy: { maxRequests: 250, maxPages: 20, timeoutMs: 20_000, requestDelayMs: 500 }, legacyExportCompletedAt: snapshot.completedAt,
      complete: next.complete, legacyProducts: previous.length, legacyAvailable: previous.filter(row => row.is_available).length,
      products: next.products.length, offers: offers.length, inStock: offers.filter(offer => offer.inStock === true).length,
      unknownWeight: offers.filter(offer => offer.weightG === null).length, unknownPrice: offers.filter(offer => offer.price === null).length,
      unknownStock: offers.filter(offer => offer.inStock === null).length,
      differences: Object.fromEntries([...new Set(comparison.differences.map(item => item.kind))].map(kind => [kind, comparison.differences.filter(item => item.kind === kind).length])), diagnostics: next.diagnostics };
    const file = resolve(directory, `${startedAt.replace(/[:.]/g, '-')}-${slug}.json`);
    await writeFile(file, JSON.stringify({ summary, snapshot: next, comparison, responses }, null, 2));
    console.log(JSON.stringify({ ...summary, file }));
    summaries.push(summary);
  }
  return summaries;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const slugs = process.argv.slice(2);
  if (slugs[0] === '--reparse') {
    for (const path of slugs.slice(1)) console.log(JSON.stringify(await reparseCapture(resolve(path))));
  } else if (slugs[0] === '--replay') {
    for (const path of slugs.slice(1)) { const report = await replayLegacyCapture(resolve(path)); console.log(JSON.stringify({ file: path, products: report.legacyProducts, parity: report.parity, replayComplete: report.replayComplete, offers: report.comparison.v2Offers, differences: report.comparison.differences.length, synthesizedTerminalPage: report.synthesizedTerminalPage })); }
  } else if (!slugs.length) throw new Error('Provide explicit roaster slugs; broad source crawling is intentionally not the default.');
  else await compareLiveSources(slugs);
}

/** Replay captured public responses through the untouched legacy fetchProducts() only.
 * All axios requests must resolve from capture; never calls run() or a live DB.
 */
export async function replayLegacyCapture(captureFile: string) {
  const captured = JSON.parse(await readFile(captureFile, 'utf8'));
  const slug: string = captured.summary.slug;
  const config = ALL_ROASTER_CONFIGS.find(item => item.slug === slug)!;
  if (!['shopify', 'woocommerce'].includes(config.platform) && config.structuredDataParser !== 'parsa-catalog') throw new Error('Replay is limited to public JSON adapter families.');
  process.env.SUPABASE_URL ??= 'https://snapshot-only.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'snapshot-only-no-database-access';
  const axios = (await import('../scrapers/node_modules/axios/index.js')).default;
  const originalGet = axios.get;
  const calls: string[] = [];
  const missingRequests: string[] = [];
  let synthesizedTerminalPage = false;
  try {
    axios.get = (async (input: string, options?: { params?: Record<string, string | number> }) => {
      const url = new URL(input);
      for (const [key, value] of Object.entries(options?.params ?? {})) url.searchParams.set(key, String(value));
      url.searchParams.sort();
      calls.push(url.toString());
      const entry = captured.responses.find((response: { url: string }) => { const recorded = new URL(response.url); recorded.searchParams.sort(); return recorded.toString() === url.toString(); });
      if (entry) {
        if (entry.status !== 200) throw new Error('Replay rejects captured failed/challenged responses.');
        return { data: JSON.parse(entry.body), headers: entry.headers };
      }
      // Shopify legacy always requests an empty next page. A short captured page
      // already establishes the documented pagination boundary; no network fallback.
      if (config.platform === 'shopify' && url.searchParams.get('page') === '2') {
        const first = captured.responses[0];
        if (JSON.parse(first.body).products.length < 250) { synthesizedTerminalPage = true; return { data: { products: [] }, headers: {} }; }
      }
      missingRequests.push(url.toString());
      throw new Error('Replay requested a response not present in the captured snapshot.');
    }) as typeof axios.get;
    const adapter = config.platform === 'shopify'
      ? new (await import('../scrapers/src/adapters/shopify-adapter.js')).ShopifyAdapter(config)
      : config.platform === 'woocommerce'
        ? new (await import('../scrapers/src/adapters/woocommerce-adapter.js')).WooCommerceAdapter(config)
        : new (await import('../scrapers/src/adapters/parsa-adapter.js')).ParsaAdapter(config);
    const products = await adapter.fetchProducts();
    const comparison = compareSnapshots(products, captured.snapshot, config);
    const parity = { selectedTuplesPresent: 0, selectedTuplesMissing: 0, sourceVariantsChecked: 0, variantFieldDifferences: 0 };
    for (const old of products) {
      const current = captured.snapshot.products.find((product: { sourceProductId: string; canonicalUrl: string }) => product.sourceProductId === old.externalId || product.canonicalUrl === old.productUrl);
      if (!current) { parity.selectedTuplesMissing++; continue; }
      if (current.offers.some((offer: { price: number; weightG: number; inStock: boolean }) => offer.price === old.price && offer.weightG === old.weightGrams && offer.inStock === old.isAvailable)) parity.selectedTuplesPresent++;
      else parity.selectedTuplesMissing++;
      for (const variant of old.variants ?? []) {
        const offer = current.offers.find((offer: { sourceVariantId: string }) => offer.sourceVariantId === variant.id);
        parity.sourceVariantsChecked++;
        if (!offer || offer.price !== variant.price || offer.weightG !== variant.weightGrams || offer.inStock !== variant.isAvailable) parity.variantFieldDifferences++;
      }
    }
    const report = { replayComplete: missingRequests.length === 0, missingRequests, method: 'legacy fetchProducts replay of captured public JSON; no network fallback, no run(), no DB writes', synthesizedTerminalPage,
      parity, sourceStartedAt: captured.summary.startedAt, sourceCompletedAt: captured.summary.completedAt, calls: calls.length,
      legacyProducts: products.length, legacyAvailable: products.filter(product => product.isAvailable).length,
      comparison, legacyRawProducts: products };
    await writeFile(captureFile.replace(/\.json$/, '-replay.json'), JSON.stringify(report, null, 2));
    return report;
  } finally { axios.get = originalGet; }
}

/** Re-evaluate a source capture after a parser correction without hitting the roaster again. */
export async function reparseCapture(captureFile: string) {
  const captured = JSON.parse(await readFile(captureFile, 'utf8'));
  const config = ALL_ROASTER_CONFIGS.find(item => item.slug === captured.summary.slug)!;
  const recordedFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); url.searchParams.sort();
    const response = captured.responses.find((entry: { url: string; requestBody?: string }) => { const recorded = new URL(entry.url); recorded.searchParams.sort(); return recorded.toString() === url.toString() && entry.requestBody === init?.body; });
    if (!response) throw new Error('Reparse requested an uncaptured URL; source completeness cannot be certified.');
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
  const next = await crawlRoaster(config, { fetch: recordedFetch, maxRequests: 250, maxPages: 20, requestDelayMs: 0, sleep: async () => {} });
  const source = JSON.parse(await readFile(resolve('.local/v2/source.json'), 'utf8'));
  const roaster = source.tables.roasters.find((row: LegacyRow) => row.slug === config.slug);
  const old = source.tables.coffees.filter((row: LegacyRow) => row.roaster_id === roaster.id).map(legacyRaw);
  const offers = next.products.flatMap(product => product.offers);
  const comparison = compareSnapshots(old, next, config);
  const file = captureFile.replace(/\.json$/, '-reparsed.json');
  const summary = { ...captured.summary, complete: next.complete, products: next.products.length, offers: offers.length,
    inStock: offers.filter(offer => offer.inStock === true).length, unknownWeight: offers.filter(offer => offer.weightG === null).length,
    unknownPrice: offers.filter(offer => offer.price === null).length, unknownStock: offers.filter(offer => offer.inStock === null).length,
    differences: Object.fromEntries([...new Set(comparison.differences.map(item => item.kind))].map(kind => [kind, comparison.differences.filter(item => item.kind === kind).length])), diagnostics: next.diagnostics };
  await writeFile(file, JSON.stringify({ ...captured, summary, snapshot: next, comparison, reparsedAt: new Date().toISOString(), originalCapture: captureFile }, null, 2));
  return { file, summary };
}
