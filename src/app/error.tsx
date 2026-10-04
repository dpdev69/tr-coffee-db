'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';

/**
 * Next 16 passes unstable_retry (re-fetch and re-render); vinext still passes only reset,
 * so the fallback refreshes server data and then clears the boundary.
 */
export default function Error({ error, reset, unstable_retry }: { error: Error & { digest?: string }; reset?: () => void; unstable_retry?: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  const retry = unstable_retry ?? (() => startTransition(() => { router.refresh(); reset?.(); }));
  return (
    <section className="page-shell flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">Bir şeyler ters gitti</p>
      <h1 className="mt-5 max-w-2xl font-display text-5xl leading-[1.08] sm:text-6xl">Bu sayfa şu an açılmadı.</h1>
      <p className="mt-6 max-w-lg text-base leading-8 text-muted">Geçici bir sorun olabilir. Yeniden deneyebilir ya da kahve kataloğuna dönebilirsin.{error.digest ? ` Hata kodu: ${error.digest}` : ''}</p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={retry} className="button-dark button-lg">Yeniden dene</button>
        <Link href="/kahveler" className="button-light button-lg">Kahvelere dön</Link>
      </div>
    </section>
  );
}
