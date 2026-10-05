import type { Metadata } from 'next';
import { displayCoffeeName } from '@/lib/coffee-display';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { DiscoveryEmpty, OfferPrice, preferredOffer } from '@/components/v2/discovery-card';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { brand } from '@/lib/brand';
import { pageMetadata } from '@/lib/page-metadata';
import { formatQuizReason, hasQuizSelections, parseQuizAnswers, quizAnswerSummary, quizQuery } from '@/lib/quiz-filters';
import { getCatalogDatabase } from '@/lib/v2-runtime';
import { rankQuizMatches } from '../../../../shared/v2/quiz-rank';

// A result is personal and lives in its URL: shareable, bookmarkable, never indexed.
export const metadata: Metadata = {
  ...pageMetadata('Damak testi sonucun', 'Cevaplarına göre sıralanmış nitelikli kahveler ve her birinin neden seçildiği.', '/quiz/sonuc'),
  robots: { index: false, follow: true },
};

export default async function QuizResultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const answers = parseQuizAnswers(await searchParams);
  const answered = hasQuizSelections(answers);
  const query = quizQuery(answers);
  let result: Awaited<ReturnType<typeof rankQuizMatches>> | null = null;
  try { result = await rankQuizMatches(await getCatalogDatabase(), answers, 8); }
  catch (error) { unstable_rethrow(error); console.error('Quiz ranking failed', error instanceof Error ? error.message : 'Unknown database error'); }

  const heading = !answered ? 'Her şeye açık bir damak' : result && !result.exact ? 'Tam eşleşme yok; en yakın seçenekler' : 'Sana en yakın kahveler';
  const intro = !answered
    ? 'Her adımda “Fark etmez” dedin; listedeki en yeni kahveleri, her kavurucudan en çok ikisini gösteriyoruz.'
    : `Bugün listede olan ${result?.total ?? 0} kahveyi cevaplarına göre sıraladık. Kavurucunun kendi yazdığı bilgi, bizim açıklamadan çıkardığımızdan daha ağır basar; bilgisi olmayan kahve ne öne geçer ne geride kalır.`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="quiz-result-head">
        <div className="min-w-0">
          <p className="eyebrow">Damak testi sonucu</p>
          <h1 className="mt-3 font-display text-[clamp(34px,4.6vw,52px)] leading-[1.08] text-ink">{heading}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">{intro}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Cevapların">
            {quizAnswerSummary(answers).map((chip) => <span key={chip} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink">{chip}</span>)}
            <Link href={query ? `/quiz?${query}` : '/quiz'} className="ml-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline-offset-4 hover:underline">Cevapları değiştir</Link>
          </div>
        </div>
      </div>

      <div className="mt-9">
        {!result ? (
          <DataSourceNotice title="Sonuçlar şu an yüklenemiyor." message="Güncel kahveleri doğrulayamıyoruz. Bu sayfayı biraz sonra yenileyebilirsin; cevapların adreste duruyor." actionHref="/kahveler" actionLabel="Tüm kahveler" />
        ) : !result.coffees.length ? (
          <DiscoveryEmpty title="Şu an listede kahve yok.">Kavurucuların güncel kahvelerini yeniden okuduğumuzda burada göreceksin.</DiscoveryEmpty>
        ) : (
          <ol className="flex flex-col gap-4" aria-label="Sıralanmış kahveler">
            {result.coffees.map((coffee, index) => {
              const offer = preferredOffer(coffee);
              return (
                <li key={coffee.id} className="flex flex-wrap items-start gap-x-4 gap-y-4 rounded-[14px] sm:gap-x-6 border border-line bg-surface p-5 sm:p-6">
                  <span className="w-8 font-display text-[32px] leading-none text-warm sm:w-9 sm:text-[40px]" aria-hidden="true">{index + 1}</span>
                  <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
                    <h2 className="font-display text-2xl leading-tight text-ink"><Link href={`/kahve/${coffee.slug}`} prefetch={false} className="hover:underline">{displayCoffeeName(coffee.name)}</Link></h2>
                    <p className="text-sm text-muted"><Link href={`/kavurucu/${coffee.roaster.slug}`} className="hover:text-accent hover:underline">{coffee.roaster.name}</Link>{coffee.roaster.city ? ` · ${coffee.roaster.city}` : ''}</p>
                    {coffee.quizReasons.length ? (
                      <ul className="mt-2 flex flex-col gap-1.5" aria-label="Neden bu kahve">
                        {coffee.quizReasons.map((reason) => {
                          const line = formatQuizReason(reason);
                          const good = line.kind === 'match' || line.kind === 'near';
                          return (
                            <li key={line.dimension} className={`flex items-baseline gap-2 text-[15px] ${good ? 'text-ink' : 'text-muted'}`}>
                              <span aria-hidden="true" className={`w-3.5 shrink-0 ${good ? 'text-accent' : 'text-muted'}`}>{good ? '✓' : '–'}</span>
                              <span>{line.text}{line.source ? <span className="text-[13px] text-muted"> ({line.source})</span> : null}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2.5">
                    <OfferPrice offer={offer} />
                    <Link href={`/kahve/${coffee.slug}`} prefetch={false} className="text-link inline-flex min-h-11 items-center">Kahveyi gör →</Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {signupsEnabled() && <NewsletterForm source="quiz" className="mt-12" title="Damağına uyan yeni kahveler gelince haber verelim" description={`${brand.signupPromise} Cevapların e-postanla birlikte gönderilmez.`} />}
    </div>
  );
}
