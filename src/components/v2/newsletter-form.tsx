'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { trackProductEvent } from '@/lib/product-events';
import { brand, newsletterConsent } from '@/lib/brand';
import { SUBSCRIBE_SOURCES, analyticsSource } from '@/lib/v2-subscribe';

const SKIN = {
  band: {
    box: 'bg-accent text-on-accent', title: 'text-on-accent', text: 'text-chip', label: 'text-on-accent', consent: 'text-chip',
    check: 'accent-chip', button: 'bg-chip text-accent-deep hover:bg-surface', box2: 'bg-on-accent/15', link: 'text-on-accent',
  },
  card: {
    box: 'border border-line bg-surface text-ink', title: 'text-ink', text: 'text-muted', label: 'text-ink', consent: 'text-muted',
    check: 'accent-accent', button: 'bg-accent text-on-accent hover:bg-accent-deep', box2: 'bg-tint', link: 'text-accent',
  },
} as const;

/** What a form post without JavaScript can show: the server redirects back to `#nl-<source>-<code>`. */
const FORM_ERRORS = {
  gecersiz: 'Geçerli bir e-posta adresiyle yeniden deneyebilirsin.',
  onay: 'Devam etmek için onay kutusunu işaretlemelisin.',
  'cok-sik': 'Çok fazla deneme yaptın. Bir dakika sonra yeniden deneyebilirsin.',
  hata: 'Şu an kaydını tamamlayamadık. Biraz sonra tekrar dene.',
} as const;

export function NewsletterForm({ source = 'home-bottom', variant = 'band', compact = false, className = '', title = 'Ayda bir bülten, haftada bir fiyat özeti', description = brand.signupPromise }: {
  source?: string; variant?: 'band' | 'card'; compact?: boolean; className?: string; title?: string; description?: string;
}) {
  const id = useId();
  const skin = SKIN[variant];
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [before, after] = newsletterConsent.text.split(newsletterConsent.linkText);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setMessage('');
    trackProductEvent({ event: 'newsletter_signup_submit', page: SUBSCRIBE_SOURCES[source] ?? 'other', source: analyticsSource(source) });
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), website: data.get('website'), consent: data.get('consent') === 'on', source, referrer: window.location.href }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) { setMessage(result.message || FORM_ERRORS.hata); return; }
      setSuccess(result.message ?? '');
    } catch { setMessage('Bağlantı kurulamadı. Biraz sonra tekrar deneyebilirsin.'); }
    finally { setPending(false); }
  }

  return <section id={source.startsWith('home') ? 'haftalik-drop' : undefined} data-newsletter={source} className={`flex flex-wrap items-center gap-6 rounded-[20px] ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-9 lg:gap-x-12'} ${skin.box} ${className}`}>
    <div className={compact ? 'basis-full' : 'min-w-0 flex-[1_1_300px]'}>
      <h2 className={`font-display ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'} leading-tight ${skin.title}`}>{title.split(/(e-posta\S*)/).map((part, index) => index % 2 ? <span key={index} className="whitespace-nowrap">{part}</span> : part)}</h2>
      <p className={`mt-2 text-base leading-relaxed ${skin.text}`}>{description}</p>
    </div>
    <div className={compact ? 'basis-full' : 'min-w-0 flex-[1_1_320px]'}>
      {/* Live region exists before the message does, so screen readers announce the swap. The hook for a later animation pass. */}
      <div aria-live="polite" className="newsletter-success" data-newsletter-success={success !== null ? 'true' : undefined}>
        {success !== null ? <>
          <p className={`rounded-xl p-4 text-base leading-relaxed ${skin.box2}`}>{success}</p>
          <Link href="/quiz" className={`mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${skin.link}`}>İstersen damak zevkini anlat →</Link>
        </> : null}
      </div>
      {success === null ? <form method="post" action={`/api/subscribe?source=${encodeURIComponent(source)}`} onSubmit={subscribe} className="relative flex flex-col gap-3">
        <input type="hidden" name="source" value={source} />
        <label htmlFor={id + '-email'} className={`text-sm font-medium ${skin.label}`}>E-posta adresin</label>
        <div className="flex flex-wrap gap-2.5">
          <input id={id + '-email'} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="ornek@eposta.com" disabled={pending} className="min-h-12 min-w-0 flex-[1_1_200px] rounded-[10px] border border-line bg-surface px-3.5 text-base text-ink outline-offset-4" />
          <button type="submit" disabled={pending} className={`min-h-12 rounded-[10px] px-5 text-base font-semibold disabled:cursor-wait disabled:opacity-70 ${skin.button}`}>{pending ? 'Kaydediliyor…' : 'Abone ol'}</button>
        </div>
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor={id + '-website'}>Website</label><input id={id + '-website'} name="website" tabIndex={-1} autoComplete="off" /></div>
        <label className={`flex items-start gap-2.5 text-[13px] leading-normal ${skin.consent}`}>
          <input type="checkbox" name="consent" required disabled={pending} className={`mt-0.5 h-5 w-5 shrink-0 ${skin.check}`} />
          <span>{before}<Link href="/privacy" className="underline underline-offset-2">{newsletterConsent.linkText}</Link>{after}</span>
        </label>
        {message ? <p role="alert" className={`rounded-lg p-3 text-sm leading-6 ${skin.box2}`}>{message}</p> : null}
        {Object.entries(FORM_ERRORS).map(([code, text]) => <p key={code} id={`nl-${source}-${code}`} className={`hidden rounded-lg p-3 text-sm leading-6 target:block ${skin.box2}`}>{text}</p>)}
      </form> : null}
    </div>
  </section>;
}
