'use client';

import Link from 'next/link';
import { brand } from '@/lib/brand';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
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
 * The dialog sits beside the header, not inside it: the sticky header is its own layer, and iPhone Safari
 * must never have to lift the menu out of it. The header pads under the status bar (viewport-fit=cover).
 */
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // The bar is translucent; its hairline shows only once content scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const menuRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const openMenu = () => {
    const menu = menuRef.current;
    if (!menu) return;
    // Browsers without <dialog> (iOS before 15.4) still get the panel, without the inert page.
    if (typeof menu.showModal === 'function') menu.showModal();
    else menu.setAttribute('open', '');
    setMobileMenuOpen(true);
    // Start focus on the panel, so no link wears a focus ring the moment the menu opens.
    menu.querySelector<HTMLElement>('[data-menu-panel]')?.focus();
  };
  const closeMenu = () => {
    const menu = menuRef.current;
    if (!menu) return;
    if (typeof menu.close === 'function') menu.close();
    else {
      menu.removeAttribute('open');
      setMobileMenuOpen(false);
    }
  };
  const current = (href: string) => (pathname.startsWith(href) ? 'page' : undefined);
  const wordmark = <span className="font-display text-[clamp(21px,1rem+0.5vw,24px)] font-bold tracking-[-0.02em] text-accent">{brand.name}</span>;
  return (
    <>
    <header data-scrolled={scrolled || undefined} className="site-header sticky top-0 z-50 border-b border-transparent bg-ground/72 pt-[env(safe-area-inset-top)] backdrop-blur-[20px] backdrop-saturate-[1.8] data-[scrolled]:border-line">
      <div className="page-shell flex h-[52px] items-center gap-[clamp(16px,2vw,40px)]">
        <div className="flex shrink-0 items-center gap-2.5">
          <Link href="/" aria-label={`${brand.name} ana sayfa`} className="inline-flex min-h-11 shrink-0 items-center">
            {wordmark}
          </Link>
          <a
            href="https://hellobasalt.dev/"
            className="hit pt-1 font-mono text-xs leading-none tracking-[0.04em] text-muted hover:text-ink hover:underline"
          >
            by Basalt
          </a>
        </div>
        <nav aria-label="Ana menü" className="hidden items-center gap-[clamp(14px,1.6vw,32px)] lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current(link.href)}
              className="inline-flex min-h-11 items-center whitespace-nowrap text-[15px] text-ink hover:text-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-3 lg:flex-[0_1_28rem]">
          <div className="hidden min-w-36 flex-[0_1_18rem] lg:block">
            <Suspense fallback={searchFallback}>
              <SearchInput />
            </Suspense>
          </div>
          <Link href="/quiz" className="button-dark hidden whitespace-nowrap lg:inline-flex">
            Kahvemi bul
          </Link>
          <button
            type="button"
            onClick={openMenu}
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
    </header>
      <dialog
        id="mobile-menu"
        ref={menuRef}
        aria-label="Menü"
        className="mobile-menu lg:hidden"
        onClose={() => setMobileMenuOpen(false)}
        // A click on the ::backdrop targets the dialog itself; the panel fills the dialog, so inside clicks never do.
        onClick={(event) => event.target === event.currentTarget && closeMenu()}
      >
        <div data-menu-panel tabIndex={-1} className="flex min-h-full flex-col gap-[18px] px-5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] outline-none">
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
    </>
  );
}
