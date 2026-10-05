'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackProductEvent } from '@/lib/product-events';
import {
  createInitialQuizAnswers,
  hasQuizSelections,
  loadTasteProfile,
  parseQuizAnswers,
  QUIZ_ANY,
  QUIZ_STEPS,
  quizResultUrl,
  saveTasteProfile,
  type QuizAnswers,
} from '@/lib/quiz-filters';

export function QuizContainer() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(createInitialQuizAnswers);
  const [prefilled, setPrefilled] = useState(false);
  const started = useRef(false);
  const mounted = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const current = QUIZ_STEPS[stepIndex];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;
  const selectedValues = answers[current.id];
  const selectedCount = selectedValues.length;

  // Start from the answers in the link ("Cevapları değiştir") or, failing that, the profile saved on this device.
  // Read after mount: the page is static, and storage does not exist on the server.
  useEffect(() => {
    const fromUrl = parseQuizAnswers(new URLSearchParams(window.location.search));
    const initial = hasQuizSelections(fromUrl) ? fromUrl : loadTasteProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after hydration
    if (initial && hasQuizSelections(initial)) { setAnswers(initial); setPrefilled(true); }
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    cardRef.current?.scrollIntoView({ block: 'start' });
    questionRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  function trackStarted() {
    if (started.current) return;
    started.current = true;
    trackProductEvent({ event: 'quiz_started', page: 'quiz', source: 'quiz' });
  }

  function toggleOption(value: string) {
    trackStarted();
    const key = current.id;
    setAnswers((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));
  }

  function chooseAny() {
    trackStarted();
    setAnswers((prev) => ({ ...prev, [current.id]: [] }));
  }

  function advanceStep() {
    trackStarted();
    if (!isLastStep) { setStepIndex((index) => index + 1); return; }
    trackProductEvent({ event: 'quiz_completed', page: 'quiz', source: 'quiz' });
    saveTasteProfile(answers);
    router.push(quizResultUrl(answers));
  }

  function resetQuiz() {
    setAnswers(createInitialQuizAnswers());
    setPrefilled(false);
    setStepIndex(0);
    // The button that had focus disappears with the notice; keep the keyboard on the question.
    questionRef.current?.focus();
  }

  return (
    <div className="quiz-layout">
      <div ref={cardRef} className="scroll-mt-28 rounded-[18px] border border-line bg-surface p-5 sm:p-6">
        <div className="mb-7">
          <div className="flex items-center justify-between gap-4 text-sm text-muted">
            <span>Adım {stepIndex + 1} / {QUIZ_STEPS.length}</span>
            <span>{current.short}</span>
          </div>
          <div
            className="mt-3 flex gap-1"
            role="progressbar"
            aria-label="Test ilerlemesi"
            aria-valuemin={1}
            aria-valuemax={QUIZ_STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-valuetext={`${stepIndex + 1}. adım / ${QUIZ_STEPS.length}: ${current.short}`}
          >
            {QUIZ_STEPS.map((stepItem, index) => (
              <div key={stepItem.id} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? 'bg-accent' : 'bg-line'}`} />
            ))}
          </div>
          {prefilled && stepIndex === 0 ? (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              Önceki cevapların işaretli.
              <button type="button" onClick={resetQuiz} className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-4 hover:underline">Baştan başla</button>
            </p>
          ) : null}
        </div>

        <h2
          ref={questionRef}
          tabIndex={-1}
          className="rounded-md font-display text-[30px] leading-tight text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
        >
          {current.question}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">{current.helper}</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.options.map((opt) => (
            <OptionButton key={opt.value} label={opt.label} description={opt.description} pressed={selectedValues.includes(opt.value)} onClick={() => toggleOption(opt.value)} />
          ))}
          <OptionButton label={QUIZ_ANY.label} description={QUIZ_ANY.description} pressed={selectedCount === 0} onClick={chooseAny} />
        </div>

        <p className="mt-5 min-h-8 text-sm text-muted" aria-live="polite">
          {selectedCount > 0 ? `${selectedCount} seçim` : 'Bu adım sıralamaya katılmayacak.'}
        </p>

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            className="button-light button-lg disabled:cursor-not-allowed disabled:border-line disabled:text-muted"
          >
            <ArrowLeftIcon />
            Geri
          </button>
          <button type="button" onClick={advanceStep} className="button-dark button-lg">
            {isLastStep ? 'Sonuçları gör' : 'Devam'}
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionButton({ label, description, pressed, onClick }: { label: string; description?: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex min-h-[60px] items-start gap-3 rounded-[14px] px-4 py-3 text-left transition-colors ${
        pressed ? 'border-2 border-accent bg-chip text-ink' : 'border border-line bg-surface text-ink hover:border-accent'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          pressed ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-transparent'
        }`}
        aria-hidden="true"
      >
        <SmallCheckIcon />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[19px] leading-6">{label}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>}
      </span>
    </button>
  );
}

function SmallCheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 6-6-6 6-6" />
    </svg>
  );
}
