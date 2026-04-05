'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('search') ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      router.push(`/coffees?search=${encodeURIComponent(value.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search coffees..."
        className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </form>
  );
}
