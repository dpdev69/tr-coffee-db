'use client';

export function BuyButton({
  coffeeId,
  productUrl,
  roasterName,
}: {
  coffeeId: string;
  productUrl: string;
  roasterName: string;
}) {
  async function handleClick() {
    // Track click
    try {
      await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coffee_id: coffeeId }),
      });
    } catch {
      // Non-blocking — don't prevent redirect if tracking fails
    }

    // Build UTM URL
    const url = new URL(productUrl);
    url.searchParams.set('utm_source', 'trcoffeedb');
    url.searchParams.set('utm_medium', 'referral');

    window.open(url.toString(), '_blank', 'noopener');
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
    >
      <span>{roasterName} sitesinde satın al</span>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </button>
  );
}
