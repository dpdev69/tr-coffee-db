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
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-stone-900">
            TR Coffee
            <span className="text-amber-700">DB</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/coffees"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            Explore
          </Link>
          <Link
            href="/roasters"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            Roasters
          </Link>
          <Link
            href="/quiz"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            Find My Coffee
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
          className="inline-flex items-center justify-center rounded-md p-2 text-stone-600 hover:bg-stone-100 md:hidden"
          aria-label="Toggle menu"
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
              <SearchInput />
            </Suspense>
          </div>
          <nav className="flex flex-col gap-3">
            <Link
              href="/coffees"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-stone-700"
            >
              Explore Coffees
            </Link>
            <Link
              href="/roasters"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-stone-700"
            >
              Roasters
            </Link>
            <Link
              href="/quiz"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-stone-700"
            >
              Find My Coffee
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
