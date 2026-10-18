
import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import { signupsEnabled } from '@/lib/signups';
import { CONTACT_EMAIL, DATA_CONTROLLER, LEGAL_UPDATED } from '@/lib/legal';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata('Kullanım Şartları', `${SITE_NAME} kahve rehberinin kapsamını, fiyat uygunluğu uyarılarını ve dış bağlantı sorumluluklarını açıklar.`, '/terms');

export default function TermsPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a>;
  return (
    <div className="page-shell section-space max-w-3xl">
      <p className="eyebrow">
        Güven
      </p>
      <h1 className="mt-3 font-display text-title leading-none text-ink">Kullanım Şartları</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        {SITE_NAME}, Türkiye&apos;deki bağımsız kavurucuların kahvelerini keşfetmeye
        yardımcı olan bilgilendirme amaçlı bir katalogdur. Siteyi kullanarak bu şartları
        kabul etmiş olursun.
      </p>

      <div className="mt-8 space-y-8">
        <TermsSection title="Hizmet">
          <p>
            {SITE_NAME}, {DATA_CONTROLLER} tarafından yayımlanır. Site; kavurucuların kendi sitelerinde
            yayımladığı kahveleri bir katalogda toplar, fiyat ve stok değişikliklerini gösterir, damak tadı testi,
            karşılaştırma, kayıt listesi (Listem), kahve rehberi ve demleme hesaplayıcısı sunar
            {signupsEnabled() ? ' ve isteyenlere e-posta bülteni gönderir' : ''}. Siteyi kullanmak için hesap
            açman gerekmez.
          </p>
        </TermsSection>

        <TermsSection title="Mağaza değiliz">
          <p>
            {SITE_NAME} ürün satmaz, ödeme almaz, sipariş oluşturmaz ve teslimat
            sürecine dahil olmaz. Satın alma kararından önce nihai fiyatı, stok
            durumunu, kargo koşullarını ve iade şartlarını kavurucunun sitesinde
            kontrol etmelisin. Satın aldığın ürünle ilgili her konu, sen ve kavurucu
            arasındadır.
          </p>
        </TermsSection>

        <TermsSection title="Katalog doğruluğu ve garanti">
          <p>
            Fiyat, stok ve ürün bilgileri kavurucu sitelerinden düzenli olarak otomatik
            toplanır; yine de kavurucu sitelerinde anlık değişiklikler, eksik ya da hatalı
            bilgiler olabilir. Site, olduğu gibi ve erişilebildiği ölçüde sunulur. Katalogdaki
            bilgiler, test sonuçları, sıralamalar ve demleme önerileri garanti, tavsiye ya da
            satın alma taahhüdü değildir. Sitenin kesintisiz ya da hatasız çalışacağını garanti
            etmeyiz.
          </p>
        </TermsSection>

        <TermsSection title="Sorumluluğun sınırı">
          <p>
            Site ücretsiz bir bilgilendirme hizmetidir. Yürürlükteki hukukun izin verdiği ölçüde,
            katalogdaki bir bilgiye dayanarak verdiğin kararlardan, kavurucu sitelerinde yaptığın
            alışverişlerden ya da sitenin geçici olarak kullanılamamasından doğan zararlardan
            sorumlu değiliz. Kasıt veya ağır ihmalden doğan sorumluluk ile kanunen
            sınırlandırılamayan haklar saklıdır.
          </p>
        </TermsSection>

        <TermsSection title="Fikri mülkiyet ve üçüncü taraf içerik">
          <p>
            Kahve adları, ürün açıklamaları, ürün görselleri, logolar ve markalar ilgili kavurucuya
            ya da hak sahibine aittir; sitede yalnızca ürünü tanıtmak ve kavurucunun sitesine
            yönlendirmek için gösterilir. {SITE_NAME} adı, sitenin tasarımı, metinleri ve rehber
            içerikleri Basalt’a aittir. Bir içeriğin kaldırılmasını ya da düzeltilmesini isteyen
            kavurucular ve hak sahipleri {mail} adresine yazabilir.
          </p>
        </TermsSection>

        <TermsSection title="Kullanım kuralları">
          <p>
            Siteyi kişisel ve bilgilendirme amacıyla kullanabilirsin. Siteyi aşırı yükleyecek
            şekilde otomatik olarak taramak, güvenlik önlemlerini aşmaya çalışmak ya da siteyi
            yanıltıcı bir amaçla kullanmak yasaktır. Siteyi korumak için kısa sürede çok sayıda
            istek gönderen bağlantılar geçici olarak sınırlandırılabilir.
          </p>
        </TermsSection>

        <TermsSection title="Dış siteler">
          <p>
            Kavurucu bağlantıları üçüncü taraf sitelere açılır. Bu sitelerdeki içerik,
            güvenlik, ödeme, çerez ve teslimat süreçlerinden ilgili site sorumludur.
            Bir bağlantının sitede yer alması, o siteyi onayladığımız anlamına gelmez.
          </p>
        </TermsSection>

        <TermsSection title="Değişiklikler">
          <p>
            Siteyi ve bu şartları zaman zaman güncelleyebiliriz. Güncel metin her zaman bu
            sayfada yayımlanır ve aşağıdaki tarih yenilenir. Değişiklikten sonra siteyi
            kullanmaya devam etmen, güncel şartları kabul ettiğin anlamına gelir.
          </p>
        </TermsSection>

        <TermsSection title="İletişim">
          <p>
            Katalogdaki bir hata, kırık bağlantı ya da bu şartlarla ilgili soruların için{' '}
            {mail} adresine yazabilirsin.
          </p>
        </TermsSection>
      </div>

      <p className="mt-10 text-sm text-muted">
        Veri kullanımı hakkında bilgi için{' '}
        <Link href="/privacy" className="font-semibold text-ink underline-offset-4 hover:underline">
          Gizlilik
        </Link>{' '}
        sayfasına bak. Son güncelleme: {LEGAL_UPDATED}.
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
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
        {children}
      </div>
    </section>
  );
}
