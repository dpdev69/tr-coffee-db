import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';
import { SITE_NAME } from '@/lib/site';

const description =
  '4 kısa soruyu yanıtlayın; damak tadınıza, demleme yönteminize ve kavrum tercihinize uygun nitelikli kahveleri filtreleyelim.';

export const metadata: Metadata = {
  title: 'Damak Tadına Göre Kahve Bul',
  description,
  alternates: {
    canonical: '/quiz',
  },
  openGraph: {
    title: `Damak Tadına Göre Kahve Bul | ${SITE_NAME}`,
    description,
    url: '/quiz',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Damak Tadına Göre Kahve Bul | ${SITE_NAME}`,
    description,
  },
};

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
          Kahve eşleştirici
        </p>
        <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">
          Damak tadına göre kahve bul.
        </h1>
        <p className="mt-4 text-[#5d5853]">
          4 kısa soruyu yanıtlayın; size uygun çekirdekleri gerçek katalog filtreleriyle daraltalım.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
