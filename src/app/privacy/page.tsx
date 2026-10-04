import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = pageMetadata('Gizlilik', `${SITE_NAME} hangi verileri neden kullandığını ve dış bağlantıların nasıl çalıştığını açıklar.`, '/privacy');

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#244b3d]">
        Güven
      </p>
      <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">Gizlilik</h1>
      <p className="mt-4 text-sm leading-6 text-[#5d5853]">
        {SITE_NAME} hesap, ödeme ya da teslimat bilgisi toplamaz. Satın alma işlemleri
        kavurucuların kendi sitelerinde tamamlanır.
      </p>

      <div className="mt-8 space-y-8">
        <PolicySection title="Haftalık Drop aboneliği">
          <p>
            Bülten için yalnızca e-posta adresini isteriz. Adresin sunucumuz üzerinden
            Kit’e iletilir; katalog veritabanımıza, uygulama günlüklerine veya ürün
            analitiğine kaydedilmez. Kit, aboneliğini ve gönderimleri yönetir.
            Aboneliğin onay e-postasındaki bağlantıyla etkinleşir. Her bültenin
            abonelikten ayrılma bağlantısını kullanabilirsin.
          </p>
          <p>
            Aboneliğin geldiği sayfanın yolu ve sınırlı kampanya bilgileri Kit’e
            iletilebilir; arama metinleri ve katalog filtrelerinin değerleri bu
            bilgilere eklenmez. Kit’in abone verilerini işleme koşulları için{' '}
            <a href="https://kit.com/dpa" className="underline underline-offset-4">veri işleme ekini</a>{' '}
            inceleyebilirsin.
          </p>
        </PolicySection>

        <PolicySection title="Site kullanımı ve ölçüm">
          <p>
            İsteğe bağlı ölçüme izin verdiğinde genel ziyaret ve performans ölçümü için Cloudflare Web Analytics,
            kahve görüntüleme, filtre kullanımı, bülten başvurusu, kısa test ve
            kavurucuya geçiş sayıları için Cloudflare Workers Analytics Engine
            kullanılır. Ürün olaylarına e-posta, IP adresi, kullanıcı kimliği,
            arama metni veya tam sayfa adresi eklemeyiz. Bir kavurucuya geçişte
            yalnızca katalogdaki kahve, kavurucu ve paket kimlikleriyle sayfa türü
            gibi sınırlı bağlamı sayarız. Bu sayımlar bir satın alma kanıtı değildir.
          </p>
          <p>
            Katalog filtreleri paylaşılabilir sayfa adresinde tutulur. Kötüye
            kullanımı sınırlandırmak için IP adresi istek sırasında geçici olarak
            kullanılabilir; uygulama tarafından ürün analitiğinde saklanmaz.
            Ürün olayları Cloudflare Analytics Engine’in üç aylık saklama
            süresine tabidir. Cloudflare’ın altyapı verilerini nasıl işlediğini{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" className="underline underline-offset-4">gizlilik politikasında</a>{' '}
            bulabilirsin.
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
            Çerez tercihin bir yıl boyunca kahvedrop_consent çerezinde tutulur. Sayfanın altındaki Çerez tercihleri düğmesiyle değiştirebilirsin. Ölçümü reddedersen kullanım olayları gönderilmez; bültene kaydolmaya ve kavurucuya gitmeye devam edebilirsin. Karşılaştırma listeniz, bu tarayıcının yerel depolamasında en fazla üç kahvenin
            kimliği olarak saklanır. Bir hesapla eşleştirilmez. Karşılaştırma çubuğundaki
            temizleme düğmesiyle veya tarayıcınızın site verilerini silerek kaldırabilirsiniz.
            Paylaştığınız karşılaştırma adresi, seçilen kahveleri adresin içinde taşır.
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
