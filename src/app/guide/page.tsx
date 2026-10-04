import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrewCalculator } from '@/components/guide/brew-calculator';

export const metadata: Metadata = pageMetadata("Kahve Rehberi ve Demleme Hesaplayıcı", "Kahve seçimi, tadım notları ve işleme yöntemleri için kısa bir rehber. Filtre, espresso, French press ve AeroPress için demleme oranını hesapla.", "/guide");
export default function GuidePage() {
  return (
    <div className="page-shell section-space">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow">Daha iyi bir fincan için</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.08] sm:text-6xl">
          Kahveni biraz
          <br />
          <em className="text-accent">daha yakından tanı.</em>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted">
          Seçmek için uzman olman gerekmiyor. Pakette neye bakacağını bil,
          ölçerek demle ve sevdiğin tadı bulana kadar küçük değişiklikler yap.
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <a href="#calculator" className="text-link">
            Demleme oranını hesapla ↓
          </a>
          <Link href="/kahveler" className="text-link">
            Kahveleri keşfet ↗
          </Link>
        </div>
      </div>
      <div className="guide-layout">
        <article className="guide-copy">
          <h2>Pakette üç şeye bak.</h2>
          <p>
            <strong className="text-ink">Demleme önerisi.</strong>{' '}
            Ekipmanına uygun önerisi olan bir kahveyle başlamak işini
            kolaylaştırır. Katalogda yöntem yazmıyorsa kahve o yöntemle
            demlenemez anlamına gelmez; kavurucu bu bilgiyi paylaşmamış
            olabilir.
          </p>
          <p>
            <strong className="text-ink">Tadım notları.</strong> Sevdiğin
            tatlardan yola çık. Bu notlar bir deneyimi tarif eder; fincanda ne
            algılayacağın demleme, su ve damak tadına göre değişir.
          </p>
          <p>
            <strong className="text-ink">Paket miktarı ve fiyat.</strong>{' '}
            200 g ile 1 kg paketi yalnızca etiket fiyatından kıyaslama.
            Kavurucunun sunduğu gramajı, paket fiyatını ve ne kadar kahve
            tükettiğini birlikte değerlendir. Kargo ücretini ayrıca hesaba kat.
          </p>
          <h2>Kahve sözlüğü, kısa hali.</h2>
          <details open>
            <summary>Yıkanmış, natürel, honey ne demek?</summary>
            <p>
              Hasattan sonra çekirdeğin meyveden ayrılma ve kurutulma
              yöntemlerini anlatır. Yıkanmış işlemde meyve tabakaları kurutmadan
              önce uzaklaştırılır; natürelde kahve meyvesi bütün olarak kurur.
              Honey yöntemde müsilajın bir kısmı çekirdeğin üzerinde bırakılır.
              “Honey”, bal eklendiği anlamına gelmez.
            </p>
            <p>
              İşleme, tat hakkında bir ipucu olabilir; tek başına belirli bir
              aromayı garanti etmez.
            </p>
          </details>
          <details>
            <summary>Çikolata notu varsa çikolata mı eklenmiş?</summary>
            <p>
              Tadım notu, kahvenin duyusal çağrışımını anlatır; içerik listesi
              değildir. Aromalandırma veya başka bir içerik olup olmadığını
              kavurucunun ürün açıklamasından kontrol et.
            </p>
          </details>
          <details>
            <summary>Açık ve koyu kavrum arasında nasıl seçerim?</summary>
            <p>
              Kavrum etiketi bir başlangıç ipucudur; kavurucular arasında aynı
              şeyi ifade etmeyebilir. Sevdiğin kahvenin kavrumunu, tadım
              notlarını ve önerilen demleme yöntemini birlikte karşılaştır. Tek
              bir etiketi kalite puanı gibi okuma.
            </p>
          </details>
          <h2>İlk deneme tam olmadıysa…</h2>
          <p>
            Bir sonraki demlemede yalnızca tek şeyi değiştir: öğütüm, oran veya
            süre. Aynı çekirdekle tuttuğun kısa notlar, hangi değişikliğin
            hoşuna gittiğini anlamanı kolaylaştırır. Hesaplayıcıdaki tarifler
            başlangıç noktalarıdır; kavurucunun kahveye özel tarifi varsa onu da
            dene.
          </p>
          <p className="border-t border-line pt-5 text-sm">
            İşleme ve tat konusunda daha fazlası:{' '}
            <a
              href="https://counterculturecoffee.com/blogs/counter-culture-coffee/coffee-basics-honey-processing-2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4"
            >
              Counter Culture’ın honey işleme rehberi ↗
            </a>
          </p>
        </article>
        <BrewCalculator />
      </div>
      <div className="mt-12 border-t border-line pt-6">
        <Link href="/kahveler" className="button-dark">
          Şimdi çekirdekleri keşfet ↗
        </Link>
      </div>
    </div>
  );
}
