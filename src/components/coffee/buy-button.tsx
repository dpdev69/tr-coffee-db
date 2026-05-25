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
  const safeProductUrl = normalizeTrustedHttpUrl(productUrl, { allowedHosts });
  const outboundHref = safeProductUrl ? buildTrackedProductUrl(safeProductUrl) : null;

  function handleClick() {
    if (!outboundHref) {
      console.error('Blocked unsafe product URL', { coffeeId, roasterName });
      return;
    }

    trackCoffeeClick({
      coffee_id: coffeeId,
      source: 'coffee_detail',
      page_path: window.location.pathname,
    });
  }

  if (!canOpenProductUrl || !outboundHref) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d8d1c7] px-6 py-3 text-sm font-semibold text-[#5d5853] disabled:cursor-not-allowed"
      >
        <span>Bağlantı doğrulanamadı</span>
        <ExternalLinkIcon />
      </button>
    );
  }

  return (
    <a
      href={outboundHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1d1b] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#1f1d1b] focus:ring-offset-2"
    >
      <span>{roasterName} sitesine git</span>
      <ExternalLinkIcon />
    </a>
  );
}

function buildTrackedProductUrl(productUrl: string) {
  const url = new URL(productUrl);
  url.searchParams.set('utm_source', 'trcoffeedb');
  url.searchParams.set('utm_medium', 'referral');
  return url.toString();
}

function trackCoffeeClick(payload: {
  coffee_id: string;
  source: 'coffee_detail';
  page_path: string;
}) {
  const body = JSON.stringify(payload);

  if ('sendBeacon' in navigator) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/click', blob)) {
        return;
      }
    } catch {
      // Fall back to fetch below.
    }
  }

  try {
    void fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Non-blocking: outbound navigation should not wait for analytics.
  }
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}
