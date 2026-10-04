import type { QuizAnswers } from '@/lib/quiz-filters';

/** Mount point for the quiz scene (three.js, owned by the animation pass). Intentionally empty; its box is reserved in CSS so nothing shifts when the scene mounts. */
export function QuizSceneSlot({ step, answers }: { step: '1' | '2' | '3' | '4' | 'result'; answers: QuizAnswers }) {
  return <div className="quiz-scene" aria-hidden="true" data-scene-slot="quiz" data-step={step}
    data-brew={answers.brew.join(',')} data-taste={answers.taste.join(',')} data-roast={answers.roast.join(',')} data-process={answers.process.join(',')} />;
}
