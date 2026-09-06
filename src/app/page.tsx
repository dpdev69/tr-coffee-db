import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getFeaturedCoffees, getStats } from '@/lib/queries/coffees';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const paths = [
  {
    label: 'Çikolata & kuruyemiş',
    detail: 'Tanıdık, sıcak tatlar',
    href: '/coffees?flavorCategory=Chocolate&flavorCategory=Nutty',
    number: '01',
  },
  {
    label: 'Meyvemsi & çiçeksi',
    detail: 'Yeni tatlar keşfet',
    href: '/coffees?flavorCategory=Fruity&flavorCategory=Floral',
    number: '02',
  },
  {
    label: 'Espresso için',
    detail: 'Makinen için çekirdekler',
    href: '/coffees?brewMethod=espresso',
    number: '03',
  },
  {
    label: 'Kafeinsiz seçenekler',
    detail: 'Dekaf çekirdekleri incele',
    href: '/coffees?isDecaf=true',
    number: '04',
  },
];

export default async function HomePage() {
  let stats = { totalCoffees: 0, totalRoasters: 0, totalOrigins: 0 };
  let featured: Awaited<ReturnType<typeof getFeaturedCoffees>> = [];
  let catalogUnavailable = false;
  try {
    [stats, featured] = await Promise.all([getStats(), getFeaturedCoffees(4)]);
  } catch (error) {
    unstable_rethrow(error);
    catalogUnavailable = true;
    console.error('Homepage catalog failed to load', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL.origin,
            description: SITE_DESCRIPTION,
            inLanguage: 'tr-TR',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE_URL.origin}/coffees?search={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      <section className="discovery-hero">
        <div className="page-shell discovery-intro">
          <div>
            <p className="eyebrow">Türkiye’nin bağımsız kahve rehberi</p>
            <h1>
              Bir sonraki
              <br />
              <em>iyi kahveni</em> bul.
            </h1>
            <p className="hero-description">
              Kavurucuları tek tek gezmeden çekirdekleri keşfet. Tatları,
              paketleri ve fiyatları karşılaştır; sana uygun kahveyi seç.
            </p>
            <form action="/coffees" className="discovery-search" role="search">
              <label className="sr-only" htmlFor="discover-search">
                Kahve, kavurucu veya tat ara
              </label>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                id="discover-search"
                name="search"
                type="search"
                placeholder="Kahve, kavurucu veya tat…"
              />
              <button type="submit">
                Kahve ara <span aria-hidden="true">↗</span>
              </button>
            </form>
            <div className="quick-links">
              <span>Bir yerden başla:</span>
              <Link href="/coffees?brewMethod=filter">Filtre kahve</Link>
              <Link href="/coffees?sort=unit_price_asc">
                100 g fiyatına göre
              </Link>
              <Link href="/coffees?process=natural">Natürel işleme</Link>
            </div>
          </div>
          <aside className="discovery-note">
            <span className="eyebrow">
              Nereden başlayacağını bilmiyor musun?
            </span>
            <h2>Önce damak tadın.</h2>
            <p>
              Demleme yöntemini ve sevdiğin tatları seç. Tercihlerine uyan
              çekirdekleri birlikte daraltalım.
            </p>
            <Link href="/quiz" className="button-dark">
              Kahvemi bul <span aria-hidden="true">↗</span>
            </Link>
            <div className="note-foot">
              <span>Üyelik gerektirmez</span>
              <Link href="/guide">Önce rehberi oku →</Link>
            </div>
          </aside>
        </div>
      </section>
      <div className="catalog-strip">
        <div className="page-shell">
          {!catalogUnavailable && stats.totalCoffees > 0 ? (
            <p>
              <strong>{stats.totalCoffees.toLocaleString('tr-TR')}</strong>{' '}
              kahve <span>·</span> <strong>{stats.totalRoasters}</strong>{' '}
              kavurucu <span>·</span> <strong>{stats.totalOrigins}</strong>{' '}
              köken
            </p>
          ) : (
            <p>Bağımsız kavurucular. Kaynağı açık bilgiler.</p>
          )}
          <p>
            Son 3 günde satışta görülen çekirdekler{' '}
            <span aria-hidden="true">↗</span>
          </p>
        </div>
      </div>
      <section className="page-shell section-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Katalogdan</p>
            <h2>Yeni keşiflere yer aç.</h2>
          </div>
          <Link href="/coffees" className="text-link">
            Tüm kahveler ↗
          </Link>
        </div>
        {catalogUnavailable ? (
          <DataSourceNotice
            title="Katalog şu an yüklenemiyor."
            message="Güncel fiyatları doğrulayamıyoruz. Bu sırada kahve rehberini okuyabilir veya demleme oranını hesaplayabilirsin."
            actionHref="/guide"
            actionLabel="Kahve rehberini aç"
          />
        ) : featured.length > 0 ? (
          <CoffeeGrid coffees={featured} />
        ) : (
          <div className="empty-catalog">
            <h3>Katalog güncellenmeyi bekliyor.</h3>
            <p>
              Son 3 günde satışta olduğunu doğrulayamadığımız kahveleri burada
              listelemiyoruz. Bu sırada bir sonraki fincanını planlayabilirsin.
            </p>
            <Link href="/guide" className="text-link">
              Demleme rehberine göz at ↗
            </Link>
          </div>
        )}
        <p className="catalog-caption">
          Fiyatlar kavurucunun belirttiği paket içindir. Adil karşılaştırma için
          100 g fiyatına bak; son fiyatı ve stoğu kavurucunun sitesinde kontrol
          et.
        </p>
      </section>
      <section className="page-shell section-space pt-0">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sen nasıl seversin?</p>
            <h2>Bir tatla başla.</h2>
          </div>
          <Link href="/coffees" className="text-link">
            Tüm filtreleri aç ↗
          </Link>
        </div>
        <div className="discovery-paths">
          {paths.map((path) => (
            <Link href={path.href} key={path.number}>
              <span className="path-number">{path.number}</span>
              <div>
                <h3>{path.label}</h3>
                <p>{path.detail}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="guide-invitation">
        <div className="page-shell">
          <div>
            <p className="eyebrow">Çekirdekten fincana</p>
            <h2>
              İyi kahve, biraz da
              <br />
              onu tanımakla başlar.
            </h2>
          </div>
          <div>
            <p>
              Yıkanmış ve natürel ne demek? Tadım notları aroma katkısı mı? Ne
              kadar kahve, ne kadar su? Kısa ve uygulanabilir cevaplar.
            </p>
            <Link href="/guide" className="button-light">
              Kahve rehberi & demleme hesaplayıcı ↗
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
