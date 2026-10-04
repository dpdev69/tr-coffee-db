'use client';

import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/lib/brand';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/ui/search-input';

const links = [
  { href: '/kahveler', label: 'Kahveler' },
  { href: '/yeni', label: 'Yeni keşifler' },
  { href: '/firsatlar', label: 'Fırsatlar' },
  { href: '/kavurucular', label: 'Kavurucular' },
];
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileMenuOpen]);
  return (
    <header className="sticky top-0 z-50 border-b border-[#dedfd7] bg-[#faf9f6]/95 backdrop-blur-md">
      <div className="page-shell flex h-[76px] items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={`${brand.name} ana sayfa`}
          onClick={() => setMobileMenuOpen(false)}
          className="flex min-h-11 shrink-0 items-center gap-2.5"
        >
          <Image src={brand.logoPath} alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="text-lg font-bold tracking-tight sm:text-xl text-[#1f1d1b]">
            {brand.name}<span className="ml-1 text-[#507960]">.</span>
          </span>
        </Link>
        <nav
          aria-label="Ana menü"
          className="hidden items-center gap-1 lg:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-[#e9edde] ${pathname.startsWith(link.href) ? 'bg-[#e9edde] text-[#244b3d]' : 'text-[#625e57]'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/quiz"
            className="hidden min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#244b3d] px-3 text-sm font-semibold text-white hover:bg-[#163629] inline-flex"
          >
            Kahvemi bul <span aria-hidden="true">↗</span>
          </Link>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className="grid h-11 w-11 place-items-center rounded-lg border border-[#cbd0c2] text-[#244b3d] lg:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                d={
                  mobileMenuOpen
                    ? 'M6 6l12 12M6 18 18 6'
                    : 'M4 7h16M4 12h16M4 17h16'
                }
              />
            </svg>
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-[#dedfd7] bg-[#faf9f6] px-5 pb-5 pt-3 lg:hidden"
        >
          <nav aria-label="Mobil menü" className="mb-4 grid">
            {[...links, { href: '/quiz', label: 'Kahvemi bul' }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={
                  pathname.startsWith(link.href) ? 'page' : undefined
                }
                className="flex min-h-12 items-center border-b border-[#dedfd7] py-3 text-base font-medium text-[#244b3d]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Suspense fallback={<div className="h-11 rounded-lg bg-stone-100" />}>
            <SearchInput onSearch={() => setMobileMenuOpen(false)} />
          </Suspense>
        </div>
      )}
    </header>
  );
}
