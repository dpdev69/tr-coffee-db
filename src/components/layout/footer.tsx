import Link from 'next/link';
import { brand } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper text-ink">
      <div className="page-shell py-10">
        <div className="grid gap-8 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center font-display text-[22px] font-semibold text-accent"
            >
              {brand.name}.
            </Link>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
              Türkiye’nin bağımsız kavurucularını keşfet. Çekirdekleri
              karşılaştır, kahveni tanı, kavurucusundan satın al.
            </p>
          </div>
          <nav aria-label="Keşfet">
            <p className="eyebrow mb-2">Keşfet</p>
            <FooterLink href="/kahveler">Kahve kataloğu</FooterLink>
            <FooterLink href="/kavurucular">Kavurucular</FooterLink>
            <FooterLink href="/firsatlar">Doğrulanan fırsatlar</FooterLink>
          </nav>
          <nav aria-label="Rehber">
            <p className="eyebrow mb-2">Bir sonraki fincanın</p>
            <FooterLink href="/quiz">Damak tadına göre bul</FooterLink>
            <FooterLink href="/guide">Kahve rehberi</FooterLink>
            <FooterLink href="/guide#calculator">
              Demleme hesaplayıcı
            </FooterLink>
          </nav>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center">
          <p>
            Bir mağaza değil, bağımsız bir keşif rehberi. Son fiyat ve stok
            kavurucunun sitesindedir.
          </p>
          <div className="flex gap-5">
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center hover:underline"
            >
              Gizlilik
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center hover:underline"
            >
              Kullanım şartları
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center text-sm text-muted hover:text-accent hover:underline hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}
