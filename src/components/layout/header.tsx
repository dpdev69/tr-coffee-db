'use client';

import Link from 'next/link';
import { brand } from '@/lib/brand';
import { usePathname } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { SearchInput } from '@/components/ui/search-input';

const links = [
  { href: '/kahveler', label: 'Kahveler' },
  { href: '/yeni', label: 'Yeni gelenler' },
  { href: '/firsatlar', label: 'Fırsatlar' },
  { href: '/kavurucular', label: 'Kavurucular' },
  { href: '/bulten', label: 'Bülten' },
];
const searchFallback = <div className="h-11 rounded-full bg-tint" />;
const iconButton = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink';

/**
 * Phones get a native modal <dialog> (focus containment, Escape and an inert page come from the browser;
 * globals.css locks scroll). Animation hooks: .site-header, .mobile-menu[open], .mobile-menu::backdrop.
 */
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const closeMenu = () => menuRef.current?.close();
  const current = (href: string) => (pathname.startsWith(href) ? 'page' : undefined);
  const wordmark = <span className="font-display text-[22px] font-semibold text-accent lg:text-[26px]">{brand.name}</span>;
  return (
    <header className="site-header sticky top-0 z-50 border-b border-line bg-ground/95 backdrop-blur-md">
      <div className="page-shell flex h-16 items-center gap-7 lg:h-[72px]">
        <Link href="/" aria-label={`${brand.name} ana sayfa`} className="inline-flex min-h-11 shrink-0 items-center">
          {wordmark}
        </Link>
        <nav aria-label="Ana menü" className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current(link.href)}
              className="inline-flex min-h-11 items-center text-[15px] text-ink hover:text-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden w-56 lg:block xl:w-64">
            <Suspense fallback={searchFallback}>
              <SearchInput />
            </Suspense>
          </div>
          <Link href="/quiz" className="button-dark hidden whitespace-nowrap lg:inline-flex">
            Kahvemi bul
          </Link>
          <button
            type="button"
            onClick={() => {
              menuRef.current?.showModal();
              setMobileMenuOpen(true);
            }}
            aria-label="Menüyü aç"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className={`${iconButton} lg:hidden`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>
        </div>
      </div>
      <dialog
        id="mobile-menu"
        ref={menuRef}
        aria-label="Menü"
        className="mobile-menu lg:hidden"
        onClose={() => setMobileMenuOpen(false)}
        // A click on the ::backdrop targets the dialog itself; the panel fills the dialog, so inside clicks never do.
        onClick={(event) => event.target === event.currentTarget && closeMenu()}
      >
        <div className="flex min-h-full flex-col gap-[18px] px-5 pb-6 pt-3.5">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={closeMenu} className="inline-flex min-h-11 items-center">{wordmark}</Link>
            <button type="button" onClick={closeMenu} aria-label="Menüyü kapat" className={iconButton}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M3 3l12 12M15 3L3 15" />
              </svg>
            </button>
          </div>
          <Suspense fallback={searchFallback}>
            <SearchInput onSearch={closeMenu} />
          </Suspense>
          <nav aria-label="Mobil menü" className="grid">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                aria-current={current(link.href)}
                className="flex min-h-14 items-center border-b border-line font-display text-[30px] text-ink aria-[current=page]:text-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link href="/quiz" onClick={closeMenu} className="button-dark button-lg mt-auto w-full">
            Kahvemi bul
          </Link>
        </div>
      </dialog>
    </header>
  );
}
