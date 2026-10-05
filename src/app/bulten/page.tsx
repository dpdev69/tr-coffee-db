import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/lib/brand';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { monthLabel } from './issue';
import { issues } from './issues.generated';

// Issues change only with a deploy; cacheable at the edge like the guide.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata(`${brand.monthlyName}: aylık kahve bülteni`, 'Ayın favori kahveleri ve Türkiye kahve sahnesinden haberler, ayda bir. Tüm sayılar.', '/bulten');

export default function IssueIndexPage() {
  return <div className="page-shell section-space">
    <div className="mx-auto max-w-[760px]">
      <p className="eyebrow">Aylık bülten</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.08]">{brand.monthlyName}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">Ayın favori kahveleri ve Türkiye kahve sahnesinden haberler, ayda bir.</p>
      {issues.length ? <ol className="mt-10 border-t border-line">
        {issues.map(issue => <li key={issue.month} className="border-b border-line py-6">
          <p className="text-sm font-semibold text-warm">{monthLabel(issue.month)}{issue.published ? '' : ' · Taslak (yalnızca yerel önizleme)'}</p>
          <h2 className="mt-1 font-display text-[26px] leading-tight"><Link href={`/bulten/${issue.month}`} className="hover:text-accent hover:underline">{issue.title}</Link></h2>
          <p className="mt-2 text-base leading-relaxed text-muted">{issue.intro}</p>
        </li>)}
      </ol> : <p className="mt-10 border-t border-line pt-6 text-base text-muted">{signupsEnabled() ? 'İlk sayı yakında. Yayımlandığında e-postana gelsin.' : 'İlk sayı yakında.'}</p>}
      {signupsEnabled() && <NewsletterForm source="issue" className="mt-14" title="Gelecek sayı e-postana gelsin" />}
    </div>
  </div>;
}
