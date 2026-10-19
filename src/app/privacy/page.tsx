
import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import { signupsEnabled } from '@/lib/signups';
import { CONTACT_EMAIL, DATA_CONTROLLER, GENERAL_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata('Gizlilik', `${SITE_NAME} hangi verileri neden işlediğini, kimlere aktardığını ve KVKK kapsamındaki haklarını açıklar.`, '/privacy');

const link = 'underline underline-offset-4';

export default function PrivacyPage() {
  const signups = signupsEnabled();
  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>;
  const hello = <a href={`mailto:${GENERAL_EMAIL}`} className={link}>{GENERAL_EMAIL}</a>;
  return (
    <div className="page-shell section-space max-w-3xl">
      <p className="eyebrow">
        Güven
      </p>
      <h1 className="mt-3 font-display text-title leading-none text-ink">Gizlilik</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        {SITE_NAME} hesap, ödeme ya da teslimat bilgisi toplamaz. Satın alma işlemleri
        kavurucuların kendi sitelerinde tamamlanır. Bu sayfa, sitenin bugün gerçekten
        işlediği verileri ve KVKK kapsamındaki haklarını anlatır.
      </p>

      <div className="mt-8 space-y-8">
        <PolicySection title="Veri sorumlusu">
          <p>
            Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (KVKK) 10. maddesi uyarınca
            aydınlatma amacıyla hazırlanmıştır. {SITE_NAME}, {DATA_CONTROLLER} tarafından yayımlanır.
            Veri sorumlusu: <strong>{DATA_CONTROLLER}</strong>. İletişim: <strong>{mail}</strong> (destek ve veri talepleri), genel konular için <strong>{hello}</strong>.
          </p>
        </PolicySection>

        <PolicySection title="Hangi verileri, nasıl topluyoruz">
          <p>
            <strong className="text-ink">Bağlantı ve güvenlik verileri.</strong> Siteyi açtığında tarayıcın,
            her web sitesinde olduğu gibi IP adresini, tarayıcı bilgisini ve istediği sayfanın adresini
            gönderir. Bu veriler, siteyi barındıran Cloudflare’ın altyapısı üzerinden otomatik olarak işlenir.
            Kötüye kullanımı sınırlandırmak için IP adresin (IPv6’da ağ ön eki) istek sırasında yalnızca dakikalık
            bir sayaç anahtarı olarak kullanılır; uygulama bunu kaydetmez ve ürün analitiğine eklemez. Sitenin
            hatalarını ve hızını izlemek için Cloudflare’ın hata ve performans kayıtlarını kullanırız; bu kayıtlar
            isteklerin küçük bir bölümünde istek adresi gibi teknik bilgileri içerebilir.
          </p>
          <p>
            <strong className="text-ink">Tercih çerezi.</strong> Ölçüm tercihin, birinci taraf{' '}
            <code>kahvedrop_consent</code> çerezinde, seçimine göre <code>essential</code> ya da{' '}
            <code>analytics</code> değeriyle bir yıl boyunca tutulur. Sitenin kendisi başka çerez kullanmaz.
          </p>
          <p>
            <strong className="text-ink">Cloudflare doğrulama çerezi.</strong> Cloudflare’ın bot koruması bir
            doğrulama (challenge) sunarsa ve bunu geçersen, Cloudflare tarayıcına <code>cf_clearance</code> çerezini
            yerleştirir; böylece doğrulamayı her sayfada yeniden yapmazsın. Bu çerezi {SITE_NAME} değil Cloudflare
            ayarlar, yalnızca güvenlik amacıyla kullanılır ve ölçüm tercihinden bağımsızdır.
          </p>
          <p>
            <strong className="text-ink">Yalnızca cihazında kalan bilgiler.</strong> Şu özellikler, verilerini
            tarayıcının yerel depolamasında tutar; bunlar bir hesapla eşleştirilmez ve sunucumuzda saklanmaz:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Karşılaştırma listen: en fazla üç kahvenin kimliği.</li>
            <li>
              Listem: kaydettiğin en fazla 50 kahve; her biri için kaydettiğin andaki paket fiyatı, gramajı,
              stok durumu ve kaydetme zamanı. Listem sayfası güncel fiyatları göstermek için yalnızca bu
              kahvelerin adreslerini sunucuya sorar; istek kimseyle eşleştirilmez ve kaydedilmez.
            </li>
            <li>
              Damak tadı testindeki yanıtların (demleme, tat, kavrum, işleme) ve testi bitirdiğin zaman. Sonuç
              sayfası bu yanıtları adresinde taşır ve sıralama için sunucuya gönderir; yanıtlar kaydedilmez.
            </li>
            <li>Ana sayfadaki “Son ziyaretinden beri” sayımı için son ziyaret zamanın.</li>
          </ul>
          <p>
            Katalog filtreleri ve paylaştığın karşılaştırma adresi, seçimleri sayfa adresinin içinde taşır.
          </p>
          <p>
            <strong className="text-ink">İsteğe bağlı ölçüm.</strong> Yalnızca çerez bandında “Ölçüme izin ver”
            dersen açılır. Genel ziyaret ve sayfa hızı ölçümü için Cloudflare Web Analytics betiği yüklenir; bu
            betik çerez kullanmaz. Ayrıca kahve görüntüleme, filtre kullanımı,{' '}
            {signups ? 'bülten başvurusu, ' : ''}damak tadı testine başlama ve testi bitirme ile kavurucuya geçiş
            sayıları Cloudflare Workers Analytics Engine’e yazılır.
            Bu ürün olaylarına e-posta, IP adresi, kullanıcı kimliği, arama metni veya tam sayfa adresi eklemeyiz; yalnızca sayfa türü, olayın geldiği bölüm,
            hangi filtrelerin kullanıldığı (değerleri değil) ve katalogdaki kahve, kavurucu ve paket kimlikleri
            gibi sınırlı bağlam yazılır. Bu sayımlar bir satın alma kanıtı değildir. İzin vermezsen bu ölçümlerin
            hiçbiri yapılmaz.
          </p>
          {signups ? null : (
            <p>
              <strong className="text-ink">E-posta.</strong> Bülten kayıtları şu anda kapalı; site e-posta adresi
              toplamaz.
            </p>
          )}
          <p>
            <strong className="text-ink">Bize yazdığında.</strong> {mail} adresine e-posta gönderirsen, yanıt
            verebilmek için e-posta adresini ve iletinin içeriğini işleriz.
          </p>
        </PolicySection>

        {signups && <PolicySection title="Bülten aboneliği">
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
            <a href="https://kit.com/dpa" className={link}>veri işleme ekini</a>{' '}
            inceleyebilirsin.
          </p>
          <p>
            Amaç: sana iki gönderim yapmak: ayda bir aylık bülten (ayın favori kahveleri, sahneden haberler,
            etkinlikler) ve haftada bir otomatik fiyat özeti (fiyat düşüşleri, yeni gelenler, tekrar stoğa girenler).
            Abonelik formunda bu iki gönderim için onay kutusunu işaretlediğinde, onay zamanını ve onay metninin
            sürümünü de Kit’te abone kaydınla birlikte saklarız. Bülten, kavurucuların ürünlerini tanıttığı için
            ticari elektronik ileti sayılabilir; onayını dilediğin an her e-postadaki bağlantıyla geri alabilirsin.
          </p>
        </PolicySection>}

        <PolicySection title="Hangi amaçla ve hangi hukuki sebeple">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Siteyi sunmak, güvenliğini sağlamak, kötüye kullanımı sınırlandırmak ve hataları gidermek: KVKK
              m.5/2-f (temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat).
            </li>
            <li>
              Ölçüm tercihini hatırlamak ve cihazında tuttuğun listeleri çalıştırmak: istediğin özelliği sunmak için
              zorunlu olan bu işleme m.5/2-f’ye dayanır; bu bilgiler sunucumuzda saklanmaz.
            </li>
            <li>İsteğe bağlı ölçüm ile siteyi geliştirmek: m.5/1 uyarınca açık rızan.</li>
            {signups ? <li>Bülten ve haftalık fiyat özeti göndermek: abonelik formunda ve onay e-postasında verdiğin açık rıza.</li> : null}
            <li>
              Yazdığın iletilere ve KVKK başvurularına yanıt vermek: m.5/2-ç (hukuki yükümlülük), m.5/2-e (bir
              hakkın kullanılması) ve m.5/2-f (meşru menfaat).
            </li>
          </ul>
          <p>Kişisel verilerini satmayız, reklam için kullanmayız ve profil çıkarmayız.</p>
        </PolicySection>

        <PolicySection title="Kimlere aktarılır">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Cloudflare, Inc. (ABD): sitenin barındırılması, içerik dağıtımı, güvenlik, hata kayıtları ve isteğe bağlı
              ölçüm. Cloudflare’ın verileri nasıl işlediğini{' '}
              <a href="https://www.cloudflare.com/privacypolicy/" className={link}>gizlilik politikasında</a>{' '}
              bulabilirsin.
            </li>
            {signups ? <li>Kit (ConvertKit LLC, ABD): bülten aboneliği ve gönderimleri.</li> : null}
            <li>Kullandığımız e-posta hizmet sağlayıcısı: bize yazdığın iletilerin alınması ve saklanması.</li>
            <li>Yetkili kamu kurum ve kuruluşları: yalnızca yasal bir yükümlülük olduğunda.</li>
          </ul>
          <p>
            Yurt dışına aktarım: Cloudflare{signups ? ' ve Kit' : ''} verileri Türkiye dışındaki sunucularda işler; e-posta hizmet
            sağlayıcısının sunucuları da yurt dışında bulunabilir. Bu durum KVKK’nın 9. maddesi kapsamında yurt dışına
            aktarım sayılır.
            Sitenin altyapı ve ölçüm verileri Cloudflare tarafından yurt dışındaki sunucularda işlenir{signups ? '; e-posta adresin, bülteni gönderen Kit tarafından ABD’de işlenir' : ''}.
          </p>
          <p>
            Kavurucularla kişisel veri paylaşmayız. Kavurucu bağlantıları ise seni doğrudan onların sitesine götürür;
            orada geçerli kurallar için aşağıdaki “Dış bağlantılar” bölümüne bak.
          </p>
        </PolicySection>

        <PolicySection title="Ne kadar saklanır">
          <ul className="list-disc space-y-2 pl-5">
            <li>Tercih çerezi: bir yıl. Süre dolunca ya da tercihini değiştirdiğinde yenilenir.</li>
            <li>Cihazındaki listeler ve test yanıtları: sen silene kadar tarayıcında kalır.</li>
            <li>Kötüye kullanım sayaçları: yalnızca istek sırasında ve dakikalık sınır süresince.</li>
            <li>Cloudflare hata ve performans kayıtları: Cloudflare’ın kısa saklama süresi boyunca, en fazla 7 gün.</li>
            <li>Ürün olayları: Cloudflare Analytics Engine’in üç aylık saklama süresi.</li>
            <li>Cloudflare Web Analytics ölçümleri: Cloudflare’ın kendi saklama süresi boyunca, toplu raporlar olarak.</li>
            {signups ? <li>Bülten: adresin abonelik sürdükçe Kit’te tutulur. Ayrıldığında, sana yeniden e-posta gönderilmemesi için yalnızca Kit’in gönderim engeli kaydında kalır.</li> : null}
            <li>E-posta yazışmaları: talebin sonuçlanmasından sonra gerekli olduğu sürece, en fazla iki yıl.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Dış bağlantılar">
          <p>
            Kahve satın alma ve kavurucu bağlantıları, sitedeki bir yönlendirme adresi (<code>/go/…</code>) üzerinden
            seni ilgili kavurucunun sitesine götürür. Kavurucunun, ziyaretin {SITE_NAME} üzerinden geldiğini görebilmesi
            için adrese <code>utm_source</code>, <code>utm_medium</code> ve <code>utm_content</code> etiketleri eklenir; bu
            etiketler seni tanımlayan bir bilgi içermez ve yönlendirme önceki sayfanın adresini iletmez. Kavurucunun
            sitesinde geçerli gizlilik, çerez, ödeme ve teslimat kuralları kavurucunun kendi politikalarına bağlıdır.
          </p>
        </PolicySection>

        <PolicySection title="KVKK kapsamındaki hakların">
          <p>
            KVKK’nın 11. maddesi uyarınca kişisel verinin işlenip işlenmediğini öğrenme, işlenmişse bilgi
            talep etme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt
            dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, silinmesini ya da
            yok edilmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analiz
            sonucu aleyhine bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini
            talep etme haklarına sahipsin.
          </p>
        </PolicySection>

        <PolicySection title="Başvuru ve şikâyet">
          <p>
            Taleplerini {mail} adresine e-postayla iletebilirsin. Başvurunda adını, talebini ve sana ulaşabileceğimiz
            bir iletişim bilgisini belirt; kimliğini doğrulamak için ek bilgi isteyebiliriz. Talebin en geç 30 gün
            içinde ve kural olarak ücretsiz yanıtlanır.
          </p>
          <p>
            Başvurun reddedilirse, yanıtı yetersiz bulursan ya da süresinde yanıt verilmezse, KVKK’nın 14. maddesi
            uyarınca yanıtı öğrendiğin tarihten itibaren 30 gün, her hâlde başvuru tarihinden itibaren 60 gün içinde
            Kişisel Verileri Koruma Kurulu’na şikâyette bulunabilirsin.
          </p>
        </PolicySection>

        <PolicySection title="Kontrol sende">
          <p>
            Tercihini sayfanın altındaki Çerez tercihleri düğmesiyle istediğin an değiştirebilirsin. Ölçümü reddedersen
            ya da iznini geri alırsan kullanım olayları gönderilmez ve ölçüm betiği yüklenmez; {signups ? 'bültene kaydolmaya ve ' : ''}kavurucuya
            gitmeye devam edebilirsin. Karşılaştırma listesini karşılaştırma çubuğundaki temizleme düğmesiyle,
            Listem’deki kahveleri listeden çıkararak, cihazındaki tüm bilgileri ise tarayıcının site verilerini silerek
            kaldırabilirsin.
          </p>
        </PolicySection>

        <PolicySection title="Bu metindeki değişiklikler">
          <p>
            Sitenin işlediği veriler değişirse bu metni güncelleriz ve aşağıdaki tarihi yenileriz.
          </p>
        </PolicySection>
      </div>

      <p className="mt-10 text-sm text-muted">
        Kullanım koşulları için{' '}
        <Link href="/terms" className="font-semibold text-ink underline-offset-4 hover:underline">
          Kullanım Şartları
        </Link>{' '}
        sayfasına bak. Son güncelleme: {LEGAL_UPDATED}.
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
