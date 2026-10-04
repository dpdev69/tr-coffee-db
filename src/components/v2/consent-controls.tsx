'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { analyticsConsent, consentChoice, CONSENT_COOKIE, type ConsentChoice } from '../../../shared/v2/consent';

const subscribeConsent = (notify: () => void) => { window.addEventListener('kahvedrop-consent', notify); return () => window.removeEventListener('kahvedrop-consent', notify); };
const readConsent = () => consentChoice(document.cookie);

export function ConsentControls({ initialChoice }: { initialChoice: ConsentChoice | null }) {
  const [open, setOpen] = useState(false);
  const choice = useSyncExternalStore(subscribeConsent, readConsent, () => initialChoice);
  function choose(choice: ConsentChoice) {
    const revoke = analyticsConsent(document.cookie) && choice !== 'analytics';
    document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setOpen(false);
    window.dispatchEvent(new Event('kahvedrop-consent'));
    // A full reload stops a previously loaded third-party beacon after withdrawal.
    if (revoke) window.location.reload();
  }
  return <>
    <div className="page-shell pb-5"><button type="button" onClick={() => setOpen(true)} className="min-h-11 text-xs text-muted underline underline-offset-4">Çerez tercihleri</button></div>
    {open || choice === null ? <section aria-label="Çerez tercihleri" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-lg sm:inset-x-6">
      <h2 className="font-display text-xl">Tercih senin.</h2><p className="mt-2 text-sm leading-6 text-muted">Karşılaştırma seçimin ve bu tercihin cihazında tutulur. İzin verirsen siteyi geliştirmek için anonim kullanım ölçümünü açarız. <Link href="/privacy" className="underline underline-offset-4">Gizlilik</Link></p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => choose('essential')} className="button-light border border-line">Yalnızca gerekli</button><button type="button" onClick={() => choose('analytics')} className="button-dark">Ölçüme izin ver</button></div>
    </section> : null}
  </>;
}

export function ConsentedBeacon({ token }: { token: string }) {
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    const sync = () => {
      if (!analyticsConsent(document.cookie) || script) return;
      script = document.createElement('script');
      script.src = 'https://static.cloudflareinsights.com/beacon.min.js'; script.async = true;
      script.dataset.cfBeacon = JSON.stringify({ token }); document.head.appendChild(script);
    };
    sync(); window.addEventListener('kahvedrop-consent', sync);
    return () => { window.removeEventListener('kahvedrop-consent', sync); script?.remove(); };
  }, [token]);
  return null;
}
