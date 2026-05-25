import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Gizlilik',
  description:
    'TR CoffeeDB hangi verileri neden kullandığını ve dış bağlantıların nasıl çalıştığını açıklar.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: `Gizlilik | ${SITE_NAME}`,
    description:
      'TR CoffeeDB hangi verileri neden kullandığını ve dış bağlantıların nasıl çalıştığını açıklar.',
    url: '/privacy',
    type: 'website',
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
        Güven
      </p>
      <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">Gizlilik</h1>
      <p className="mt-4 text-sm leading-6 text-[#5d5853]">
        TR CoffeeDB hesap, ödeme ya da teslimat bilgisi toplamaz. Satın alma işlemleri
        kavurucuların kendi sitelerinde tamamlanır.
      </p>

      <div className="mt-8 space-y-8">
        <PolicySection title="Kullandığımız veriler">
          <p>
            Katalogda arama yaptığınızda filtre ve arama parametreleri sayfa adresinde
            tutulur. Bir kavurucu sitesine geçiş yaptığınızda, bağlantı kalitesini ve
            katalog kullanımını anlamak için kahve kimliği, sayfa yolu ve varsa aktif
            filtre bağlamı redirect_events tablosunda kaydedilebilir. Bu tıklama
            kaydı sipariş, ödeme veya profil verisi içermez.
          </p>
          <p>
            Site performansını ve genel kullanımını izlemek için Vercel Analytics
            kullanılır. Bu analitik veriler ürünü iyileştirmek, bozuk sayfaları
            bulmak ve katalog kapsamını değerlendirmek içindir.
          </p>
        </PolicySection>

        <PolicySection title="Saklama ve düzeltme">
          <p>
            Tıklama ve düzeltme raporları yalnızca katalog kalitesini izlemek için
            tutulur; operasyonel inceleme tamamlandığında gereksiz kayıtları
            silmeyi hedefleriz. Bu çalışma için varsayılan saklama hedefi 90 gündür.
          </p>
          <p>
            Kahve detay sayfalarındaki rapor formuyla hatalı fiyat, kırık bağlantı
            veya yanlış metadata bildirebilirsiniz. Verileriniz için erişim,
            düzeltme ya da silme talebiniz varsa GitHub Issues üzerinden iletişim
            kurabilirsiniz.
          </p>
        </PolicySection>

        <PolicySection title="Dış bağlantılar">
          <p>
            Kahve satın alma bağlantıları sizi ilgili kavurucunun sitesine götürür.
            Bu noktadan sonra geçerli gizlilik, çerez, ödeme ve teslimat kuralları
            kavurucunun kendi politikalarına bağlıdır.
          </p>
        </PolicySection>

        <PolicySection title="Kontrol sizde">
          <p>
            TR CoffeeDB&apos;de hesap veya profil olmadığı için saklanan kişisel tercihleri
            yönetmeniz gerekmez. Tarayıcınızdaki çerez ve site verilerini dilediğiniz
            zaman silebilirsiniz.
          </p>
        </PolicySection>
      </div>

      <p className="mt-10 text-sm text-[#5d5853]">
        Kullanım koşulları için{' '}
        <Link href="/terms" className="font-semibold text-[#1f1d1b] underline-offset-4 hover:underline">
          Kullanım Şartları
        </Link>{' '}
        sayfasına bakın. Veri talepleri ve iletişim için{' '}
        <Link
          href="https://github.com/dpdev69/tr-coffee-db/issues"
          className="font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
        >
          GitHub Issues
        </Link>
        {' '}kanalını kullanın.
      </p>
    </div>
  );
}

function PolicySection({
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
