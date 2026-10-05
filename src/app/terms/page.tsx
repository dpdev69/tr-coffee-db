import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import { CONTACT_EMAIL, LEGAL_PENDING, LEGAL_UPDATED } from '@/lib/legal';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata('Kullanım Şartları', `${SITE_NAME} kahve rehberinin kapsamını, fiyat uygunluğu uyarılarını ve dış bağlantı sorumluluklarını açıklar.`, '/terms');

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="eyebrow">
        Güven
      </p>
      <h1 className="mt-3 font-display text-5xl leading-none text-ink">Kullanım Şartları</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        {SITE_NAME}, Türkiye&apos;deki bağımsız kavurucuların kahvelerini keşfetmeye
        yardımcı olan bilgilendirme amaçlı bir katalogdur.
      </p>

      <div className="mt-8 space-y-8">
        <TermsSection title="Mağaza değiliz">
          <p>
            {SITE_NAME} ürün satmaz, ödeme almaz, sipariş oluşturmaz ve teslimat
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
            Bu şartlar {LEGAL_UPDATED} tarihinde güncellenmiştir. Katalogdaki bir
            hata, kırık bağlantı veya kullanım koşullarıyla ilgili soru için{' '}
            {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a> : <strong>{LEGAL_PENDING}</strong>}{' '}
            adresinden iletişim kurabilirsiniz.
          </p>
        </TermsSection>
      </div>

      <p className="mt-10 text-sm text-muted">
        Veri kullanımı hakkında bilgi için{' '}
        <Link href="/privacy" className="font-semibold text-ink underline-offset-4 hover:underline">
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
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
        {children}
      </div>
    </section>
  );
}
