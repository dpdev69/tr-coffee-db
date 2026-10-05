/**
 * Weekly "Haftalık Drop" digest, and with --issue YYYY-MM the monthly issue ("Mektup") from content/bulten/YYYY-MM.md.
 * Both create a Kit DRAFT broadcast only; the owner reviews, picks recipients and sends it in Kit.
 */
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listCatalog, type CatalogCoffee } from '../shared/v2/catalog';
import { safeDiagnostic } from '../shared/v2/ingestion';
import { campaignUrl, ISSUE_FILE, monthLabel, parseIssue, PICK_STATUS, resolvePicks, type Inline, type Issue, type ResolvedPick } from '../src/app/bulten/issue';
import { SPONSOR_DISCLOSURE, SPONSOR_LABEL, sponsorshipsEnabled, trustedSponsorUrl } from '../src/components/v2/sponsor-card';
import { itemLines, type Item } from '../src/lib/digest-lines';
import { brand } from '../src/lib/brand';
import { D1RestDatabase } from './v2-d1-rest';

export type DigestInput = Record<'PRICE_DROP' | 'DEAL' | 'NEW' | 'RESTOCKED', CatalogCoffee[]>;
export interface Digest { subject: string; previewText: string; description: string; html: string; text: string; itemCount: number; generatedAt: string; sections: { title: string; count: number }[] }

const MAX_ITEMS = 8;
// Email clients cannot read the site's CSS tokens; these mirror the palette at the top of src/app/globals.css.
const ACCENT = '#2340c7', INK = '#171a2b', MUTED = '#555a6e', LINE = '#d6dae6', PAPER = '#f7f8f6';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
/** The automated sections both emails share: drops and verified deals (a coffee appears once), new arrivals, restocks. Empty sections are left out. */
export function digestSections(input: DigestInput) {
  const seen = new Set<string>();
  // Verified deals lead; a coffee with both events appears once.
  const drops = [...input.DEAL, ...input.PRICE_DROP].filter(coffee => !seen.has(coffee.id) && seen.add(coffee.id)).map(coffee => ({
    coffee, drop: coffee.latestEvents.find(event => event.type === 'DEAL') ?? coffee.latestEvents.find(event => event.type === 'PRICE_DROP'),
  }));
  return [
    { title: 'Fiyatı düşenler', short: 'fiyatı düşen', items: drops },
    { title: 'Yeni gelenler', short: 'yeni', items: input.NEW.map(coffee => ({ coffee })) },
    { title: 'Tekrar raflarda', short: 'tekrar rafta', items: input.RESTOCKED.map(coffee => ({ coffee })) },
  ].map(section => ({ ...section, items: section.items.slice(0, MAX_ITEMS) as Item[] })).filter(section => section.items.length);
}

function sectionsHtml(sections: ReturnType<typeof digestSections>, link: (slug: string) => string): string {
  const e = escapeHtml;
  return sections.map(section => `<h2 style="margin:32px 0 8px;font-size:20px;color:${ACCENT};font-family:Georgia,'Times New Roman',serif">${e(section.title)}</h2>` +
    section.items.map(item => {
      const line = itemLines(item);
      return `<div style="padding:14px 0;border-top:1px solid ${LINE}">` +
        `<p style="margin:0;font-size:12px;font-weight:600;color:${ACCENT}">${e(line.roaster)}</p>` +
        `<p style="margin:4px 0;font-size:17px;font-weight:600"><a href="${e(link(item.coffee.slug))}" style="color:${INK};text-decoration:underline">${e(line.name)}</a></p>` +
        (line.origin ? `<p style="margin:2px 0;font-size:14px;color:${MUTED}">${e(line.origin)}</p>` : '') +
        (line.tastes ? `<p style="margin:2px 0;font-size:14px;color:${ACCENT}">${e(line.tastes)}</p>` : '') +
        (line.drop ? `<p style="margin:6px 0 2px;font-size:14px;font-weight:600;color:${ACCENT}">${e(line.drop)}</p>` : '') +
        `<p style="margin:2px 0;font-size:14px;color:${INK}">${e(line.price)}</p></div>`;
    }).join('')).join('');
}

export function buildDigest(input: DigestInput, { siteUrl, now }: { siteUrl: string; now: Date }): Digest {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now); // YYYY-MM-DD
  const sections = digestSections(input);
  const link = (slug: string) => `${siteUrl.replace(/\/+$/, '')}/kahve/${encodeURIComponent(slug)}?utm_source=kit&utm_medium=email&utm_campaign=haftalik-drop-${date}`;
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const summary = sections.map(section => `${section.items.length} ${section.short}`).join(', ');
  const subject = `${brand.newsletterName}: ${summary}`;
  const previewText = `Bu hafta ${brand.name} kataloğunda ${itemCount} kahve öne çıktı.`;
  const e = escapeHtml;

  const htmlSections = sectionsHtml(sections, link);
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
  return { subject, previewText, description: `${brand.newsletterName} ${now.toISOString().slice(0, 10)} (otomatik taslak)`, html, text, itemCount, generatedAt: now.toISOString(), sections: sections.map(section => ({ title: section.title, count: section.items.length })) };
}

export type IssueEmail = Omit<Digest, 'text'>;
/** The monthly issue's email: the owner's picks, the scene section, the sponsor block (only with the flag on), then the month's automated sections. */
export function buildIssueEmail(issue: Issue, picks: ResolvedPick[], input: DigestInput, { siteUrl, now }: { siteUrl: string; now: Date }): IssueEmail {
  if (!issue.published) throw new Error(`Refusing to build the ${issue.month} issue: it is not "published: true".`);
  const e = escapeHtml;
  const site = new URL(siteUrl);
  // Every link back to the site carries the issue's campaign tags; links to other sites stay as the owner wrote them.
  const siteLink = (href: string) => { const url = new URL(href, site); return url.origin === site.origin ? campaignUrl(url, issue.month) : url.toString(); };
  const inline = (parts: Inline) => parts.map(part => part.href ? `<a href="${e(siteLink(part.href))}" style="color:${ACCENT};text-decoration:underline">${e(part.text)}</a>` : e(part.text)).join('');
  const paragraph = (parts: Inline) => `<p style="margin:8px 0;font-size:15px;color:${INK}">${inline(parts)}</p>`;
  const heading = (text: string) => `<h2 style="margin:32px 0 8px;font-size:22px;color:${ACCENT};font-family:Georgia,'Times New Roman',serif">${e(text)}</h2>`;
  const coffeeLink = (slug: string) => siteLink(`/kahve/${encodeURIComponent(slug)}`);

  const pickHtml = picks.map(pick => {
    const line = pick.coffee ? itemLines({ coffee: pick.coffee }) : null;
    const status = pick.status === 'sold_out' || pick.status === 'gone' ? PICK_STATUS[pick.status] : null;
    return `<div style="padding:14px 0;border-top:1px solid ${LINE}">` +
      (line ? `<p style="margin:0;font-size:12px;font-weight:600;color:${ACCENT}">${e(line.roaster)}</p>` : '') +
      `<p style="margin:4px 0;font-size:17px;font-weight:600">${pick.coffee ? `<a href="${e(coffeeLink(pick.coffee.slug))}" style="color:${INK};text-decoration:underline">${e(pick.name)}</a>` : e(pick.name)}</p>` +
      (status ? `<p style="margin:2px 0;font-size:14px;font-weight:600;color:${MUTED}">${e(status)}</p>` : line ? `<p style="margin:2px 0;font-size:14px;color:${INK}">${e(line.price)}</p>` : '') +
      `<p style="margin:8px 0 0;font-size:15px;color:${INK}">${inline(pick.note)}</p></div>`;
  }).join('');
  const sceneHtml = issue.scene.length || issue.sceneText.length ? heading('Sahneden') + issue.sceneText.map(paragraph).join('') +
    `<ul style="margin:8px 0;padding:0 0 0 20px">${issue.scene.map(item => `<li style="margin:0 0 8px;font-size:15px;color:${INK}">${inline(item)}</li>`).join('')}</ul>` : '';
  const sponsorUrl = issue.sponsor && sponsorshipsEnabled() ? trustedSponsorUrl(issue.sponsor) : null;
  const sponsorHtml = issue.sponsor && sponsorUrl ? `<div style="margin:32px 0 0;padding:20px;border:1px solid ${LINE};background:#ffffff">` +
    `<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${e(SPONSOR_LABEL)}</p>` +
    `<p style="margin:4px 0 0;font-size:12px;color:${MUTED}">${e(SPONSOR_DISCLOSURE)}</p>` +
    `<p style="margin:12px 0 4px;font-size:20px;font-family:Georgia,'Times New Roman',serif;color:${INK}">${e(issue.sponsor.name)}</p>` +
    `<p style="margin:0 0 8px;font-size:15px;color:${INK}">${e(issue.sponsor.description)}</p>` +
    `<a href="${e(campaignUrl(sponsorUrl, issue.month))}" style="font-size:15px;font-weight:600;color:${ACCENT}">Sponsorun sitesine git →</a></div>` : '';
  const sections = digestSections(input);
  const label = `${brand.monthlyName} · ${monthLabel(issue.month)}`;
  const html = `<!-- Kit's Classic template wraps this body and adds the unsubscribe link and sender address footer. -->
<div style="max-width:600px;margin:0 auto;padding:24px 16px;background:${PAPER};color:${INK};font-family:${FONT};line-height:1.5">
<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${e(label)}</p>
<h1 style="margin:8px 0 8px;font-size:28px;font-family:Georgia,'Times New Roman',serif;color:${INK}">${e(issue.title)}</h1>
<p style="margin:0;font-size:16px;color:${MUTED}">${e(issue.intro)}</p>
<p style="margin:8px 0 0;font-size:13px"><a href="${e(siteLink(`/bulten/${issue.month}`))}" style="color:${ACCENT}">Bu sayıyı web'de oku</a></p>
${heading('Bu ayın favorileri')}${issue.picksText.map(paragraph).join('')}${pickHtml}
${sceneHtml}
${sponsorHtml}
${sectionsHtml(sections, coffeeLink)}
<p style="margin:32px 0 0;font-size:13px;color:${MUTED}">Fiyatlar ve stok durumu kavurucuların sitelerinden alınır ve değişebilir.</p>
</div>`;
  return { subject: issue.subject, previewText: issue.intro, description: `${brand.monthlyName} ${issue.month} (otomatik taslak)`, html,
    itemCount: picks.length + sections.reduce((sum, section) => sum + section.items.length, 0), generatedAt: now.toISOString(),
    sections: sections.map(section => ({ title: section.title, count: section.items.length })) };
}

const KIT_BROADCASTS = 'https://api.kit.com/v4/broadcasts';
const kitInit = (apiKey: string, init: RequestInit = {}): RequestInit & { redirect: 'manual' } => ({ ...init, redirect: 'manual', signal: AbortSignal.timeout(8000),
  headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey } });

/** https://developers.kit.com/api-reference/broadcasts/create-a-broadcast — `send_at: null` saves a draft. */
export function kitDraftRequest(digest: Pick<Digest, 'subject' | 'previewText' | 'description' | 'html' | 'generatedAt'>, apiKey: string): { url: string; init: RequestInit & { redirect: 'manual' } } {
  // subscriber_filter omitted: the API filters only by segment/tag, not form. The owner picks recipients in Kit before sending.
  const body = { subject: digest.subject, preview_text: digest.previewText, content: digest.html, description: digest.description,
    public: false, published_at: digest.generatedAt, send_at: null };
  if (body.send_at !== null) throw new Error('Refusing to schedule a broadcast; drafts only.');
  return { url: KIT_BROADCASTS, init: kitInit(apiKey, { method: 'POST', body: JSON.stringify(body) }) };
}

async function kitJson<T>(response: Response): Promise<T> {
  // Manual redirects: any 3xx (or other non-success) fails without following or reading the body.
  if (response.status !== 200 && response.status !== 201) { await response.body?.cancel().catch(() => {}); throw new Error(`Kit request failed (HTTP ${response.status}).`); }
  return await response.json() as T;
}

/**
 * https://developers.kit.com/api-reference/broadcasts/list-broadcasts — a broadcast (draft or sent) whose internal description
 * matches this issue's. Kit list views are eventually consistent, so a draft created seconds earlier may not show yet.
 */
export async function findKitBroadcast(description: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const url = new URL(KIT_BROADCASTS);
    url.searchParams.set('per_page', '500');
    if (after) url.searchParams.set('after', after);
    const body = await kitJson<{ broadcasts?: { id?: unknown; description?: unknown }[]; pagination?: { has_next_page?: boolean; end_cursor?: string | null } }>(await fetcher(url, kitInit(apiKey)));
    const hit = body.broadcasts?.find(broadcast => broadcast.description === description);
    if (hit) return Number(hit.id);
    if (!body.pagination?.has_next_page || !body.pagination.end_cursor) return null;
    after = body.pagination.end_cursor;
  }
  throw new Error('Kit broadcast list did not end after 20 pages; not creating a possible duplicate draft.');
}

/** Creates the issue's Kit draft unless one already exists. Never sends: kitDraftRequest only builds unscheduled drafts. */
export async function createIssueDraft(email: IssueEmail, apiKey: string, fetcher: typeof fetch = fetch): Promise<{ id: number; existing: boolean }> {
  const existing = await findKitBroadcast(email.description, apiKey, fetcher);
  if (existing !== null) return { id: existing, existing: true };
  const { url, init } = kitDraftRequest(email, apiKey);
  const id = (await kitJson<{ broadcast?: { id?: unknown } }>(await fetcher(url, init))).broadcast?.id;
  if (!Number.isSafeInteger(id)) throw new Error('Kit draft response had no broadcast id.');
  return { id: id as number, existing: false };
}

async function summary(lines: string[]) {
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n\n')}\n`);
}

async function monthly(month: string, db: D1RestDatabase, now: Date) {
  if (!ISSUE_FILE.test(`${month}.md`)) throw new Error(`"${month}" is not an issue month (YYYY-MM).`);
  const file = `content/bulten/${month}.md`;
  const issue = parseIssue(await readFile(resolve(file), 'utf8'), month, file);
  if (!issue.published) throw new Error(`${file} is not "published: true"; refusing to build or draft it.`);
  // The month's automated sections: the same verified-event feeds as the weekly digest over 30 days.
  const since = new Date(Math.floor(now.getTime() / 300000) * 300000 - 30 * 86400000).toISOString();
  const types = ['PRICE_DROP', 'DEAL', 'NEW'] as const;
  const [picks, ...lists] = await Promise.all([resolvePicks(db, issue.picks), ...types.map(event => listCatalog(db, { event, since, perPage: MAX_ITEMS }))]);
  const [PRICE_DROP, DEAL, NEW] = lists.map(list => list.coffees);
  const input: DigestInput = { PRICE_DROP, DEAL, NEW, RESTOCKED: [] };
  const email = buildIssueEmail(issue, picks, input, { siteUrl: process.env.SITE_URL || brand.domain, now });
  const path = resolve(`.local/v2/issue-${month}-preview.html`);
  await mkdir(resolve('.local/v2'), { recursive: true });
  await writeFile(path, `<!doctype html><meta charset="utf-8"><title>${escapeHtml(email.subject)}</title>\n${email.html}\n`);
  const gone = picks.filter(pick => pick.status === 'gone').map(pick => pick.slug);
  console.log(`Subject: ${email.subject}\nPicks: ${picks.length}${gone.length ? ` (not in the catalog: ${gone.join(', ')})` : ''}\n${email.sections.map(s => `${s.title}: ${s.count}`).join('\n')}\nPreview: ${path}`);
  if (!process.argv.includes('--create-draft')) return;
  const key = process.env.KIT_API_KEY?.trim();
  if (!key) { await summary([`${month}: KIT_API_KEY is not set; no Kit draft created. The email preview is in the workflow artifacts.`]); return; }
  const result = await createIssueDraft(email, key);
  await summary(result.existing
    ? [`${month}: a Kit broadcast for this issue already exists (ID ${result.id}); no new draft was created.`, 'To rebuild it: delete that draft in Kit, then run this workflow again for the month.']
    : [`${month}: Kit draft created (ID ${result.id}). Open it in Kit, choose the recipients, review and send.`,
      'Kit lists new broadcasts with a short delay. If this workflow ran twice within a minute or so, check Kit for a second draft and delete it.']);
}

async function main() {
  const db = new D1RestDatabase(process.env.CLOUDFLARE_ACCOUNT_ID ?? '', process.env.CLOUDFLARE_D1_DATABASE_ID ?? '', process.env.CLOUDFLARE_D1_API_TOKEN ?? '');
  const now = new Date();
  const issueArg = process.argv.indexOf('--issue');
  if (issueArg >= 0) return monthly(process.argv[issueArg + 1] ?? '', db, now);
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
