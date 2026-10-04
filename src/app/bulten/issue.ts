/**
 * The monthly issue ("Mektup"): one plain-text file per month, content/bulten/YYYY-MM.md.
 * This parser reads exactly that format (front matter, two ## sections, list items, paragraphs, [links](url)) and nothing more.
 * The site gets issues from issues.generated.ts (scripts/bulten-bundle.mts, run before build/dev/typecheck);
 * the monthly email (scripts/v2-digest.mts --issue) reads the file directly.
 */
import { getSavedCoffees, SAVED_SLUG, type CatalogCoffee } from '../../../shared/v2/catalog';
import type { CatalogDatabase } from '../../../shared/v2/database';
import { brand } from '../../lib/brand';
import { trustedSponsorUrl, type Sponsor } from '../../components/v2/sponsor-card';

export type { Sponsor };

/** Text with optional links. href is an absolute http(s) URL or a site path starting with "/". */
export type Inline = { text: string; href?: string }[];
export interface Pick { slug: string; note: Inline }
export interface Issue {
  month: string; subject: string; title: string; intro: string; published: boolean; sponsor?: Sponsor;
  picksText: Inline[]; picks: Pick[]; sceneText: Inline[]; scene: Inline[];
}

export const ISSUE_FILE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.md$/;
export const PICKS_HEADING = 'Bu ayın favorileri';
export const SCENE_HEADING = 'Sahneden';

export class IssueFormatError extends Error {}

const FIELDS = ['subject', 'title', 'intro', 'published', 'sponsor'] as const;
const SPONSOR_FIELDS = ['name', 'description', 'link', 'host'] as const;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** `file` only labels error messages. */
export function parseIssue(raw: string, month: string, file = `${month}.md`): Issue {
  const fail = (line: number, message: string): never => { throw new IssueFormatError(`${file}, satır ${line}: ${message}`); };
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') fail(1, 'Dosya "---" satırıyla başlamalı (ön bilgi bloğu).');
  const end = lines.indexOf('---', 1);
  if (end < 0) fail(1, 'Ön bilgi bloğu ikinci bir "---" satırıyla kapanmalı.');

  const meta: Record<string, string> = {};
  const sponsor: Record<string, string> = {};
  let inSponsor = false;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const match = /^(\s*)([a-z]+):\s*(.*)$/.exec(line) ?? fail(i + 1, `"anahtar: değer" biçiminde olmalı: ${line.trim()}`);
    const [, indent, key, rawValue] = match;
    const value = rawValue.trim().replace(/^"(.*)"$/, '$1');
    if (indent) {
      if (!inSponsor) fail(i + 1, 'Girintili satırlar yalnızca "sponsor:" altında olabilir.');
      if (!(SPONSOR_FIELDS as readonly string[]).includes(key)) fail(i + 1, `Bilinmeyen sponsor alanı "${key}". Geçerli alanlar: ${SPONSOR_FIELDS.join(', ')}.`);
      if (key in sponsor) fail(i + 1, `"${key}" iki kez yazılmış.`);
      sponsor[key] = value;
      continue;
    }
    if (!(FIELDS as readonly string[]).includes(key)) fail(i + 1, `Bilinmeyen alan "${key}". Geçerli alanlar: ${FIELDS.join(', ')}.`);
    if (key in meta) fail(i + 1, `"${key}" iki kez yazılmış.`);
    inSponsor = key === 'sponsor';
    if (inSponsor && value) fail(i + 1, '"sponsor:" satırı boş kalmalı; alanlar altına iki boşluk girintiyle yazılır.');
    meta[key] = value;
  }
  for (const key of ['subject', 'title', 'intro'] as const) if (!meta[key]) fail(1, `"${key}" alanı eksik ya da boş.`);
  if (meta.published !== 'true' && meta.published !== 'false') fail(1, '"published" alanı "true" ya da "false" olmalı.');
  let parsedSponsor: Sponsor | undefined;
  if ('sponsor' in meta) {
    for (const key of SPONSOR_FIELDS) if (!sponsor[key]) fail(1, `Sponsor alanı "${key}" eksik ya da boş.`);
    parsedSponsor = sponsor as unknown as Sponsor;
    if (!trustedSponsorUrl(parsedSponsor)) fail(1, `Sponsor bağlantısı https:// ile başlamalı ve tam olarak "${parsedSponsor.host}" alan adına gitmeli.`);
  }

  const issue: Issue = { month, subject: meta.subject, title: meta.title, intro: meta.intro, published: meta.published === 'true', sponsor: parsedSponsor, picksText: [], picks: [], sceneText: [], scene: [] };
  let section: 'picks' | 'scene' | null = null;
  const seen = new Set<string>();
  // The block being collected: a paragraph or a list item, closed by a blank line, a new item or a heading.
  let block: { kind: 'text' | 'item'; line: number; text: string } | null = null;
  const close = () => {
    if (!block) return;
    const { kind, line, text } = block;
    block = null;
    if (kind === 'text') { (section === 'picks' ? issue.picksText : issue.sceneText).push(inline(text, line)); return; }
    if (section === 'scene') {
      const item = inline(text, line);
      if (!item.some(part => part.href)) fail(line, 'Her sahne haberinde en az bir kaynak bağlantısı olmalı: [Kaynak](https://...)');
      issue.scene.push(item);
      return;
    }
    const pick = /^([^\s:]+)(?:\s*:\s*|\s+)(.+)$/.exec(text) ?? fail(line, 'Favori satırı "kahve-slug: notun" biçiminde olmalı.');
    if (!SAVED_SLUG.test(pick[1])) fail(line, `"${pick[1]}" bir kahve slug'ı gibi görünmüyor (yalnızca harf, rakam, - ve _).`);
    issue.picks.push({ slug: pick[1], note: inline(pick[2], line) });
  };
  const inline = (text: string, line: number): Inline => {
    const parts: Inline = [];
    let last = 0;
    for (const match of text.matchAll(LINK)) {
      const href = match[2];
      if (!/^https?:\/\/[^/\s]+/i.test(href) && !/^\/(?!\/)/.test(href)) fail(line, `Bağlantı adresi https:// ya da / ile başlamalı: ${href}`);
      if (match.index > last) parts.push({ text: text.slice(last, match.index) });
      parts.push({ text: match[1], href });
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  };

  for (let i = end + 1; i < lines.length; i++) {
    const line = lines[i], number = i + 1;
    if (!line.trim()) { close(); continue; }
    if (/^#/.test(line)) {
      close();
      const heading = /^##\s+(.+?)\s*$/.exec(line) ?? fail(number, `Yalnızca "## ${PICKS_HEADING}" ve "## ${SCENE_HEADING}" başlıkları kullanılabilir.`);
      const name = heading[1].toLocaleLowerCase('tr-TR');
      section = name === PICKS_HEADING.toLocaleLowerCase('tr-TR') ? 'picks' : name === SCENE_HEADING.toLocaleLowerCase('tr-TR') ? 'scene' : fail(number, `Bilinmeyen başlık "${heading[1]}". Yalnızca "## ${PICKS_HEADING}" ve "## ${SCENE_HEADING}" kullanılabilir.`);
      if (seen.has(section)) fail(number, `"${heading[1]}" başlığı iki kez yazılmış.`);
      seen.add(section);
      continue;
    }
    if (!section) fail(number, `Metin bir başlığın altında olmalı: "## ${PICKS_HEADING}" ya da "## ${SCENE_HEADING}".`);
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) { close(); block = { kind: 'item', line: number, text: item[1].trim() }; continue; }
    // An indented line continues the list item above it; any other line continues or starts a paragraph.
    if (block && (block.kind === 'text' || /^\s/.test(line))) { block.text += ` ${line.trim()}`; continue; }
    close();
    block = { kind: 'text', line: number, text: line.trim() };
  }
  close();
  if (!seen.has('picks')) fail(lines.length, `"## ${PICKS_HEADING}" bölümü eksik.`);
  if (!seen.has('scene')) fail(lines.length, `"## ${SCENE_HEADING}" bölümü eksik.`);
  if (!issue.picks.length) fail(lines.length, 'En az bir favori kahve yazılmalı.');
  return issue;
}

/** "2026-11" → "Kasım 2026". */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
}

/** The issue's calendar month in Istanbul time, as ISO instants. */
export function monthWindow(month: string): { since: string; until: string } {
  const [year, index] = month.split('-').map(Number);
  const istanbul = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1) - 3 * 3600000).toISOString();
  return { since: istanbul(year, index), until: index === 12 ? istanbul(year + 1, 1) : istanbul(year, index + 1) };
}

/** Adds the issue's campaign tags. Used for every link back to the site and the sponsor's link. */
export function campaignUrl(url: string | URL, month: string): string {
  const tagged = new URL(url);
  tagged.searchParams.set('utm_source', brand.analyticsSource);
  tagged.searchParams.set('utm_medium', 'newsletter');
  tagged.searchParams.set('utm_campaign', month);
  return tagged.toString();
}

export interface ResolvedPick extends Pick { name: string; coffee: CatalogCoffee | null; status: 'listed' | 'sold_out' | 'gone' | 'unknown' }

/** A slug's readable fallback name when the coffee is gone from the catalog: "guji-hambela" → "Guji Hambela". */
function nameFromSlug(slug: string): string {
  return slug.split(/[-_]+/).filter(Boolean).map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1)).join(' ');
}

/** Picks against the live catalog. A coffee no longer listed keeps the owner's note and a name; without a database (the page's fallback when the read fails) every pick is "unknown". */
export async function resolvePicks(db: CatalogDatabase | null, picks: Pick[]): Promise<ResolvedPick[]> {
  const found = db ? await getSavedCoffees(db, picks.map(pick => pick.slug)) : null;
  return picks.map(pick => {
    const hit = found?.find(entry => entry.savedSlug === pick.slug);
    return hit ? { ...pick, name: hit.coffee.name, coffee: hit.coffee, status: hit.availability }
      : { ...pick, name: nameFromSlug(pick.slug), coffee: null, status: found ? 'gone' : 'unknown' };
  });
}

export const PICK_STATUS = { sold_out: 'Şu an tükendi', gone: 'Artık satışta değil' } as const;
