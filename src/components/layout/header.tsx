'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/ui/search-input';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#1f1d1b]/10 bg-white">
      <div className="bg-[#8b3f24] px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
        Çekirdekten fincana, Türkiye&apos;de satılan specialty kahvenin yolculuğunu keşfet.
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          <HeaderLink href="/coffees">Kahveler</HeaderLink>
          <HeaderLink href="/roasters">Kavurucular</HeaderLink>
          <HeaderLink href="/rankings">Sıralamalar</HeaderLink>
          <HeaderLink href="/quiz">Kahve Bul</HeaderLink>
        </nav>

        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center justify-center text-center"
          aria-label="TR CoffeeDB ana sayfa"
        >
          <span className="text-[1.65rem] font-black leading-none tracking-tight text-[#1f1d1b]">
            TR CoffeeDB
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
          <div className="w-60 lg:w-72">
            <Suspense fallback={<div className="h-11 w-full animate-pulse rounded-lg bg-[#f2eadf]" />}>
              <SearchInput />
            </Suspense>
          </div>
          <Link
            href="/quiz"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#1f1d1b] px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Başla
          </Link>
        </div>

        <button
          type="button"
          ref={mobileMenuButtonRef}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#1f1d1b] hover:bg-[#f6f1e8] md:hidden"
          aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-[#1f1d1b]/10 bg-white px-4 py-4 md:hidden"
        >
          <div className="mb-4">
            <Suspense fallback={<div className="h-11 w-full animate-pulse rounded-lg bg-[#f2eadf]" />}>
              <SearchInput onSearch={() => setMobileMenuOpen(false)} />
            </Suspense>
          </div>
          <nav className="grid gap-1">
            <MobileLink href="/coffees" onClick={() => setMobileMenuOpen(false)}>
              Kahveler
            </MobileLink>
            <MobileLink href="/roasters" onClick={() => setMobileMenuOpen(false)}>
              Kavurucular
            </MobileLink>
            <MobileLink href="/rankings" onClick={() => setMobileMenuOpen(false)}>
              Sıralamalar
            </MobileLink>
            <MobileLink href="/quiz" onClick={() => setMobileMenuOpen(false)}>
              Kahve Bul
            </MobileLink>
          </nav>
        </div>
      )}
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#1f1d1b]/75 transition-colors hover:bg-[#f6f1e8] hover:text-[#1f1d1b]"
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#1f1d1b] hover:bg-[#f6f1e8]"
    >
      {children}
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
