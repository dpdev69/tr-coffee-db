'use client';

import { isTrustedHttpUrl, normalizeTrustedHttpUrl } from '@/lib/trusted-url';

export function BuyButton({
  allowedHosts,
  coffeeId,
  productUrl,
  roasterName,
}: {
  allowedHosts: string[];
  coffeeId: string;
  productUrl: string;
  roasterName: string;
}) {
  const canOpenProductUrl = isTrustedHttpUrl(productUrl, { allowedHosts });

  async function handleClick() {
    const safeProductUrl = normalizeTrustedHttpUrl(productUrl, { allowedHosts });
    if (!safeProductUrl) {
      console.error('Blocked unsafe product URL', { coffeeId, roasterName });
      return;
    }

    // Track click
    try {
      await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coffee_id: coffeeId,
          source: 'coffee_detail',
          page_path: window.location.pathname,
        }),
      });
    } catch {
      // Non-blocking — don't prevent redirect if tracking fails
    }

    // Build UTM URL
    const url = new URL(safeProductUrl);
    url.searchParams.set('utm_source', 'trcoffeedb');
    url.searchParams.set('utm_medium', 'referral');

    window.open(url.toString(), '_blank', 'noopener');
  }

  return (
    <button
      disabled={!canOpenProductUrl}
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1d1b] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#1f1d1b] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d8d1c7] disabled:text-[#5d5853]"
    >
      <span>
        {canOpenProductUrl ? `${roasterName} sitesine git` : 'Bağlantı doğrulanamadı'}
      </span>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </button>
  );
}
