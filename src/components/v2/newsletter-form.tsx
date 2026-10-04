'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { trackProductEvent } from '@/lib/product-events';
import { brand } from '@/lib/brand';

export function NewsletterForm({ source = 'home' }: { source?: string }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setMessage('');
    trackProductEvent({ event: 'newsletter_signup_submit', page: source.startsWith('home') ? 'home' : source === 'detail' ? 'coffee' : 'catalog', source: source === 'home-hero' || source === 'home-bottom' || source === 'catalog' || source === 'detail' ? source : 'home' });
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), website: data.get('website'), source, referrer: window.location.href }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setMessage(response.status === 429 ? 'Çok sık deneme yaptın. Bir dakika sonra tekrar dene.' : 'Şu an kaydını tamamlayamadık. Biraz sonra tekrar dene.');
        return;
      }
      setSuccess(true);
      setMessage('Başvurun alındı. Gerekliyse aboneliğini onaylamak için e-posta kutunu kontrol et.');
      window.location.assign('/tesekkurler');
    } catch { setMessage('Bağlantı kurulamadı. Biraz sonra tekrar deneyebilirsin.'); }
    finally { setPending(false); }
  }

  return <section id={source === 'home-hero' || source === 'home' || source === 'home-bottom' ? 'haftalik-drop' : undefined} className="rounded-3xl bg-[#244b3d] p-6 text-white sm:p-9">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#d9e5ba]">{brand.newsletterName}</p>
    <h2 className="mt-3 font-display text-3xl sm:text-4xl">Bir sonraki kahven, gelen kutunda.</h2>
    <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">{brand.newsletterPromise}</p>
    {success ? <div className="mt-6"><p role="status" className="rounded-xl bg-white/10 p-4 text-sm leading-6">{message}</p><Link href="/quiz" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">İstersen damak zevkini anlat →</Link></div> : <form method="post" action="/api/subscribe" onSubmit={subscribe} className="relative mt-6">
      <label htmlFor={id + '-email'} className="mb-2 block text-sm font-medium">E-posta adresin</label>
      <input id={id + '-email'} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="sen@ornek.com" className="min-h-12 w-full rounded-lg border border-transparent bg-white px-4 text-base text-[#1f1d1b] outline-offset-4" disabled={pending} />
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor={id + '-website'}>Website</label><input id={id + '-website'} name="website" tabIndex={-1} autoComplete="off" /></div>
      <button type="submit" disabled={pending} className="mt-3 min-h-12 w-full rounded-lg bg-[#e3ecbd] px-4 py-3 text-sm font-semibold text-[#18372b] hover:bg-[#edf4d9] disabled:cursor-wait disabled:opacity-70">{pending ? 'Kaydediliyor…' : brand.newsletterName + '’a katıl'}</button>
      {message ? <p role="alert" className="mt-3 rounded-lg bg-white/10 p-3 text-sm leading-6">{message}</p> : null}
      <p className="mt-4 text-xs leading-6 text-white/80">Ücretsiz. Hesap açman gerekmez. İstediğinde ayrılabilirsin. E-postanı bülteni göndermek için Kit ile işleriz. <Link href="/privacy" className="underline underline-offset-2">Gizlilik</Link></p>
      <noscript><p className="mt-3 text-sm">Bu form için JavaScript’i açman gerekiyor.</p></noscript>
    </form>}
  </section>;
}
