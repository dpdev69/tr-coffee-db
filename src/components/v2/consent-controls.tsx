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
    {/* A slim bar at the bottom edge: the question stays in view without covering a third of a phone screen. */}
    {open || choice === null ? <section aria-label="Çerez tercihleri" data-open={open || undefined} className="consent-banner fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-[13px] leading-5 text-muted sm:flex-1"><strong className="font-semibold text-ink">Tercih senin. </strong>Listen, karşılaştırman, test yanıtların ve bu tercihin yalnızca cihazında tutulur. İzin verirsen siteyi geliştirmek için anonim kullanım ölçümünü açarız. <Link href="/privacy" className="hit underline underline-offset-4">Gizlilik</Link></p>
        <div className="flex flex-none gap-2"><button type="button" onClick={() => choose('essential')} className="button-light flex-1 whitespace-nowrap border border-line px-3 text-sm min-[360px]:text-[15px] sm:flex-none sm:px-5">Yalnızca gerekli</button><button type="button" onClick={() => choose('analytics')} className="button-dark flex-1 whitespace-nowrap px-3 text-sm min-[360px]:text-[15px] sm:flex-none sm:px-5">Ölçüme izin ver</button></div>
      </div>
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
