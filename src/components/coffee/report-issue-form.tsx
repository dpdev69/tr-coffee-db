'use client';

import { useState } from 'react';

const ISSUE_OPTIONS = [
  { value: 'stale_price', label: 'Fiyat eski görünüyor' },
  { value: 'broken_link', label: 'Bağlantı çalışmıyor' },
  { value: 'unavailable_product', label: 'Ürün stokta değil' },
  { value: 'wrong_metadata', label: 'Kahve bilgisi hatalı' },
  { value: 'missing_product', label: 'Kavurucuda farklı ürün var' },
  { value: 'other', label: 'Başka bir sorun' },
] as const;

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function ReportIssueForm({
  coffeeId,
  roasterId,
}: {
  coffeeId: string;
  roasterId: string;
}) {
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/correction-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coffee_id: coffeeId,
          roaster_id: roasterId,
          issue_type: formData.get('issue_type'),
          reporter_email: formData.get('reporter_email'),
          message: formData.get('message'),
          source_path: window.location.pathname,
        }),
      });

      if (!response.ok) {
        setState('error');
        setError('Rapor gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.');
        return;
      }

      event.currentTarget.reset();
      setState('success');
    } catch {
      setState('error');
      setError('Rapor gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    }
  }

  return (
    <details className="mt-5 rounded-2xl border border-[#1f1d1b]/10 bg-[#fffdf8] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#1f1d1b]">
        Bilgilerde sorun var mı?
      </summary>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-[#5d5853]">Sorun türü</span>
          <select
            name="issue_type"
            required
            className="mt-1 h-11 w-full rounded-lg border border-[#1f1d1b]/20 bg-white px-3 text-sm text-[#1f1d1b] focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
          >
            {ISSUE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[#5d5853]">E-posta</span>
          <input
            name="reporter_email"
            type="email"
            required
            maxLength={254}
            placeholder="size@example.com"
            className="mt-1 h-11 w-full rounded-lg border border-[#1f1d1b]/20 bg-white px-3 text-sm text-[#1f1d1b] placeholder:text-[#5d5853]/60 focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[#5d5853]">Mesaj</span>
          <textarea
            name="message"
            required
            minLength={1}
            maxLength={2000}
            rows={4}
            placeholder="Hangi bilginin düzeltilmesi gerektiğini kısaca yazın."
            className="mt-1 w-full resize-y rounded-lg border border-[#1f1d1b]/20 bg-white px-3 py-2 text-sm text-[#1f1d1b] placeholder:text-[#5d5853]/60 focus:border-[#1f1d1b] focus:outline-none focus:ring-1 focus:ring-[#1f1d1b]"
          />
        </label>

        {state === 'success' && (
          <p className="rounded-lg bg-[#ecff64]/45 px-3 py-2 text-sm font-medium text-[#1f1d1b]">
            Teşekkürler. Rapor inceleme kuyruğuna alındı.
          </p>
        )}
        {state === 'error' && error && (
          <p className="rounded-lg bg-[#8b3f24]/10 px-3 py-2 text-sm font-medium text-[#8b3f24]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'submitting'}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1f1d1b] px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'submitting' ? 'Gönderiliyor' : 'Rapor gönder'}
        </button>
      </form>
    </details>
  );
}
