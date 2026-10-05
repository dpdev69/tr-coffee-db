import { pageMetadata } from '@/lib/page-metadata';
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { brand } from '@/lib/brand';
import { absoluteUrl } from '@/lib/site';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { itemLines } from '@/lib/digest-lines';
import { JsonLd, breadcrumbList } from '@/components/layout/json-ld';
import { DiscoveryCard } from '@/components/v2/discovery-card';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { SponsorCard } from '@/components/v2/sponsor-card';
import { listCatalog, type CatalogCoffee } from '../../../../shared/v2/catalog';
import type { CoffeeEvent } from '../../../../shared/v2/types';
import { campaignUrl, monthLabel, monthWindow, PICK_STATUS, resolvePicks, type Inline, type Issue } from '../issue';
import { issues } from '../issues.generated';

// Matches the 5-minute D1 read cache, like the coffee pages: the picks' prices and the month's lists stay this fresh.
export const revalidate = 300;
const MAX_ITEMS = 8;

/** Only bundled issues exist here; a production build bundles only `published: true` files (scripts/bulten-bundle.mts). */
const findIssue = (month: string) => issues.find(issue => issue.month === month);

/** The month's catalog side. A failed read keeps the owner's text: picks show their notes, the automated lists are left out. */
const loadCatalog = cache(async (issue: Issue) => {
  try {
    const db = await getCatalogDatabase();
    const { since, until } = monthWindow(issue.month);
    const [picks, ...lists] = await Promise.all([resolvePicks(db, issue.picks), ...(['NEW', 'DEAL', 'PRICE_DROP'] as const).map(event => listCatalog(db, { event, since, perPage: 100 }))]);
    // listCatalog has a start but no end; keep coffees whose event fell inside the month.
    // ponytail: newest 100 since the month began, then filtered; a past month with >100 later arrivals loses its oldest ones. Add an `until` filter to listCatalog if that happens.
    const inMonth = (coffee: CatalogCoffee, ...types: CoffeeEvent['type'][]) => coffee.latestEvents.find(event => types.includes(event.type) && event.createdAt >= since && event.createdAt < until);
    const seen = new Set<string>();
    const fresh = lists[0].coffees.filter(coffee => inMonth(coffee, 'NEW')).slice(0, MAX_ITEMS);
    const drops = [...lists[1].coffees, ...lists[2].coffees].filter(coffee => !seen.has(coffee.id) && seen.add(coffee.id))
      .flatMap(coffee => { const drop = inMonth(coffee, 'DEAL') ?? inMonth(coffee, 'PRICE_DROP'); return drop ? [{ coffee, line: itemLines({ coffee, drop }) }] : []; })
      .filter(({ line }) => line.drop).slice(0, MAX_ITEMS);
    return { picks, fresh, drops };
  } catch (error) {
    unstable_rethrow(error);
    return { picks: await resolvePicks(null, issue.picks), fresh: [], drops: [] };
  }
});

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const issue = findIssue((await params).month);
  if (!issue) return { ...pageMetadata('Sayı bulunamadı', 'Bu bülten sayısı yok.', '/bulten'), robots: { index: false } };
  const metadata = pageMetadata(issue.title, issue.intro, `/bulten/${issue.month}`);
  return { ...metadata, openGraph: { ...metadata.openGraph, type: 'article', publishedTime: `${issue.month}-01` }, ...(issue.published ? {} : { robots: { index: false } }) };
}

function InlineText({ parts }: { parts: Inline }) {
  return parts.map((part, index) => !part.href ? part.text
    : part.href.startsWith('/') ? <Link key={index} href={part.href} className="text-accent underline underline-offset-4 hover:text-accent-deep">{part.text}</Link>
      : <a key={index} href={part.href} rel="noopener noreferrer" className="text-accent underline underline-offset-4 hover:text-accent-deep">{part.text}</a>);
}

export default async function IssuePage({ params }: { params: Promise<{ month: string }> }) {
  const issue = findIssue((await params).month);
  if (!issue) notFound();
  const { picks, fresh, drops } = await loadCatalog(issue);
  const path = `/bulten/${issue.month}`;
  const older = issues[issues.indexOf(issue) + 1];
  const heading = 'mt-12 mb-2 font-display text-[30px]';
  return <div className="page-shell section-space">
    <JsonLd data={{ '@type': 'Article', headline: issue.title, description: issue.intro, datePublished: `${issue.month}-01`, inLanguage: 'tr-TR', url: absoluteUrl(path), mainEntityOfPage: absoluteUrl(path),
      author: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') }, publisher: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') } }} />
    <JsonLd data={breadcrumbList([['Bülten', '/bulten'], [issue.title, path]])} />
    <article className="mx-auto max-w-[760px]">
      <p className="eyebrow">{brand.monthlyName} · {monthLabel(issue.month)}{issue.published ? '' : ' · Taslak'}</p>
      <h1 className="mt-3 font-display text-[clamp(36px,5vw,56px)] leading-[1.06]">{issue.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{issue.intro}</p>

      <h2 className={heading}>Bu ayın favorileri</h2>
      {issue.picksText.map((text, index) => <p key={index} className="mb-3 text-base leading-relaxed"><InlineText parts={text} /></p>)}
      <ol>
        {picks.map(pick => {
          const line = pick.coffee ? itemLines({ coffee: pick.coffee }) : null;
          const status = pick.status === 'sold_out' || pick.status === 'gone' ? PICK_STATUS[pick.status] : null;
          return <li key={pick.slug} className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-b border-line py-[18px]">
            <div className="min-w-0 flex-[1_1_220px]">
              {pick.status === 'gone' && !pick.coffee ? <p className="font-display text-[22px]">{pick.name}</p>
                : <Link href={`/kahve/${encodeURIComponent(pick.coffee?.slug ?? pick.slug)}`} className="inline-flex min-h-11 items-center font-display text-[22px] text-accent hover:text-accent-deep hover:underline">{pick.name}</Link>}
              {line ? <p className="text-[13px] text-muted">{line.roaster}{status ? '' : ` · ${line.price}`}</p> : null}
              {status ? <p className="mt-1 inline-block rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-accent-deep">{status}</p> : null}
            </div>
            <p className="min-w-0 flex-[2_1_320px] text-base leading-relaxed"><InlineText parts={pick.note} /></p>
          </li>;
        })}
      </ol>

      {issue.scene.length || issue.sceneText.length ? <>
        <h2 className={heading}>Sahneden</h2>
        {issue.sceneText.map((text, index) => <p key={index} className="mb-3 text-base leading-relaxed"><InlineText parts={text} /></p>)}
        <ul className="list-disc pl-5 text-base leading-[1.7]">{issue.scene.map((item, index) => <li key={index} className="mb-1"><InlineText parts={item} /></li>)}</ul>
      </> : null}

      <SponsorCard sponsor={issue.sponsor} tag={url => campaignUrl(url, issue.month)} />

      {fresh.length ? <>
        <h2 className={heading}>Bu ay gelenler</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">{fresh.map(coffee => <DiscoveryCard key={coffee.id} coffee={coffee} source="issue" />)}</div>
      </> : null}

      {drops.length ? <>
        <h2 className={heading}>Fiyatı düşenler</h2>
        <ul className="mt-4 rounded-[14px] border border-line bg-surface">
          {drops.map(({ coffee, line }) => <li key={coffee.id} className="border-b border-line last:border-b-0">
            <Link href={`/kahve/${encodeURIComponent(coffee.slug)}`} className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-4 hover:bg-tint">
              <span className="min-w-0 flex-[1_1_200px]"><span className="block font-display text-[19px]">{line.name}</span><span className="text-[13px] text-muted">{line.roaster}</span></span>
              <span className="text-sm font-semibold tabular-nums">{line.drop}</span>
              <span className="text-[13px] text-muted">{line.price}</span>
            </Link>
          </li>)}
        </ul>
      </> : null}

      {signupsEnabled() && <NewsletterForm source="issue" className="mt-14" title="Gelecek sayı e-postana gelsin" />}
      <nav aria-label="Diğer sayılar" className="mt-8 flex justify-between gap-4 text-[15px]">
        {older ? <Link href={`/bulten/${older.month}`} className="text-link">← {monthLabel(older.month)}</Link> : <span />}
        <Link href="/bulten" className="text-link">Tüm sayılar</Link>
      </nav>
    </article>
  </div>;
}
