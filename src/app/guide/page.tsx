import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrewCalculator } from '@/components/guide/brew-calculator';
import { JsonLd, siteOrganization } from '@/components/layout/json-ld';
import { absoluteUrl } from '@/lib/site';
import { GUIDE_UPDATED } from '@/lib/content-dates';
import { findComparison, comparisonQuestion } from '@/lib/comparisons';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

const COMPARISON_LINKS = ['espresso-vs-filtre', 'etiyopya-vs-kolombiya', 'kolombiya-vs-brezilya'];
const comparison = (slug: string) => { const item = findComparison(slug); return item ? comparisonQuestion(item) : slug; };
const updated = new Date(GUIDE_UPDATED).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
const description = "Kahve seçimi, tadım notları ve işleme yöntemleri için kısa bir rehber. Filtre, espresso, French press ve AeroPress için demleme oranını hesapla.";
export const metadata: Metadata = pageMetadata("Kahve rehberi ve demleme hesaplayıcı", description, "/guide", { type: 'article' });
export default function GuidePage() {
  return (
    <div className="page-shell section-space">
      <JsonLd data={{ '@type': 'Article', headline: 'Kahveni biraz daha yakından tanı.', description, inLanguage: 'tr-TR', url: absoluteUrl('/guide'), mainEntityOfPage: absoluteUrl('/guide'),
        author: siteOrganization(), publisher: siteOrganization(), dateModified: GUIDE_UPDATED }} />
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow">Daha iyi bir fincan için</p>
        <h1 className="mt-4 font-display text-title">
          Kahveni biraz
          <br />
          <em className="not-italic text-accent">daha yakından tanı.</em>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted">
          Seçmek için uzman olman gerekmiyor. Pakette neye bakacağını bil,
          ölçerek demle ve sevdiğin tadı bulana kadar küçük değişiklikler yap.
        </p>
        <p className="mt-3 text-sm text-muted">Son güncelleme: <time dateTime={GUIDE_UPDATED}>{updated}</time></p>
        <div className="mt-4 flex flex-wrap gap-6">
          <a href="#calculator" className="text-link">
            Demleme oranını hesapla ↓
          </a>
          <Link href="/kahveler" className="text-link">
            Kahveleri keşfet ↗
          </Link>
        </div>
      </div>
      <div className="guide-layout grid-pair">
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
          <h2>Filtre kahve için iki rehber</h2>
          <p>
            Oran, öğütüm, su sıcaklığı ve V60, Chemex, French press, makine
            ve soğuk demleme için süreler:{' '}
            <Link href="/rehber/filtre-kahve-nasil-yapilir" className="text-accent underline underline-offset-4">Filtre kahve nasıl yapılır?</Link>{' '}
            Hangi çekirdeği alacağını tadına, kökenine ve kavrumuna göre seçmek
            için:{' '}
            <Link href="/rehber/filtre-kahve-cekirdegi" className="text-accent underline underline-offset-4">Filtre kahve çekirdeği seçimi</Link>.
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
              aromayı garanti etmez. Satıştaki çekirdeklerde farkın nasıl
              göründüğüne bak:{' '}
              <Link href="/karsilastir/naturel-vs-yikanmis" prefetch={false} className="text-accent underline underline-offset-4">
                {comparison('naturel-vs-yikanmis')}
              </Link>
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
          <h2>İki çekirdek arasında kaldıysan</h2>
          <p>
            Sık sorulan “hangisi?” sorularını satıştaki çekirdeklerle yan yana
            koyduk: 250 g paket fiyatları, köken, işlem ve tat notları.
          </p>
          <ul className="my-4 flex flex-wrap gap-2">
            {COMPARISON_LINKS.map(slug => <li key={slug}><Link href={`/karsilastir/${slug}`} prefetch={false} className="filter-option">{comparison(slug)}</Link></li>)}
            <li><Link href="/karsilastir" className="filter-option">Tüm karşılaştırmalar</Link></li>
          </ul>
          <p>
            Kataloğun genel resmi, yani hangi kökenden kaç kahve olduğu ve
            gramaja göre paket fiyatları,{' '}
            <Link href="/veri" prefetch={false} className="text-accent underline underline-offset-4">veri özetinde</Link>.
          </p>
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
