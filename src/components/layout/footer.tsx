import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#1f1d1b]/10 bg-white text-[#1f1d1b]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <div>
            <h2 className="font-display text-4xl leading-none">TR CoffeeDB</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#5d5853]">
              Türkiye&apos;de satılan specialty kahveleri karşılaştır. Üreticiden
              kavurucuya bildiğimiz yolculuğu, kaynağı ve eksik kalan bağlantıları gör.
            </p>
          </div>
          <FooterGroup title="Keşfet">
            <FooterLink href="/coffees">Kahveler</FooterLink>
            <FooterLink href="/roasters">Kavurucular</FooterLink>
            <FooterLink href="/rankings">Sıralamalar</FooterLink>
            <FooterLink href="/quiz">Kahve Bul</FooterLink>
          </FooterGroup>
          <FooterGroup title="Nasıl Kullanılır">
            <p className="text-sm leading-6 text-[#5d5853]">
              Köken, lot, işleme, kavrum ve fiyatı karşılaştır. Her bilginin
              kaynağını aç, sonra kavurucunun kendi sitesine geç.
            </p>
          </FooterGroup>
          <FooterGroup title="Güven">
            <FooterLink href="/privacy">Gizlilik</FooterLink>
            <FooterLink href="/terms">Kullanım Şartları</FooterLink>
          </FooterGroup>
        </div>
        <div className="mt-10 border-t border-[#1f1d1b]/10 pt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1d1b]/45">
          Desteklenen kavurucularda veriler düzenli olarak güncellenir.
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c3a20]">
        {title}
      </h3>
      <div className="mt-4 grid gap-1">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center text-sm font-semibold text-[#1f1d1b]/75 transition-colors hover:text-[#1f1d1b] hover:underline hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}
