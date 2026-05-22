'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { SearchInput } from '@/components/ui/search-input';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-stone-900">
            TR Coffee
            <span className="text-amber-700">DB</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/coffees"
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
          >
            Kahveler
          </Link>
          <Link
            href="/roasters"
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
          >
            Kavurucular
          </Link>
          <Link
            href="/quiz"
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
          >
            Tercihime Göre Bul
          </Link>
        </nav>

        {/* Search */}
        <div className="hidden w-64 md:block">
          <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-stone-100" />}>
            <SearchInput />
          </Suspense>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 md:hidden"
          aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        >
          {mobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 md:hidden">
          <div className="mb-4">
            <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-stone-100" />}>
              <SearchInput onSearch={() => setMobileMenuOpen(false)} />
            </Suspense>
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              href="/coffees"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Kahveleri İncele
            </Link>
            <Link
              href="/roasters"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Kavurucular
            </Link>
            <Link
              href="/quiz"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Tercihime Göre Bul
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
