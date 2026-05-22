'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { buildGlobalSearchUrl } from '@/lib/search-url';

export function SearchInput({ onSearch }: { onSearch?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  function submitSearch() {
    router.push(
      buildGlobalSearchUrl({
        pathname,
        currentQuery: searchParams.toString(),
        nextSearch: inputRef.current?.value ?? '',
      })
    );
    onSearch?.();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitSearch();
  }

  return (
    <form
      key={`${pathname}:${searchParams.get('search') ?? ''}`}
      onSubmit={handleSubmit}
      className="relative"
    >
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <input
        type="text"
        ref={inputRef}
        defaultValue={searchParams.get('search') ?? ''}
        name="search"
        aria-label="Çekirdek ara"
        autoComplete="off"
        placeholder="Çekirdek ara…"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitSearch();
          }
        }}
        className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-14 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      <button
        type="submit"
        className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-r-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        aria-label="Aramayı uygula"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
