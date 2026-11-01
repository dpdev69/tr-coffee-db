import Link from 'next/link';
import { brand, studio } from '@/lib/brand';
import { NewsletterForm } from '@/components/v2/newsletter-form';
import { signupsEnabled } from '@/lib/signups';
import { ConsentControls } from '@/components/v2/consent-controls';

/** The shared Basalt product footer (brand, product, "Basalt'tan diğerleri", help), drawn in KahveDrop's own palette. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-tint text-ink">
      <div className="page-shell py-10">
        {/* Hidden by globals.css on pages that carry their own sign-up form, so a page never shows two. */}
        {signupsEnabled() && <NewsletterForm source="footer" variant="card" compact className="footer-newsletter mb-8" title="Ayda bir bülten, haftada bir fiyat özeti" description="İstediğin an çıkarsın." />}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center font-display text-[22px] font-semibold text-accent"
            >
              {brand.name}.
            </Link>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
              Türkiye’nin bağımsız kavurucularını keşfet. Çekirdekleri
              karşılaştır, kahveni tanı, kavurucusundan satın al. Bir Basalt
              ürünü.
            </p>
          </div>
          <nav aria-labelledby="footer-discover">
            <p id="footer-discover" className="eyebrow mb-2">Keşfet</p>
            <FooterLink href="/kahveler">Kahve kataloğu</FooterLink>
            <FooterLink href="/kavurucular">Kavurucular</FooterLink>
            <FooterLink href="/firsatlar">Doğrulanan fırsatlar</FooterLink>
            <FooterLink href="/quiz">Damak tadına göre bul</FooterLink>
            <FooterLink href="/guide">Kahve rehberi</FooterLink>
            <FooterLink href="/rehber/filtre-kahve-nasil-yapilir">Filtre kahve nasıl yapılır?</FooterLink>
            <FooterLink href="/rehber/filtre-kahve-cekirdegi">Filtre kahve çekirdeği seçimi</FooterLink>
          </nav>
          <nav aria-labelledby="footer-basalt">
            <p id="footer-basalt" className="eyebrow mb-2">Basalt’tan diğerleri</p>
            <FooterLink href={studio.url}>{studio.name}</FooterLink>
            {studio.products.map((product) => (
              <FooterLink key={product.url} href={product.url}>{product.label}</FooterLink>
            ))}
            <FooterLink href={studio.x} rel="noopener me">X @hellobasalt</FooterLink>
            <FooterLink href={studio.youtube} rel="noopener me">YouTube @hellobasalt</FooterLink>
          </nav>
          <nav aria-labelledby="footer-help">
            <p id="footer-help" className="eyebrow mb-2">Yardım</p>
            <FooterLink href={`mailto:${studio.supportEmail}`}>{studio.supportEmail}</FooterLink>
            <FooterLink href="/privacy">Gizlilik</FooterLink>
            <FooterLink href="/terms">Kullanım şartları</FooterLink>
            <div className="text-sm text-muted hover:text-accent">
              <ConsentControls />
            </div>
          </nav>
        </div>
        <div className="mt-8 grid gap-2 border-t border-line pt-5 text-xs text-muted">
          <p>
            © 2026{' '}
            <a href={studio.url} rel="noopener" className="hit hover:text-accent hover:underline">
              {studio.name}
            </a>
            . {brand.name} bir Basalt ürünüdür.
          </p>
          <p>
            Bir mağaza değil, bağımsız bir keşif rehberi. Son fiyat ve stok
            kavurucunun sitesindedir.
          </p>
        </div>
      </div>
    </footer>
  );
}
function FooterLink({
  href,
  rel,
  children,
}: {
  href: string;
  rel?: string;
  children: React.ReactNode;
}) {
  const className = 'flex min-h-11 items-center text-sm text-muted hover:text-accent hover:underline hover:underline-offset-4';
  // Site pages go through the router; other Basalt sites, social profiles and mail open as plain links.
  if (href.startsWith('/')) return <Link href={href} className={className}>{children}</Link>;
  return <a href={href} rel={rel ?? 'noopener'} className={className}>{children}</a>;
}
