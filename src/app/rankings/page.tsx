import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { getCoffeeRankings, type RankedCoffee } from '@/lib/coffee-rankings';
import { SITE_NAME } from '@/lib/site';

const description =
  'Türkiye specialty coffee pazarını izlenebilirlik, yayınlanan kalite kanıtı, şeffaf fiyat ve pazar ilgisi gibi ayrı ölçütlerle karşılaştırın.';

export const metadata: Metadata = {
  title: 'Kahve Sıralamaları',
  description,
  alternates: { canonical: '/rankings' },
  openGraph: {
    title: `Kahve Sıralamaları | ${SITE_NAME}`,
    description,
    url: '/rankings',
    type: 'website',
  },
};

export default async function RankingsPage() {
  let rankings: Awaited<ReturnType<typeof getCoffeeRankings>> | null = null;

  try {
    rankings = await getCoffeeRankings(10);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Coffee rankings failed to load', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="overflow-hidden rounded-[30px] bg-[#171513] px-6 py-9 text-white sm:px-9 sm:py-12 lg:px-12">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#ecff64]">
          Market intelligence
        </p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.95] sm:text-6xl">
              Tek bir “en iyi” yok. Kanıtı olan sıralamalar var.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
              Kalite, izlenebilirlik, fiyat ve ilgi birbirine karıştırılmaz. Her tablo kendi
              ölçütünü gösterir ve eksik veriyi başarı gibi sunmaz.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-xs leading-5 text-white/60">
            <p className="font-semibold text-white">Metodoloji</p>
            <p className="mt-2">
              İzlenebilirlik puanı yayınlanan köken, üretici, çiftlik, hasat, işleme, varyete,
              rakım ve değerlendirme alanlarının kapsanmasına dayanır. Yayınlanan kalite puanları
              bağımsız doğrulama olarak kabul edilmez.
            </p>
          </div>
        </div>
      </section>

      {!rankings ? (
        <div className="mt-8 max-w-3xl">
          <DataSourceNotice
            title="Sıralamalar geçici olarak yüklenemiyor."
            message="Katalog veri kaynağına şu an ulaşamadık. Eski veya eksik bir tablo göstermek yerine sıralamayı durdurduk."
            actionHref="/rankings"
            actionLabel="Tekrar dene"
          />
        </div>
      ) : (
        <div className="mt-9 grid gap-7 xl:grid-cols-2">
          <RankingPanel
            eyebrow="Veri kalitesi"
            title="En izlenebilir kahveler"
            description="Yolculuk hakkında en fazla yapılandırılmış alanı bulunan güncel kahveler."
            coffees={rankings.traceability}
            metric={(coffee) => `${coffee.traceabilityScore}/100`}
            metricLabel="izlenebilirlik"
          />
          <RankingPanel
            eyebrow="Kalite kanıtı"
            title="Yayınlanan en yüksek puanlar"
            description="Kavurucu kaynaklarında puan bulunan kahveler. Kanıt seviyesi lot sayfasında ayrıca gösterilir."
            coffees={rankings.qualityEvidence}
            metric={(coffee) => coffee.sca_score?.toFixed(1) ?? '—'}
            metricLabel="yayınlanan puan"
          />
          <RankingPanel
            eyebrow="Şeffaf fiyat"
            title="İzlenebilir kahvede erişilebilir fiyat"
            description="İzlenebilirlik puanı en az 40 olan ürünler arasında düşük 100 gram fiyatı."
            coffees={rankings.accessiblePrice}
            metric={(coffee) =>
              coffee.price_per_100g == null
                ? '—'
                : `${coffee.price_per_100g.toLocaleString('tr-TR')} TL`
            }
            metricLabel="100 gram"
          />
          <RankingPanel
            eyebrow="Pazar ilgisi"
            title="En çok incelenen kahveler"
            description="TR CoffeeDB üzerinden kavurucu sayfasına geçiş ilgisi. Kalite puanı değildir."
            coffees={rankings.marketInterest}
            metric={(coffee) => coffee.click_count.toLocaleString('tr-TR')}
            metricLabel="geçiş"
          />
        </div>
      )}
    </div>
  );
}

function RankingPanel({
  eyebrow,
  title,
  description,
  coffees,
  metric,
  metricLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  coffees: RankedCoffee[];
  metric: (coffee: RankedCoffee) => string;
  metricLabel: string;
}) {
  return (
    <section className="rounded-[26px] border border-[#1f1d1b]/10 bg-white p-5 sm:p-7">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c3a20]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl leading-none text-[#1f1d1b]">{title}</h2>
      <p className="mt-3 min-h-10 text-sm leading-5 text-[#5d5853]">{description}</p>

      <ol className="mt-6 divide-y divide-[#1f1d1b]/10 border-y border-[#1f1d1b]/10">
        {coffees.map((coffee, index) => (
          <li key={coffee.id}>
            <Link
              href={`/coffees/${coffee.slug}`}
              className="group grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3.5"
            >
              <span className="font-mono text-sm font-bold text-[#1f1d1b]/35">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1f1d1b] group-hover:underline group-hover:underline-offset-4">
                  {coffee.name_normalized ?? coffee.name}
                </span>
                <span className="mt-1 block truncate text-xs text-[#5d5853]">
                  {coffee.roasters.name}
                  {coffee.origin_country ? ` · ${coffee.origin_country}` : ''}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-bold text-[#1f1d1b]">
                  {metric(coffee)}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-[#5d5853]">
                  {metricLabel}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
