import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Kullanım Şartları',
  description:
    'TR CoffeeDB kahve rehberinin kapsamını, fiyat uygunluğu uyarılarını ve dış bağlantı sorumluluklarını açıklar.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: `Kullanım Şartları | ${SITE_NAME}`,
    description:
      'TR CoffeeDB kahve rehberinin kapsamını, fiyat uygunluğu uyarılarını ve dış bağlantı sorumluluklarını açıklar.',
    url: '/terms',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#244b3d]">
        Güven
      </p>
      <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">Kullanım Şartları</h1>
      <p className="mt-4 text-sm leading-6 text-[#5d5853]">
        TR CoffeeDB, Türkiye&apos;deki bağımsız kavurucuların kahvelerini keşfetmeye
        yardımcı olan bilgilendirme amaçlı bir katalogdur.
      </p>

      <div className="mt-8 space-y-8">
        <TermsSection title="Mağaza değiliz">
          <p>
            TR CoffeeDB ürün satmaz, ödeme almaz, sipariş oluşturmaz ve teslimat
            sürecine dahil olmaz. Satın alma kararınızdan önce nihai fiyatı, stok
            durumunu, kargo koşullarını ve iade şartlarını kavurucunun sitesinde
            kontrol etmelisiniz.
          </p>
        </TermsSection>

        <TermsSection title="Katalog doğruluğu">
          <p>
            Fiyat, stok ve ürün bilgileri düzenli olarak güncellenir; yine de kavurucu
            sitelerinde anlık değişiklikler olabilir. Katalogdaki bilgiler garanti,
            tavsiye ya da satın alma taahhüdü değildir.
          </p>
        </TermsSection>

        <TermsSection title="Dış siteler">
          <p>
            Kavurucu bağlantıları üçüncü taraf sitelere açılır. Bu sitelerdeki içerik,
            güvenlik, ödeme, çerez ve teslimat süreçlerinden ilgili site sorumludur.
          </p>
        </TermsSection>

        <TermsSection title="Yürürlük ve iletişim">
          <p>
            Bu şartlar 25 Mayıs 2026 tarihinde güncellenmiştir. Katalogdaki bir
            hata, kırık bağlantı veya kullanım koşullarıyla ilgili soru için GitHub
            Issues kanalından iletişim kurabilirsiniz.
          </p>
        </TermsSection>
      </div>

      <p className="mt-10 text-sm text-[#5d5853]">
        Veri kullanımı hakkında bilgi için{' '}
        <Link href="/privacy" className="font-semibold text-[#1f1d1b] underline-offset-4 hover:underline">
          Gizlilik
        </Link>{' '}
        sayfasına bakın.
      </p>
    </div>
  );
}

function TermsSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#1f1d1b]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[#5d5853]">
        {children}
      </div>
    </section>
  );
}
