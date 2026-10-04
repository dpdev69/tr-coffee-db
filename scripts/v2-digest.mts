/** Weekly "Haftalık Drop" digest. Creates a Kit DRAFT broadcast only; the owner reviews and sends it in Kit. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listCatalog, type CatalogCoffee } from '../shared/v2/catalog';
import { safeDiagnostic } from '../shared/v2/ingestion';
import type { CoffeeEvent } from '../shared/v2/types';
import { coffeeOrigin, coffeeProcess, EVENT_LABELS, preferredOffer, publicOfferLabel, tasteSummary } from '../src/components/v2/discovery-card';
import { formatMoney } from '../src/lib/coffee-display';
import { brand } from '../src/lib/brand';
import { D1RestDatabase } from './v2-d1-rest';

export type DigestInput = Record<'PRICE_DROP' | 'DEAL' | 'NEW' | 'RESTOCKED', CatalogCoffee[]>;
export interface Digest { subject: string; previewText: string; html: string; text: string; itemCount: number; generatedAt: string; sections: { title: string; count: number }[] }
interface Item { coffee: CatalogCoffee; drop?: CoffeeEvent }

const MAX_ITEMS = 8;
const GREEN = '#244b3d', INK = '#1f1d1b', MUTED = '#625e57', LINE = '#dedfd7', PAPER = '#faf9f6';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
const money = (minor: unknown, currency: unknown) => typeof minor === 'number' && minor > 0 ? formatMoney(minor / 100, typeof currency === 'string' ? currency : '(para birimi belirtilmemiş)') : null;
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function itemLines(item: Item) {
  const { coffee, drop } = item;
  // The drop's own package is the one whose price changed; other coffees show the card's package.
  const offer = coffee.offers.find(o => drop?.offerId && o.variantOfferIds.includes(drop.offerId)) ?? preferredOffer(coffee);
  const tastes = tasteSummary(coffee);
  const before = object(drop?.before), after = object(drop?.after);
  // listCatalog already verified the event still matches the current price; re-check so a stale before→after never prints.
  const dropText = before && after && after.priceMinor === offer?.priceMinor ? `${money(before.priceMinor, before.currency)} → ${money(after.priceMinor, after.currency)}` : null;
  return {
    name: coffee.name, roaster: coffee.roaster.name,
    origin: [coffeeOrigin(coffee), coffeeProcess(coffee)].filter(Boolean).join(' · '),
    tastes: (tastes.length ? tastes : coffee.rawMetadata.tastingNotes?.slice(0, 3) ?? []).join(' · '),
    price: `${publicOfferLabel(offer)} · ${money(offer?.priceMinor, offer?.currency) ?? 'Fiyat paylaşılmamış'}`,
    drop: dropText && drop ? `${EVENT_LABELS[drop.type]}: ${dropText}` : null,
  };
}

export function buildDigest(input: DigestInput, { siteUrl, now }: { siteUrl: string; now: Date }): Digest {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now); // YYYY-MM-DD
  const seen = new Set<string>();
  // Verified deals lead; a coffee with both events appears once.
  const drops = [...input.DEAL, ...input.PRICE_DROP].filter(coffee => !seen.has(coffee.id) && seen.add(coffee.id)).map(coffee => ({
    coffee, drop: coffee.latestEvents.find(event => event.type === 'DEAL') ?? coffee.latestEvents.find(event => event.type === 'PRICE_DROP'),
  }));
  const sections = [
    { title: 'Fiyatı düşenler', short: 'fiyatı düşen', items: drops },
    { title: 'Yeni gelenler', short: 'yeni', items: input.NEW.map(coffee => ({ coffee })) },
    { title: 'Tekrar raflarda', short: 'tekrar rafta', items: input.RESTOCKED.map(coffee => ({ coffee })) },
  ].map(section => ({ ...section, items: section.items.slice(0, MAX_ITEMS) as Item[] })).filter(section => section.items.length);
  const link = (slug: string) => `${siteUrl.replace(/\/+$/, '')}/kahve/${encodeURIComponent(slug)}?utm_source=kit&utm_medium=email&utm_campaign=haftalik-drop-${date}`;
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const summary = sections.map(section => `${section.items.length} ${section.short}`).join(', ');
  const subject = `${brand.newsletterName}: ${summary}`;
  const previewText = `Bu hafta ${brand.name} kataloğunda ${itemCount} kahve öne çıktı.`;
  const e = escapeHtml;

  const htmlSections = sections.map(section => `<h2 style="margin:32px 0 8px;font-size:20px;color:${GREEN};font-family:Georgia,'Times New Roman',serif">${e(section.title)}</h2>` +
    section.items.map(item => {
      const line = itemLines(item);
      return `<div style="padding:14px 0;border-top:1px solid ${LINE}">` +
        `<p style="margin:0;font-size:12px;font-weight:600;color:${GREEN}">${e(line.roaster)}</p>` +
        `<p style="margin:4px 0;font-size:17px;font-weight:600"><a href="${e(link(item.coffee.slug))}" style="color:${INK};text-decoration:underline">${e(line.name)}</a></p>` +
        (line.origin ? `<p style="margin:2px 0;font-size:14px;color:${MUTED}">${e(line.origin)}</p>` : '') +
        (line.tastes ? `<p style="margin:2px 0;font-size:14px;color:${GREEN}">${e(line.tastes)}</p>` : '') +
        (line.drop ? `<p style="margin:6px 0 2px;font-size:14px;font-weight:600;color:${GREEN}">${e(line.drop)}</p>` : '') +
        `<p style="margin:2px 0;font-size:14px;color:${INK}">${e(line.price)}</p></div>`;
    }).join('')).join('');
  const html = `<!-- Kit's Classic template wraps this body and adds the unsubscribe link and sender address footer. -->
<div style="max-width:600px;margin:0 auto;padding:24px 16px;background:${PAPER};color:${INK};font-family:${FONT};line-height:1.5">
<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${e(brand.name)} · ${e(brand.newsletterName)}</p>
<h1 style="margin:8px 0 4px;font-size:26px;font-family:Georgia,'Times New Roman',serif;color:${INK}">Bu haftanın kahveleri</h1>
<p style="margin:0;font-size:15px;color:${MUTED}">${e(brand.newsletterPromise)}</p>
${htmlSections}
<p style="margin:32px 0 0;font-size:13px;color:${MUTED}">Fiyatlar ve stok durumu kavurucuların sitelerinden alınır ve değişebilir.</p>
</div>`;
  const text = [`${brand.name} · ${brand.newsletterName}`, brand.newsletterPromise, ...sections.flatMap(section => ['', section.title.toLocaleUpperCase('tr-TR'),
    ...section.items.flatMap(item => { const line = itemLines(item); return ['', ...[`${line.name} — ${line.roaster}`, line.origin, line.tastes, line.drop, line.price, link(item.coffee.slug)].filter(Boolean) as string[]]; })]),
  '', 'Fiyatlar ve stok durumu kavurucuların sitelerinden alınır ve değişebilir.'].join('\n');
  return { subject, previewText, html, text, itemCount, generatedAt: now.toISOString(), sections: sections.map(section => ({ title: section.title, count: section.items.length })) };
}

/** https://developers.kit.com/api-reference/broadcasts/create-a-broadcast — `send_at: null` saves a draft. */
export function kitDraftRequest(digest: Digest, apiKey: string): { url: string; init: RequestInit & { redirect: 'manual' } } {
  // subscriber_filter omitted: the API filters only by segment/tag, not form. The owner picks recipients in Kit before sending.
  const body = { subject: digest.subject, preview_text: digest.previewText, content: digest.html,
    description: `${brand.newsletterName} ${digest.generatedAt.slice(0, 10)} (otomatik taslak)`,
    public: false, published_at: digest.generatedAt, send_at: null };
  if (body.send_at !== null) throw new Error('Refusing to schedule a broadcast; drafts only.');
  return { url: 'https://api.kit.com/v4/broadcasts', init: {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey }, body: JSON.stringify(body),
  } };
}

async function main() {
  const db = new D1RestDatabase(process.env.CLOUDFLARE_ACCOUNT_ID ?? '', process.env.CLOUDFLARE_D1_DATABASE_ID ?? '', process.env.CLOUDFLARE_D1_API_TOKEN ?? '');
  const now = new Date();
  // Same 7-day verified-event window as the home page feeds.
  const since = new Date(Math.floor(now.getTime() / 300000) * 300000 - 7 * 86400000).toISOString();
  const types = ['PRICE_DROP', 'DEAL', 'NEW', 'RESTOCKED'] as const;
  const lists = await Promise.all(types.map(event => listCatalog(db, { event, since, perPage: MAX_ITEMS })));
  const digest = buildDigest(Object.fromEntries(types.map((type, index) => [type, lists[index].coffees])) as DigestInput, { siteUrl: process.env.SITE_URL || brand.domain, now });
  const path = resolve('.local/v2/digest-preview.html');
  await mkdir(resolve('.local/v2'), { recursive: true });
  await writeFile(path, `<!doctype html><meta charset="utf-8"><title>${escapeHtml(digest.subject)}</title>\n${digest.html}\n`);
  console.log(`Subject: ${digest.subject}\n${digest.sections.map(s => `${s.title}: ${s.count}`).join('\n')}\nPreview: ${path}`);
  if (digest.itemCount < 3) { console.log('Fewer than 3 items: nothing worth sending.'); return; }
  if (!process.argv.includes('--create-draft')) return;
  const key = process.env.KIT_API_KEY?.trim();
  if (!key) { console.warn('KIT_API_KEY is not set; no Kit draft created.'); return; }
  const { url, init } = kitDraftRequest(digest, key);
  const response = await fetch(url, init);
  // Manual redirects: any 3xx (or other non-success) fails without following or reading the body.
  if (response.status !== 200 && response.status !== 201) { await response.body?.cancel().catch(() => {}); throw new Error(`Kit draft creation failed (HTTP ${response.status}).`); }
  const id = (await response.json() as { broadcast?: { id?: unknown } }).broadcast?.id;
  if (!Number.isSafeInteger(id)) throw new Error(`Kit draft response had no broadcast id (HTTP ${response.status}).`);
  console.log(`Kit draft broadcast created: ${id}. Review and send it in Kit.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(safeDiagnostic(error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
