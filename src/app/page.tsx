import Link from 'next/link';
import Image from 'next/image';
import { unstable_rethrow } from 'next/navigation';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getFeaturedCoffees, getStats } from '@/lib/queries/coffees';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const structuredData = {
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
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL.origin,
  },
};

export default async function HomePage() {
  let stats = { totalCoffees: 0, totalRoasters: 0, totalOrigins: 0 };
  let featured: Awaited<ReturnType<typeof getFeaturedCoffees>> = [];
  let catalogUnavailable = false;

  try {
    [stats, featured] = await Promise.all([getStats(), getFeaturedCoffees(6)]);
  } catch (error) {
    unstable_rethrow(error);
    catalogUnavailable = true;
    console.error('Homepage catalog summary failed to load', {
      error: getErrorMessage(error),
    });
  }

  return (
    <div className="bg-[#fffdf8] text-[#1f1d1b]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="overflow-hidden bg-white px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-14">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
              Türkiye specialty coffee kayıt sistemi
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[0.94] text-[#1f1d1b] sm:text-6xl lg:text-7xl">
              Kahveyi bul. Yolculuğunu gör.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#5d5853] sm:text-lg">
              Bağımsız kavurucularda satışta görülen çekirdekleri karşılaştır. Üreticiden
              işleme ve kavruma kadar bildiğimiz adımları, kaynakları ve eksik kalan bağlantıları
              tek kayıtta incele.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/quiz"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#1f1d1b] px-7 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                Kahve Bul
              </Link>
              <Link
                href="/coffees"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1f1d1b] bg-white px-7 text-sm font-semibold text-[#1f1d1b] transition-colors hover:bg-[#f6f1e8]"
              >
                Kataloğa Bak
              </Link>
              <Link
                href="/rankings"
                className="inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
              >
                Sıralamalar
              </Link>
            </div>
          </div>
          <HeroPreview coffees={featured.slice(0, 4)} />
        </div>
      </section>

      <section className="border-y border-[#1f1d1b]/15 bg-[#ecff64] px-4 py-8 sm:px-6 lg:px-8">
        {catalogUnavailable ? (
          <div className="mx-auto max-w-4xl">
            <DataSourceNotice
              title="Canlı katalog sayıları şu an yüklenemiyor."
              message="Katalog veri kaynağına ulaşamadık, bu yüzden tahmini sayı göstermiyoruz. Güncel kahve ve kavurucu sayıları bağlantı düzeldiğinde yeniden görünür."
              actionHref="/coffees"
              actionLabel="Kataloğu tekrar dene"
            />
          </div>
        ) : (
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.72fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1f1d1b]/70">
                Nasıl işliyor?
              </p>
              <h2 className="mt-2 font-display text-4xl leading-none text-[#1f1d1b]">
                Üç adımda kanıta dayalı seçim.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#1f1d1b]/70">
                Sayılar yalnızca son 3 gün içinde satışta görülen ve nitelikli olarak
                sınıflandırılan çekirdeklerden oluşur.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-5">
                <StatBlock number={stats.totalCoffees} label="kahve" />
                <StatBlock number={stats.totalRoasters} label="kavurucu" />
                <StatBlock number={stats.totalOrigins} label="köken" />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[#1f1d1b]/20">
              <Step
                step="01"
                title="Kahveyi bul"
                description="Kavurucu siteleri arasında kaybolmadan güncel çekirdekleri karşılaştır."
              />
              <Step
                step="02"
                title="Yolculuğa dal"
                description="Üretici, lot, işleme, ticaret ve kavrum adımlarında bildiklerimizi gör."
              />
              <Step
                step="03"
                title="Kanıtı kontrol et"
                description="Her bilginin kaynağını ve doğrulama seviyesini aç, sonra kavurucuya geç."
              />
            </div>
          </div>
        )}
      </section>

      <section className="bg-[#fffdf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <FeatureGraphic />
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
              Kahve eşleştirici
            </p>
            <h2 className="mt-4 font-display text-4xl leading-[0.98] text-[#1f1d1b] sm:text-5xl">
              Damak tadına göre kısa liste çıkar.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#5d5853]">
              Demleme yöntemin, sevdiğin tat ailesi ve kavrum tercihinle uyumlu
              kahveleri gerçek katalog filtrelerine çeviriyoruz.
            </p>
            <Link
              href="/quiz"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#1f1d1b] px-7 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Kısa Testi Aç
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#1f1d1b]/10 bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
              Keşif yolları
            </p>
            <h2 className="mt-4 font-display text-4xl leading-[0.98] text-[#1f1d1b] sm:text-5xl">
              İster filtrele, ister hızlıca eşleş.
            </h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <PathCard
              href="/coffees"
              eyebrow="Katalog"
              title="Tüm kahveleri tara"
              description="Köken, işleme, kavrum ve demleme tercihlerine göre daralt."
            />
            <PathCard
              href="/quiz"
              eyebrow="Test"
              title="Damak tadına göre bul"
              description="Birkaç seçimle katalog içinde sana yakın çekirdekleri aç."
            />
            <PathCard
              href="/roasters"
              eyebrow="Kavurucular"
              title="Markaları incele"
              description="Aktif kavurucuları ve her birinin güncel kahvelerini gör."
            />
            <PathCard
              href="/rankings"
              eyebrow="Sıralamalar"
              title="Pazarı karşılaştır"
              description="İzlenebilirlik, yayınlanan puan, fiyat ve ilgiyi ayrı listelerde gör."
            />
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
                Yeni gelenler
              </p>
              <h2 className="mt-3 font-display text-4xl leading-none text-[#1f1d1b]">
                Katalogdaki son çekirdekler.
              </h2>
            </div>
            <Link
              href="/coffees"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
            >
              Tümünü gör
            </Link>
          </div>
          <div className="mt-8">
            <CoffeeGrid coffees={featured} />
          </div>
        </section>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function StatBlock({ number, label }: { number: number | string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none text-[#1f1d1b]">{number}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1d1b]/55">
        {label}
      </div>
    </div>
  );
}

function HeroPreview({
  coffees,
}: {
  coffees: Awaited<ReturnType<typeof getFeaturedCoffees>>;
}) {
  if (coffees.length > 0) {
    return (
      <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
        <div className="relative aspect-[1.04] overflow-hidden rounded-[28px] border border-[#1f1d1b]/10 bg-[#f2eadf] p-4 sm:p-5">
          <div className="grid h-full grid-cols-2 gap-3">
            {coffees.map((coffee, index) => (
              <Link
                key={coffee.id}
                href={`/coffees/${coffee.slug}`}
                className={`group relative overflow-hidden rounded-2xl bg-[#1f1d1b] ${
                  index === 0 ? 'col-span-2' : ''
                }`}
              >
                {isRenderableProductImage(coffee.image_url) ? (
                  <Image
                    src={coffee.image_url}
                    alt={coffee.name}
                    fill
                    sizes={index === 0 ? '(max-width: 1024px) 100vw, 45vw' : '22vw'}
                    className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
                    priority={index === 0}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#8b3f24]" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                    {coffee.roasters.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold leading-5">
                    {coffee.name_normalized ?? coffee.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative aspect-[1.04] overflow-hidden rounded-[28px] border border-[#1f1d1b]/10 bg-[#f2eadf] p-6">
        <div className="grid h-full grid-rows-[1fr_auto]">
          <div className="grid grid-cols-2 gap-3">
            <PreviewTile label="Köken" value="Brezilya, Etiyopya, Kolombiya" />
            <PreviewTile label="İşleme" value="Yıkanmış, Natürel, Honey" accent />
            <PreviewTile label="Kavrum" value="Açık, Orta, Koyu" accent />
            <PreviewTile label="Tat" value="Meyvemsi, Çikolata, Çiçeksi" />
          </div>
          <div className="mt-6 rounded-2xl bg-[#1f1d1b] p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Tarafsız katalog
            </p>
            <p className="mt-3 font-display text-3xl leading-none sm:text-4xl">
              Kavurucu seçmeden önce tabloyu netleştir.
            </p>
            <p className="mt-4 text-sm font-semibold leading-5 text-white/70">
              Mağaza değiliz; doğru çekirdeğe yol gösteririz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function isRenderableProductImage(url: string | null): url is string {
  return Boolean(url && !/\.gif(?:[?#]|$)/i.test(url));
}

function PreviewTile({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#1f1d1b]/10 p-4 ${accent ? 'bg-[#ecff64]' : 'bg-white'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c3a20]">
        {label}
      </p>
      <p className="mt-3 text-sm font-semibold leading-5 text-[#1f1d1b]">{value}</p>
    </div>
  );
}

function FeatureGraphic() {
  return (
    <div className="relative aspect-[1.05] overflow-hidden rounded-[28px] border border-[#1f1d1b]/10 bg-white p-7">
      <div className="flex h-full flex-col justify-between rounded-[22px] bg-[#f2eadf] p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
            Filtre akışı
          </p>
          <h3 className="mt-4 font-display text-5xl leading-none text-[#1f1d1b]">
            Seç, daralt, kavurucuya git.
          </h3>
        </div>
        <div className="grid gap-3">
          {['Demleme yöntemi', 'Tat ailesi', 'İşleme', 'Kavrum'].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#1f1d1b]">
              <span>{item}</span>
              <span className="h-3 w-3 rounded-full bg-[#ecff64]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PathCard({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-56 flex-col justify-between rounded-[24px] border border-[#1f1d1b]/12 bg-[#fffdf8] p-6 transition-colors hover:bg-[#f6f1e8]"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c3a20]">
          {eyebrow}
        </p>
        <h3 className="mt-4 font-display text-3xl leading-none text-[#1f1d1b]">
          {title}
        </h3>
      </div>
      <p className="mt-8 text-sm leading-6 text-[#5d5853]">{description}</p>
    </Link>
  );
}

function Step({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="sm:px-6 sm:first:pl-0">
      <div className="text-sm font-bold tabular-nums text-[#1f1d1b]/55">
        {step}
      </div>
      <div>
        <h3 className="mt-3 text-base font-semibold text-[#1f1d1b]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#1f1d1b]/70">{description}</p>
      </div>
    </div>
  );
}
