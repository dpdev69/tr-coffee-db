import { load } from 'cheerio';
import { isLikelyCatalogCoffeeProduct } from '../product-classification.js';
import type { RoasterConfig } from '../types.js';
import { canonicalUrl, list, record, requiredText, sourceId } from './primitives.js';
import { isWooCoffee, ikasCatalogContext, IKAS_CATALOG_QUERY, parseIkasProducts, parseParsaProduct, parseProbadorCatalog, parseTicimaxProduct, choOptions, parseChoProduct, parseIdeaProduct, parseKronotropProduct, parseMilestonesProduct, parseKafeinProduct, parseShopifyPage, parseStructuredProductPage, parseWooProduct } from './parsers.js';
import type { SourceCoffee, SourceCrawl } from './types.js';

/** Bump whenever a parser, crawl-side filter or roaster config change alters which products a crawl discovers:
 * a coffee first seen in the first run after a bump is not evidence of a new arrival (shared/v2/catalog.ts GENUINE_NEW). */
export const PARSER_VERSION = 'v2-source-6-origin-evidence';
/** The crawler's one honest identity, sent on every request, direct or relayed. */
export const CRAWLER_HEADERS = { 'User-Agent': 'CoffeeDiscovery/2.0 (public coffee catalog; no challenge bypass)', Accept: 'application/json,text/html' };

export interface CrawlOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  requestDelayMs?: number;
  maxRequests?: number;
  maxPages?: number;
  timeoutMs?: number;
}

/** No persistence, secrets, challenge execution, or global fetch mocking. */
export async function crawlRoaster(config: RoasterConfig, options: CrawlOptions = {}): Promise<SourceCrawl> {
  const result: SourceCrawl = { roasterSlug: config.slug, parserVersion: PARSER_VERSION, complete: false, products: [], diagnostics: [] };
  const request = createFetcher(config, options, seconds => { result.retryAfterSeconds = seconds; });
  const maxPages = bounded(options.maxPages ?? 20, 1, 100);
  try {
    if (config.platform === 'shopify') {
      const base = config.collectionHandle ? `${config.shopUrl}/collections/${config.collectionHandle}/products.json` : `${config.shopUrl}/products.json`;
      for (let page = 1; page <= maxPages; page++) {
        const response = await request(`${base}?limit=250&page=${page}`);
        const payload: unknown = JSON.parse(response.body);
        const entries = list(record(payload).products);
        appendDistinct(result.products, parseShopifyPage(payload, config));
        if (entries.length < 250) { result.complete = true; break; }
      }
      if (!result.complete) throw new Error('Pagination limit reached before Shopify discovery completed.');
    } else if (config.platform === 'woocommerce') {
      let totalPages: number | null = null;
      for (let page = 1; page <= maxPages; page++) {
        const url = new URL('/wp-json/wc/store/v1/products', config.shopUrl);
        url.searchParams.set('per_page', '100'); url.searchParams.set('page', String(page));
        if (config.categoryId) url.searchParams.set('category', String(config.categoryId));
        const response = await request(url.toString());
        const entries = list(JSON.parse(response.body));
        const header = response.headers.get('x-wp-totalpages');
        if (header != null) {
          const observed = Number(header);
          if (!Number.isInteger(observed) || observed < 0 || (totalPages != null && totalPages !== observed)) throw new Error('WooCommerce pagination changed or is invalid.');
          totalPages = observed;
        }
        const coffees = entries.map(record).filter(product => isWooCoffee(product, config));
        const ids = [...new Set(coffees.flatMap(product => (product.variations == null ? [] : list(product.variations)).map(reference => {
          const id = sourceId(record(reference).id);
          if (!id) throw new Error('Missing WooCommerce variation ID.');
          return id;
        })))];
        const variations = new Map<string, unknown>();
        for (let offset = 0; offset < ids.length; offset += 100) {
          const requested = ids.slice(offset, offset + 100);
          const variantUrl = new URL('/wp-json/wc/store/v1/products', config.shopUrl);
          variantUrl.searchParams.set('type', 'variation'); variantUrl.searchParams.set('per_page', '100');
          variantUrl.searchParams.set('include', requested.join(','));
          const details = list(JSON.parse((await request(variantUrl.toString())).body));
          for (const detail of details) {
            const id = sourceId(record(detail).id);
            if (!id || !requested.includes(id) || variations.has(id)) throw new Error('Unexpected or duplicate WooCommerce variation.');
            variations.set(id, detail);
          }
          if (requested.some(id => !variations.has(id))) throw new Error('WooCommerce variation discovery is incomplete.');
        }
        for (const product of coffees) {
          const details = (product.variations == null ? [] : list(product.variations)).map(ref => variations.get(sourceId(record(ref).id)!));
          appendDistinct(result.products, [parseWooProduct(product, details, config)]);
        }
        if ((totalPages != null && page >= totalPages) || (totalPages == null && entries.length < 100)) { result.complete = true; break; }
      }
      if (!result.complete) throw new Error('Pagination limit reached before WooCommerce discovery completed.');
    } else if (config.structuredDataParser === 'parsa-catalog') {
      const endpoint = new URL('/api/katalog/kahveler', config.websiteUrl).toString();
      const entries = list(JSON.parse((await request(endpoint)).body));
      for (const entry of entries) {
        const listed = record(entry);
        const id = requiredText(listed.kod);
        const detail: unknown = JSON.parse((await request(`${endpoint}/${encodeURIComponent(id)}`)).body);
        if (record(detail).kod !== id) throw new Error('Parsa detail identity differs from catalog.');
        appendDistinct(result.products, [parseParsaProduct(detail, config)]);
      }
      result.complete = true;
    } else if (config.structuredDataParser === 'next-data-products') {
      const context = ikasCatalogContext((await request(config.shopUrl)).body);
      let expected: number | null = null, seen = 0;
      for (let page = 1; page <= maxPages; page++) {
        const response = await request('https://api.myikas.com/api/sf/graphql?op=searchProducts', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': context.apiKey, 'x-sfid': context.storefrontId, 'x-sfrid': context.routingId },
          body: JSON.stringify({query: IKAS_CATALOG_QUERY, variables: {input: {page, perPage: 50, salesChannelId: context.salesChannelId, priceListId: context.priceListId, locale: context.locale, showStockOption: 'SHOW_ALL', order: []}}}),
        });
        const payload = record(JSON.parse(response.body));
        if (payload.errors) throw new Error('IKAS catalog query failed.');
        const catalog = record(record(payload.data).searchProducts);
        const count = Number(catalog.count);
        if (!Number.isInteger(count) || count < 0 || catalog.page !== page || (expected !== null && count !== expected)) throw new Error('IKAS catalog pagination changed or is invalid.');
        expected = count;
        const entries = list(catalog.results);
        seen += entries.length;
        appendDistinct(result.products, parseIkasProducts(entries.map(record), config, context));
        if (seen === count) { result.complete = true; break; }
        if (seen > count || entries.length !== 50) throw new Error('IKAS catalog page is incomplete.');
      }
      if (!result.complete) throw new Error('IKAS catalog pagination limit reached.');
    } else if (config.structuredDataParser === 'probador-products') {
      const html = (await request(config.shopUrl)).body;
      appendDistinct(result.products, parseProbadorCatalog(html, config));
      result.complete = true;
    } else if (config.selectors) {
      const seenPages = new Set<string>();
      const seenProducts = new Set<string>();
      let next: string | null = config.shopUrl;
      for (let page = 0; next && page < maxPages; page++) {
        if (seenPages.has(next)) throw new Error('Catalog pagination loop detected.');
        seenPages.add(next);
        const html = (await request(next)).body;
        const $ = load(html);
        if(config.slug==='ordinarius' && $('#showcase-container').attr('data-is-page-finish')!=='true')throw new Error('IdeaSoft additional catalog pages require discovery.');
        const selector = `${config.selectors!.productList} ${config.selectors!.productLink}`;
        const base = $('base[href]').attr('href') ? canonicalUrl($('base[href]').attr('href'), config, next) : next;
        const urls: string[] = [];
        $(selector).each((_, element) => { urls.push(canonicalUrl($(element).attr('href'), config, base)); });
        for (const url of urls) {
          if (seenProducts.has(url)) continue;
          seenProducts.add(url);
          const detail = (await request(url)).body;
          let product:SourceCoffee;
          if(config.slug==='cho-coffee') {
            const {id,choices,token}=choOptions(detail),variants=[];
            for(const choice of choices){const body=new URLSearchParams([...choice.params,['__RequestVerificationToken',token]]);variants.push({...choice,data:JSON.parse((await request(new URL(`/tr/shoppingcart/productdetails_attributechange?productId=${id}&validateAttributeConditions=False&loadPicture=True`,config.websiteUrl).toString(),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:body.toString()})).body)});}
            product=parseChoProduct(detail,config,url,variants);
          } else if(config.slug==='kafeinkultur') {
            const api=`https://api.kafeinkultur.com/site/v2/getProductDetail?slug=${encodeURIComponent(new URL(url).pathname.slice(1))}`;
            const payload=JSON.parse((await request(api)).body),data=record(record(payload).data),groups=Object.entries(record(data.variantProperties));
            let selected:{label:string;data:unknown}[]|undefined;
            if(groups.length>1) {
              let choices:{label:string;params:[string,string][]}[]=[{label:'',params:[]}];
              for(const [groupId,group] of groups)choices=choices.flatMap(prior=>Object.entries(record(record(group).options)).map(([optionId,option])=>({label:[prior.label,requiredText(record(option).name)].filter(Boolean).join(' · '),params:[...prior.params,[`property[${groupId}]`,optionId] as [string,string]]})));
              if(choices.length>100)throw new Error('Kafein variant budget exceeded.');
              selected=[];
              for(const choice of choices){const body=new URLSearchParams([...choice.params,['productId',requiredText(data.mainProductId)]]);const response=JSON.parse((await request(api,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:body.toString()})).body);
                const actual=record(record(response).data),properties=record(actual.variantProperties);
                const rejected=choice.params.some(([key,value])=>{const group=record(properties[key.slice(9,-1)]);return String(group.selected)!==value && record(record(group.options)[value]).saleable===false;});
                if(rejected)continue; // Storefront explicitly rejects this combination; it is not a purchasable SKU.
                if(choice.params.some(([key,value])=>String(record(properties[key.slice(9,-1)]).selected)!==value))throw new Error('Kafein selected options changed.');
                selected.push({label:choice.label,data:response});}
            }
            product=parseKafeinProduct(payload,detail,config,url,selected);
          } else if(config.slug==='ordinarius') {
            product=parseIdeaProduct(detail,config,url);
            const dom=load(detail),groups=dom('[data-selector="select-plural-variant"]').toArray();
            if(groups.length) {
              if(groups.length>2)throw new Error('IdeaSoft variant groups require review.');
              const first=dom(groups[0]),references=new Map<string,string>();
              for(const el of first.find('[data-option-id]').toArray()) {
                const body=new URLSearchParams({selected_option_group_id:requiredText(first.attr('data-group-id')),parent_product_id:product.sourceProductId!, 'selected_options[]':requiredText(dom(el).attr('data-option-id'))});
                if(groups[1])body.set('next_option_group_id',requiredText(dom(groups[1]).attr('data-group-id')));
                const payload=record(JSON.parse((await request(new URL('/product/related-options',config.websiteUrl).toString(),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:body.toString()})).body));
                if(payload.success!==true)throw new Error('IdeaSoft variant discovery failed.');
                for(const value of list(record(payload.data).options)){const option=record(value),id=sourceId(option.product_id);if(!id)throw new Error('IdeaSoft variant identity missing.');references.set(id,canonicalUrl(option.product_url,config));}
              }
              if(!references.size)throw new Error('IdeaSoft variants missing.');
              product.offers=[];
              for(const [id,variantUrl] of references){const variant=parseIdeaProduct((await request(variantUrl)).body,config,variantUrl);if(variant.sourceProductId!==id)throw new Error('IdeaSoft variant identity changed.');product.offers.push(...variant.offers);}
            }
          } else product = config.slug === 'coffee-department' ? parseTicimaxProduct(detail, config, url) : config.slug === 'kronotrop' ? parseKronotropProduct(detail,config,url) : config.slug === 'milestones' ? parseMilestonesProduct(detail,config,url) : parseStructuredProductPage(detail, config, url);
          if (isLikelyCatalogCoffeeProduct([product.name])) appendDistinct(result.products, [product]);
        }
        const nextHref = config.selectors?.nextPage ? $(config.selectors.nextPage).attr('href') : null;
        next = nextHref ? canonicalUrl(nextHref, config, next) : null;
      }
      if (next) throw new Error('HTML pagination limit reached.');
      if (['coffee-department','kronotrop','milestones','kafeinkultur','ordinarius','cho-coffee'].includes(config.slug)) result.complete = true;
      else result.diagnostics.push({ stage: 'coverage', code: 'html_offer_coverage_unverified', message: 'Structured product offers parsed; source-specific SKU completeness is unverified. Legacy selector-only package assumptions are not imported.' });
    } else {
      result.diagnostics.push({ stage: 'coverage', code: 'unsupported_adapter', message: 'No safe parser configured for this source.' });
    }
    if (!result.products.length) {
      result.complete = false;
      result.diagnostics.push({ stage: 'validate', code: 'empty_catalog', message: 'No catalog coffees observed; completeness cannot be certified.' });
    }
  } catch (error) {
    result.complete = false;
    result.diagnostics.push({ stage: 'fetch_or_parse', code: 'incomplete_crawl', message: error instanceof Error ? error.message : 'Source crawl failed.' });
  }
  return result;
}

function appendDistinct(target: SourceCoffee[], incoming: SourceCoffee[]) {
  for (const product of incoming) {
    const key = product.sourceProductId ?? product.canonicalUrl;
    if (target.some(existing => (existing.sourceProductId ?? existing.canonicalUrl) === key)) throw new Error('Duplicate source product across catalog pages.');
    // Duplicate offer identities are skipped per offer during ingestion; they do not fail the roaster.
    if (product.offers.some(offer => !(offer.sourceVariantId ?? offer.identityKey))) throw new Error('Missing source offer identity.');
    target.push(product);
  }
}
function bounded(value: number, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error('Invalid crawl request budget.');
  return value;
}
function createFetcher(config: RoasterConfig, options: CrawlOptions, retryAfter: (seconds:number)=>void) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const maxRequests = bounded(options.maxRequests ?? (config.slug==='cho-coffee'?600:250), 1, 1000);
  const timeoutMs = bounded(options.timeoutMs ?? 20_000, 1, 30_000);
  const delay = bounded(options.requestDelayMs ?? 300, 0, 60_000);
  let requests = 0;
  const cookies=new Map<string,Map<string,string>>(); // Anonymous storefront CSRF session only; never user browser cookies.
  return async (input: string, init?: RequestInit): Promise<{ body: string; headers: Headers }> => {
    const ikasApi = config.structuredDataParser === 'next-data-products' && input === 'https://api.myikas.com/api/sf/graphql?op=searchProducts' && init?.method === 'POST';
    const kafeinApi = config.slug === 'kafeinkultur' && new URL(input).origin === 'https://api.kafeinkultur.com' && new URL(input).pathname === '/site/v2/getProductDetail';
    let url = ikasApi || kafeinApi ? input : canonicalUrl(input, config);
    let retried = false;
    for (let redirect = 0; redirect <= 3; redirect++) {
      if (++requests > maxRequests) throw new Error('Source request budget exhausted.');
      if (requests > 1) await sleep(delay);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetcher(url, { ...init, redirect: 'manual', signal: controller.signal, headers: { ...(config.slug==='cho-coffee'?{Cookie:[...(cookies.get(new URL(url).hostname)?.values()??[])].join('; ')}:{}), ...CRAWLER_HEADERS, ...init?.headers } });
        } catch (error) {
          // A transport failure ("fetch failed", timeout) gets one paced retry. HTTP statuses never retry here.
          if (retried) throw error;
          retried = true; redirect--; await sleep(2_000); continue;
        }
        if(config.slug==='cho-coffee'){const host=new URL(url).hostname,jar=cookies.get(host)??new Map<string,string>();for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0];jar.set(pair.split('=')[0],pair);}cookies.set(host,jar);}
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          if (ikasApi || kafeinApi) throw new Error('Storefront API redirect refused.');
          url = canonicalUrl(response.headers.get('location'), config, url);
          continue;
        }
        if (!response.ok) {
          const header=response.headers.get('retry-after');
          if(header){const seconds=/^\d+$/.test(header)?Number(header):Math.ceil((Date.parse(header)-Date.now())/1000);if(Number.isFinite(seconds)&&seconds>0)retryAfter(Math.min(43200,seconds));}
          await response.body?.cancel();
          throw new Error(`Source HTTP ${response.status}; no state reconciliation permitted.`);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Source response body missing.');
        const decoder = new TextDecoder();
        let size = 0, body = '';
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 5_000_000) { await reader.cancel(); throw new Error('Source response exceeded 5 MB limit.'); }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        if (/Please wait while your request is being verified|Imunify360|cf-chl-|captcha/i.test(body.slice(0, 30_000))) throw new Error('Source access challenge detected; owner-assisted access or permission required.');
        return { body, headers: response.headers };
      } finally { clearTimeout(timer); }
    }
    throw new Error('Source redirect limit exceeded.');
  };
}
