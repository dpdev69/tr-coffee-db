'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { trackProductEvent } from '@/lib/product-events';
import {
  buildQuizFilterResult,
  createInitialQuizAnswers,
  hasQuizSelections,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizArrayAnswerKey,
  type QuizStep,
} from '@/lib/quiz-filters';

export function QuizContainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(createInitialQuizAnswers);
  const started = useRef(false);
  const mounted = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const isComplete = stepIndex >= QUIZ_STEPS.length;
  const current = QUIZ_STEPS[Math.min(stepIndex, QUIZ_STEPS.length - 1)];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;
  const result = useMemo(() => buildQuizFilterResult(answers), [answers]);
  const hasAnySelections = hasQuizSelections(answers);
  const selectedValues = getSelectedValues(current, answers);
  const selectedCount = selectedValues.length;

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

    setAnswers((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];

      return { ...prev, [key]: nextValues };
    });
  }

  function advanceStep() {
    trackStarted();
    if (isLastStep) {
      trackProductEvent({ event: 'quiz_completed', page: 'quiz', source: 'quiz' });
      setStepIndex(QUIZ_STEPS.length);
    } else {
      setStepIndex((index) => index + 1);
    }
  }

  function resetCurrentStep() {
    setAnswers((prev) => ({ ...prev, [current.id]: [] }));
  }

  function resetQuiz() {
    started.current = false;
    setStepIndex(0);
    setAnswers(createInitialQuizAnswers());
  }

  if (isComplete) {
    return (
      <div
        ref={cardRef}
        className="scroll-mt-28 rounded-[24px] border border-[#30251f]/10 bg-[#fffdf8] p-5 text-center sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ead9c5] text-[#30251f]">
          <CheckIcon />
        </div>
        <h2
          ref={questionRef}
          tabIndex={-1}
          className="mt-4 font-display text-3xl leading-none text-[#30251f]"
        >
          {hasAnySelections ? 'Bir sonraki kahven bu seçimlerde.' : 'Keşfe açık bir fincan.'}
        </h2>
        <p className="mt-2 text-[#716257]">
          {hasAnySelections ? 'Aradığın tatlara ve demleme rutinine uyan kahveleri keşfet.' : 'Güncel kahveleri birlikte keşfedelim.'}
        </p>
        {result.explanations.length > 0 && (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-[#30251f]/10 bg-[#fbf6ed] p-4 text-left">
            <h3 className="text-sm font-semibold text-[#30251f]">
              Senin kahve profilin
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[#716257]">
              {result.explanations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#30251f]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.explanations.length === 0 && (
          <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-[#30251f]/10 bg-[#fbf6ed] p-4 text-sm text-[#716257]">
            Henüz bir tercihin yok. Katalogda tatları ve kavurucuları keşfederek başlayabilirsin.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={result.url}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#30251f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6d3d2a]"
          >
            Kahvelerimi keşfet
            <ArrowRightIcon />
          </Link>
          <button
            type="button"
            onClick={() => setStepIndex(QUIZ_STEPS.length - 1)}
            className="button-light border border-[#d7c5b4]"
          >
            Seçimlerimi düzenle
          </button>
          <button
            type="button"
            onClick={resetQuiz}
            className="inline-flex items-center justify-center rounded-lg border border-[#30251f] px-6 py-3 text-sm font-semibold text-[#30251f] hover:bg-[#f6f1e8]"
          >
            Tercihleri Yeniden Seç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="scroll-mt-28 rounded-[24px] border border-[#30251f]/10 bg-[#fffdf8] p-5 sm:p-6"
    >
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#30251f]/45">
          <span>
            Soru {stepIndex + 1} / {QUIZ_STEPS.length}
          </span>
          <span>
            {selectedCount > 0 ? `${selectedCount} seçim` : 'Opsiyonel'}
          </span>
        </div>
        <div
          className="mt-3 flex gap-1"
          role="progressbar"
          aria-label="Quiz ilerlemesi"
          aria-valuemin={1}
          aria-valuemax={QUIZ_STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={`${stepIndex + 1}. soru / ${QUIZ_STEPS.length}`}
        >
          {QUIZ_STEPS.map((stepItem, index) => (
            <div
              key={stepItem.id}
              className={`h-1.5 flex-1 rounded-full ${
                index <= stepIndex ? 'bg-[#30251f]' : 'bg-[#30251f]/10'
              }`}
            />
          ))}
        </div>
      </div>

      <h2
        ref={questionRef}
        tabIndex={-1}
        className="rounded-md font-display text-3xl leading-none text-[#30251f] focus:outline-none focus:ring-2 focus:ring-[#30251f] focus:ring-offset-4"
      >
        {current.question}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#716257]">{current.helper}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {current.options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value);

          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleOption(opt.value)}
              aria-pressed={isSelected}
              className={`flex min-h-[96px] items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${
                isSelected
                  ? 'border-[#30251f] bg-[#ead9c5] text-[#30251f]'
                  : 'border-[#30251f]/12 bg-[#fffdf8] text-[#30251f] hover:border-[#30251f]/30 hover:bg-[#f6f1e8]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-[#30251f] bg-[#30251f] text-white'
                    : 'border-[#30251f]/25 bg-[#fffdf8] text-transparent'
                }`}
                aria-hidden="true"
              >
                <SmallCheckIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="mt-1 block text-xs leading-5 text-[#716257]">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex min-h-8 items-center justify-between gap-3 text-sm">
        <div>
          <span className="text-[#716257]">
            {selectedCount > 0
              ? `${selectedCount} seçim eklendi`
              : 'Bu adımı boş geçebilirsin'}
          </span>

        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={resetCurrentStep}
            className="font-semibold text-[#30251f] underline-offset-4 hover:underline"
          >
            Bu adımı temizle
          </button>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#30251f]/70 hover:bg-[#f6f1e8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeftIcon />
          Geri
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          {isLastStep && !hasAnySelections && (
            <Link
              href="/kahveler"
              className="inline-flex items-center gap-2 rounded-lg border border-[#30251f] px-4 py-2 text-sm font-semibold text-[#30251f] hover:bg-[#f6f1e8]"
            >
              Tüm kataloğu aç
            </Link>
          )}
          <button
            type="button"
            onClick={advanceStep}
            className="inline-flex items-center gap-2 rounded-lg bg-[#30251f] px-6 py-2 text-sm font-semibold text-white hover:bg-[#6d3d2a]"
          >
            {isLastStep ? 'Sonuçları Gör' : selectedCount > 0 ? 'İleri' : 'Bu adımı geç'}
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function getSelectedValues(step: QuizStep, answers: QuizAnswers) {
  return answers[step.id as QuizArrayAnswerKey];
}

function CheckIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function SmallCheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="3"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m-6-6 6 6-6 6"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H5m6 6-6-6 6-6"
      />
    </svg>
  );
}
