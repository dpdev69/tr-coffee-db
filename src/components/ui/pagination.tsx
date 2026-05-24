'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-[#1f1d1b]/70 hover:bg-[#f6f1e8] disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Önceki
      </button>
      {pages.map((page, i) =>
        page === '…' ? (
          <span key={`dots-${i}`} className="px-2 text-[#1f1d1b]/40">
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium ${
              page === currentPage
                ? 'bg-[#ecff64] text-[#1f1d1b]'
                : 'text-[#1f1d1b]/70 hover:bg-[#f6f1e8]'
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-[#1f1d1b]/70 hover:bg-[#f6f1e8] disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Sonraki
      </button>
    </nav>
  );
}
