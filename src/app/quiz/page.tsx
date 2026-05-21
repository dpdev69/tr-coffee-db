import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';
import { SITE_NAME } from '@/lib/site';

const description =
  '5 kısa soruyu yanıtlayın; damak tadınıza, demleme yönteminize ve bütçenize uygun nitelikli kahveleri filtreleyelim.';

export const metadata: Metadata = {
  title: 'Tercihime Göre Kahve Bul',
  description,
  alternates: {
    canonical: '/quiz',
  },
  openGraph: {
    title: `Tercihime Göre Kahve Bul | ${SITE_NAME}`,
    description,
    url: '/quiz',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Tercihime Göre Kahve Bul | ${SITE_NAME}`,
    description,
  },
};

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Tercihime Göre Kahve Bul</h1>
        <p className="mt-3 text-stone-500">
          5 kısa soruyu yanıtlayın; size uygun çekirdekleri gerçek katalog filtreleriyle daraltalım.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
