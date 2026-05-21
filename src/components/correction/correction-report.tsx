'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';

const ISSUE_OPTIONS = [
  { value: 'stale_price', label: 'Fiyat eski veya hatalı' },
  { value: 'broken_link', label: 'Link çalışmıyor' },
  { value: 'unavailable_product', label: 'Ürün satışta değil' },
  { value: 'wrong_metadata', label: 'Kahve bilgisi yanlış' },
  { value: 'missing_product', label: 'Eksik ürün var' },
  { value: 'other', label: 'Diğer' },
] as const;

type IssueType = (typeof ISSUE_OPTIONS)[number]['value'];
type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function CorrectionReport({
  coffeeId,
  roasterId,
  className = '',
}: {
  coffeeId?: string | null;
  roasterId?: string | null;
  className?: string;
}) {
  const issueId = useId();
  const emailId = useId();
  const messageId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>('wrong_metadata');
  const [reporterEmail, setReporterEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState('submitting');

    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_type: issueType,
          reporter_email: reporterEmail,
          message,
          source_path: window.location.pathname,
          coffee_id: coffeeId ?? null,
          roaster_id: roasterId ?? null,
          honeypot,
        }),
      });

      if (!response.ok) {
        throw new Error('Correction report failed');
      }

      setSubmitState('success');
      setMessage('');
      setHoneypot('');
    } catch {
      setSubmitState('error');
    }
  }

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          if (submitState === 'error') setSubmitState('idle');
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 transition-colors hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        aria-expanded={isOpen}
      >
        Bilgilerde hata bildir
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={issueId} className="block text-sm font-medium text-stone-700">
                Hata türü
              </label>
              <select
                id={issueId}
                value={issueType}
                onChange={(event) => setIssueType(event.target.value as IssueType)}
                disabled={submitState === 'submitting'}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-stone-100"
              >
                {ISSUE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={emailId} className="block text-sm font-medium text-stone-700">
                E-posta
              </label>
              <input
                id={emailId}
                type="email"
                value={reporterEmail}
                onChange={(event) => setReporterEmail(event.target.value)}
                disabled={submitState === 'submitting'}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-stone-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor={messageId} className="block text-sm font-medium text-stone-700">
              Mesaj
            </label>
            <textarea
              id={messageId}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={submitState === 'submitting'}
              required
              rows={4}
              maxLength={2000}
              placeholder="Neyi düzeltmemiz gerektiğini kısaca yazın."
              className="mt-1 w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-stone-100"
            />
          </div>

          <div className="hidden" aria-hidden="true">
            <label>
              Web sitesi
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              className="inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {submitState === 'submitting' ? 'Gönderiliyor...' : 'Gönder'}
            </button>

            {submitState === 'success' && (
              <p className="text-sm font-medium text-emerald-700">
                Teşekkürler, bildiriminiz alındı.
              </p>
            )}
            {submitState === 'error' && (
              <p className="text-sm font-medium text-red-700">
                Gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
