import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';

export const metadata: Metadata = {
  title: 'Kahve Eşleştirici',
  description:
    '5 kısa soruyu yanıtlayın, size uygun nitelikli kahveyi bulalım.',
};

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Kahve Eşleştirici</h1>
        <p className="mt-3 text-stone-500">
          5 kısa soruyu yanıtlayın, size en uygun kahveyi bulalım.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
