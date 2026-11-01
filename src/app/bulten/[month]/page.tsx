import { pageMetadata } from '@/lib/page-metadata';
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { brand } from '@/lib/brand';
import { absoluteUrl } from '@/lib/site';
import { getCatalogDatabase, keepOutOfEdgeCache } from '@/lib/v2-runtime';
import { itemLines } from '@/lib/digest-lines';
import { JsonLd, breadcrumbList } from '@/components/layout/json-ld';
import { coffeeOrigin, DiscoveryCard } from '@/components/v2/discovery-card';
import { originLanding } from '@/lib/catalog-landing';
import { catalogStats, type CatalogStats } from '@/lib/catalog-stats';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { SponsorCard } from '@/components/v2/sponsor-card';
import { listCatalog, type CatalogCoffee } from '../../../../shared/v2/catalog';
import type { CoffeeEvent } from '../../../../shared/v2/types';
import { campaignUrl, monthLabel, monthWindow, PICK_STATUS, resolvePicks, type Inline, type Issue } from '../issue';
import { issues } from '../issues.generated';

// The edge keeps this page for EDGE_CACHE_CONTROL (next.config.ts, shared/v2/read-cache.ts); this matches it.
export const revalidate = 172800;
const MAX_ITEMS = 8;
/** Back-in-stock and origin spotlight cards. */
const MAX_CARDS = 4;
/** While its month is running, an issue reads this many days back, so the lists are full from the 1st. */
const RUNNING_DAYS = 30;

/** Only bundled issues exist here; a production build bundles only `published: true` files (scripts/bulten-bundle.mts). */
const findIssue = (month: string) => issues.find(issue => issue.month === month);

/**
 * The month's catalog side. A finished month reads its own calendar month; a running one reads the last RUNNING_DAYS days
 * (so the lists are not empty on the 1st) and adds today's catalog numbers. A failed read keeps the owner's text: picks show
 * their notes, the automated parts are left out.
 */
const loadCatalog = cache(async (issue: Issue) => {
  try {
    const db = await getCatalogDatabase();
    const month = monthWindow(issue.month), now = Date.now();
    const running = now < Date.parse(month.until);
    const recent = new Date(Math.floor(now / 300000) * 300000 - RUNNING_DAYS * 86400000).toISOString();
    const since = running && recent < month.since ? recent : month.since, until = month.until;
    const [picks, stats, ...lists] = await Promise.all([resolvePicks(db, issue.picks), running ? catalogStats(db) : null,
      ...(['NEW', 'DEAL', 'PRICE_DROP', 'RESTOCKED'] as const).map(event => listCatalog(db, { event, since, perPage: 100 }))]);
    // listCatalog has a start but no end; keep coffees whose event fell inside the window.
    // ponytail: newest 100 since the window began, then filtered; a past month with >100 later arrivals loses its oldest ones. Add an `until` filter to listCatalog if that happens.
    const inWindow = (coffee: CatalogCoffee, ...types: CoffeeEvent['type'][]) => coffee.latestEvents.find(event => types.includes(event.type) && event.createdAt >= since && event.createdAt < until);
    const seen = new Set<string>();
    const arrivals = lists[0].coffees.filter(coffee => inWindow(coffee, 'NEW'));
    const spotlight = originSpotlight(arrivals);
    // The spotlight shows its own cards; the arrivals list skips them so no coffee appears twice.
    const fresh = arrivals.filter(coffee => !spotlight?.coffees.includes(coffee)).slice(0, MAX_ITEMS);
    const drops = [...lists[1].coffees, ...lists[2].coffees].filter(coffee => !seen.has(coffee.id) && seen.add(coffee.id))
      .flatMap(coffee => { const drop = inWindow(coffee, 'DEAL') ?? inWindow(coffee, 'PRICE_DROP'); return drop ? [{ coffee, line: itemLines({ coffee, drop }) }] : []; })
      .filter(({ line }) => line.drop).slice(0, MAX_ITEMS);
    const restocked = lists[3].coffees.filter(coffee => inWindow(coffee, 'RESTOCKED') && !arrivals.some(arrival => arrival.id === coffee.id)).slice(0, MAX_CARDS);
    return { picks, fresh, drops, restocked, spotlight, stats, recent: since !== month.since };
  } catch (error) {
    unstable_rethrow(error);
    keepOutOfEdgeCache();
    return { picks: await resolvePicks(null, issue.picks), fresh: [], drops: [], restocked: [], spotlight: null, stats: null, recent: false };
  }
});

/** The single origin with the most arrivals in the window (at least 3, so it is a trend and not one bag), and its newest coffees. */
function originSpotlight(arrivals: CatalogCoffee[]): { label: string; path: string; count: number; coffees: CatalogCoffee[] } | null {
  const byOrigin = new Map<string, CatalogCoffee[]>();
  for (const coffee of arrivals) {
    const label = coffeeOrigin(coffee);
    // A blend reads "Etiyopya ve Kenya" and has no landing page; only single origins count.
    const landing = label ? originLanding(label) : null;
    if (landing) byOrigin.set(landing.path, [...(byOrigin.get(landing.path) ?? []), coffee]);
  }
  const [path, coffees] = [...byOrigin].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!path || !coffees || coffees.length < 3) return null;
  return { label: coffeeOrigin(coffees[0])!, path, count: coffees.length, coffees: coffees.slice(0, 3) };
}

const lira = (value: number) => `${value.toLocaleString('tr-TR')} TL`;
/** Today's catalog in four numbers, from the same derived result as /veri. Package prices only, never per 100 g. */
function CatalogNumbers({ stats }: { stats: CatalogStats }) {
  const bag = stats.bagPrices.find(size => size.weightG === 250);
  const figures: Array<[string, string]> = [[stats.coffees.toLocaleString('tr-TR'), 'kahve satışta'], [stats.roasters.toLocaleString('tr-TR'), 'kavurucu'],
    [stats.newArrivals.coffees.toLocaleString('tr-TR'), `yeni kahve, son ${stats.newArrivals.days} gün`], ...(bag ? [[lira(bag.median), '250 g paketin ortanca fiyatı'] as [string, string]] : [])];
  const day = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(new Date(stats.at));
  return <section aria-labelledby="issue-numbers" className="mt-12 rounded-[18px] bg-tint px-5 py-6 sm:px-7">
    <h2 id="issue-numbers" className="eyebrow">Rakamlarla katalog · {day}</h2>
    <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
      {figures.map(([value, label]) => <div key={label}><dt className="sr-only">{label}</dt><dd><span className="block font-display text-[28px] leading-none tabular-nums">{value}</span><span className="mt-1.5 block text-[13px] leading-snug text-muted">{label}</span></dd></div>)}
    </dl>
    <Link href="/veri" className="text-link mt-2">Tüm rakamlar →</Link>
  </section>;
}

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
  const { picks, fresh, drops, restocked, spotlight, stats, recent } = await loadCatalog(issue);
  const path = `/bulten/${issue.month}`;
  const older = issues[issues.indexOf(issue) + 1];
  const heading = 'mt-12 mb-2 font-display text-[30px]';
  return <div className="page-shell section-space">
    <JsonLd data={{ '@type': 'Article', headline: issue.title, description: issue.intro, datePublished: `${issue.month}-01`, inLanguage: 'tr-TR', url: absoluteUrl(path), mainEntityOfPage: absoluteUrl(path),
      author: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') }, publisher: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') } }} />
    <JsonLd data={breadcrumbList([['Bülten', '/bulten'], [issue.title, path]])} />
    <article className="mx-auto max-w-[760px]">
      <p className="eyebrow">{brand.monthlyName} · {monthLabel(issue.month)}{issue.published ? '' : ' · Taslak'}</p>
      <h1 className="mt-3 font-display text-title">{issue.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{issue.intro}</p>

      <h2 className={heading}>Bu ayın favorileri</h2>
      {issue.picksText.map((text, index) => <p key={index} className="mb-3 text-base leading-relaxed"><InlineText parts={text} /></p>)}
      {/* A listed pick is its catalog card (photo, price, "Kavurucuda gör") beside the owner's note; a pick that left the catalog keeps its name and note. */}
      <ol className="mt-4 grid gap-6">
        {picks.map(pick => {
          const status = pick.status === 'sold_out' || pick.status === 'gone' ? PICK_STATUS[pick.status] : null;
          const note = <p className="min-w-0 text-base leading-relaxed"><InlineText parts={pick.note} /></p>;
          if (pick.coffee) return <li key={pick.slug} className="grid items-start gap-3 sm:grid-cols-[minmax(0,17rem)_1fr] sm:gap-6">
            <DiscoveryCard coffee={pick.coffee} source="issue" />
            <div className="min-w-0">{status ? <p className="mb-2 inline-block rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-accent-deep">{status}</p> : null}{note}</div>
          </li>;
          return <li key={pick.slug} className="border-b border-line pb-5">
            {pick.status === 'gone' ? <p className="font-display text-[22px]">{pick.name}</p>
              : <Link href={`/kahve/${encodeURIComponent(pick.slug)}`} className="inline-flex min-h-11 items-center font-display text-[22px] text-accent hover:text-accent-deep hover:underline">{pick.name}</Link>}
            {status ? <p className="mb-2 mt-1 inline-block rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-accent-deep">{status}</p> : null}
            {note}
          </li>;
        })}
      </ol>

      {stats ? <CatalogNumbers stats={stats} /> : null}

      {issue.scene.length || issue.sceneText.length ? <>
        <h2 className={heading}>Sahneden</h2>
        {issue.sceneText.map((text, index) => <p key={index} className="mb-3 text-base leading-relaxed"><InlineText parts={text} /></p>)}
        <ul className="list-disc pl-5 text-base leading-[1.7]">{issue.scene.map((item, index) => <li key={index} className="mb-1"><InlineText parts={item} /></li>)}</ul>
      </> : null}

      <SponsorCard sponsor={issue.sponsor} tag={url => campaignUrl(url, issue.month)} />

      {spotlight ? <>
        <h2 className={heading}>Ayın kökeni: {spotlight.label}</h2>
        <p className="text-base leading-relaxed text-muted">{recent ? `Son ${RUNNING_DAYS} günde` : 'Bu ay'} {spotlight.count} yeni {spotlight.label} kahvesi geldi; en yenileri:</p>
        <div className="mt-4 card-grid">{spotlight.coffees.map(coffee => <DiscoveryCard key={coffee.id} coffee={coffee} source="issue" />)}</div>
        <Link href={spotlight.path} className="text-link mt-3">Tüm {spotlight.label} kahveleri →</Link>
      </> : null}

      {fresh.length ? <>
        <h2 className={heading}>{spotlight ? 'Diğer yeni gelenler' : recent ? `Son ${RUNNING_DAYS} günde gelenler` : 'Bu ay gelenler'}</h2>
        <div className="mt-4 card-grid">{fresh.map(coffee => <DiscoveryCard key={coffee.id} coffee={coffee} source="issue" />)}</div>
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

      {restocked.length ? <>
        <h2 className={heading}>Tekrar raflarda</h2>
        <div className="mt-4 card-grid">{restocked.map(coffee => <DiscoveryCard key={coffee.id} coffee={coffee} source="issue" />)}</div>
      </> : null}

      {signupsEnabled() && <NewsletterForm source="issue" className="mt-14" title="Gelecek sayı e-postana gelsin" />}
      <nav aria-label="Diğer sayılar" className="mt-8 flex justify-between gap-4 text-[15px]">
        {older ? <Link href={`/bulten/${older.month}`} className="text-link">← {monthLabel(older.month)}</Link> : <span />}
        <Link href="/bulten" className="text-link">Tüm sayılar</Link>
      </nav>
    </article>
  </div>;
}
