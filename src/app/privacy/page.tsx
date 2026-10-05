import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import { CONTACT_EMAIL, DATA_CONTROLLER, LEGAL_PENDING, LEGAL_UPDATED } from '@/lib/legal';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata('Gizlilik', `${SITE_NAME} hangi verileri neden kullandığını ve dış bağlantıların nasıl çalıştığını açıklar.`, '/privacy');

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="eyebrow">
        Güven
      </p>
      <h1 className="mt-3 font-display text-5xl leading-none text-ink">Gizlilik</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        {SITE_NAME} hesap, ödeme ya da teslimat bilgisi toplamaz. Satın alma işlemleri
        kavurucuların kendi sitelerinde tamamlanır.
      </p>

      <div className="mt-8 space-y-8">
        <PolicySection title="Veri sorumlusu">
          <p>
            Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (KVKK) 10. maddesi kapsamında
            aydınlatma amacıyla hazırlanmıştır. Veri sorumlusu: <strong>{DATA_CONTROLLER ?? LEGAL_PENDING}</strong>.
            İletişim: <strong>{CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a> : LEGAL_PENDING}</strong>.
          </p>
        </PolicySection>

        <PolicySection title="Bülten aboneliği">
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
          <p>
            Amaç: sana iki gönderim yapmak: ayda bir aylık bülten (ayın favori kahveleri, sahneden haberler,
            etkinlikler) ve haftada bir otomatik fiyat özeti (fiyat düşüşleri, yeni gelenler, tekrar stoğa girenler).
            Abonelik formunda bu iki gönderim için onay kutusunu işaretlediğinde, onay zamanını ve onay metninin sürümünü de Kit’te abone kaydınla birlikte saklarız. Hukuki sebep: abonelik formunda ve onay e-postasında verdiğin açık rıza. Bülten,
            kavurucuların ürünlerini tanıttığı için ticari elektronik ileti sayılabilir; onayını dilediğin an
            her e-postadaki bağlantıyla geri alabilirsin.
          </p>
          <p>
            Yurt dışına aktarım: e-posta adresin, bülteni gönderen ABD merkezli Kit (ConvertKit LLC)
            tarafından; sitenin altyapı ve ölçüm verileri ise Cloudflare tarafından yurt dışındaki
            sunucularda işlenir. Saklama: adresin abonelik sürdükçe Kit’te tutulur. Ayrıldığında, sana
            yeniden e-posta gönderilmemesi için yalnızca Kit’in gönderim engeli kaydında kalır.
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

        <PolicySection title="KVKK kapsamındaki hakların">
          <p>
            KVKK’nın 11. maddesi uyarınca kişisel verinin işlenip işlenmediğini öğrenme, işlenmişse bilgi
            talep etme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı
            üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, silinmesini ya da yok
            edilmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analiz
            sonucu aleyhine bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini
            talep etme haklarına sahipsin. Taleplerini yukarıdaki iletişim adresine iletebilirsin; en geç
            30 gün içinde yanıtlanır.
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

      <p className="mt-10 text-sm text-muted">
        Kullanım koşulları için{' '}
        <Link href="/terms" className="font-semibold text-ink underline-offset-4 hover:underline">
          Kullanım Şartları
        </Link>{' '}
        sayfasına bakın. Son güncelleme: {LEGAL_UPDATED}.
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
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
        {children}
      </div>
    </section>
  );
}
