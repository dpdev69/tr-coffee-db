'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { analyticsConsent, consentChoice, CONSENT_COOKIE, type ConsentChoice } from '../../../shared/v2/consent';

const subscribeConsent = (notify: () => void) => { window.addEventListener('kahvedrop-consent', notify); return () => window.removeEventListener('kahvedrop-consent', notify); };
const readConsent = () => consentChoice(document.cookie);

/** The choice is read on the client only, so the layout stays static. The inline script in layout.tsx marks
 * <html data-consent> before paint, and globals.css hides the banner until hydration catches up: no flash. */
export function ConsentControls() {
  const [open, setOpen] = useState(false);
  const choice = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  function choose(choice: ConsentChoice) {
    const revoke = analyticsConsent(document.cookie) && choice !== 'analytics';
    document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setOpen(false);
    window.dispatchEvent(new Event('kahvedrop-consent'));
    // A full reload stops a previously loaded third-party beacon after withdrawal.
    if (revoke) window.location.reload();
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center hover:underline">Çerez tercihleri</button>
    {open || choice === null ? <section aria-label="Çerez tercihleri" data-open={open || undefined} className="consent-banner fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-lg sm:inset-x-6">
      <h2 className="font-display text-xl">Tercih senin.</h2><p className="mt-2 text-sm leading-6 text-muted">Listen, karşılaştırman, test yanıtların ve bu tercihin yalnızca cihazında tutulur. İzin verirsen siteyi geliştirmek için anonim kullanım ölçümünü açarız. <Link href="/privacy" className="underline underline-offset-4">Gizlilik</Link></p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => choose('essential')} className="button-light border border-line">Yalnızca gerekli</button><button type="button" onClick={() => choose('analytics')} className="button-dark">Ölçüme izin ver</button></div>
    </section> : null}
  </>;
}

/** Loads the Cloudflare beacon only after analytics consent, and only on the configured analytics host. */
export function ConsentedBeacon({ token, host }: { token: string; host: string }) {
  useEffect(() => {
    if (location.host !== host) return;
    let script: HTMLScriptElement | null = null;
    const sync = () => {
      if (!analyticsConsent(document.cookie) || script) return;
      script = document.createElement('script');
      script.src = 'https://static.cloudflareinsights.com/beacon.min.js'; script.async = true;
      script.dataset.cfBeacon = JSON.stringify({ token }); document.head.appendChild(script);
    };
    sync(); window.addEventListener('kahvedrop-consent', sync);
    return () => { window.removeEventListener('kahvedrop-consent', sync); script?.remove(); };
  }, [token, host]);
  return null;
}
