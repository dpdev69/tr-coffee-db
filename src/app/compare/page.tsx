import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { getCoffeeBySlug } from '@/lib/queries/coffees';
import {
  formatPackageWeight,
  formatVerifiedAt,
  getUnitPrice,
} from '@/lib/coffee-display';
import {
  BREW_METHOD_LABELS,
  PROCESS_LABELS,
  ROAST_LABELS,
} from '@/lib/constants/filter-options';
import {
  CompareCatalogLink,
  CompareRemoveLink,
} from '@/components/coffee/compare-controls';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import type { CoffeeWithRoaster } from '@/lib/types/database';

export const metadata: Metadata = {
  title: 'Kahveleri Karşılaştır',
  description:
    'Kahvelerin paket fiyatını, 100 g fiyatını, kökenini ve tat notlarını yan yana karşılaştır.',
  robots: { index: false, follow: true },
};
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.coffee;
  const slugs = [
    ...new Set(
      (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((slug) =>
        /^[a-z0-9_-]{1,240}$/i.test(slug),
      ),
    ),
  ].slice(0, 3);
  function compareHref(nextSlugs: string[]) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === 'coffee' || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value])
        query.append(key, item);
    }
    nextSlugs.forEach((slug) => query.append('coffee', slug));
    return query.size ? `/compare?${query.toString()}` : '/compare';
  }
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { coffee: await getCoffeeBySlug(slug), failed: false };
      } catch (error) {
        unstable_rethrow(error);
        return { coffee: null, failed: true };
      }
    }),
  );
  const coffees = results.flatMap((result) =>
    result.coffee ? [result.coffee] : [],
  );
  const continuingSlugs = slugs.filter(
    (_, index) => results[index].failed || results[index].coffee,
  );
  const failed = results.some((result) => result.failed);
  const missingSlugs = slugs.filter(
    (_, index) => !results[index].failed && !results[index].coffee,
  );
  const missing = missingSlugs.length > 0;
  const rows: {
    label: string;
    value: (coffee: CoffeeWithRoaster) => string;
  }[] = [
    {
      label: 'Paket fiyatı',
      value: (c) =>
        c.price_amount
          ? `${c.price_amount.toLocaleString('tr-TR')} ${c.price_currency === 'TRY' ? 'TL' : c.price_currency}`
          : 'Belirtilmemiş',
    },
    {
      label: 'Paket miktarı',
      value: (c) =>
        c.weight_grams ? formatPackageWeight(c.weight_grams) : 'Belirtilmemiş',
    },
    {
      label: '100 g fiyatı',
      value: (c) => {
        const price = getUnitPrice(c);
        return price !== null
          ? `${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`
          : 'Hesaplanamıyor';
      },
    },
    {
      label: 'Köken',
      value: (c) =>
        [c.origin_country, c.origin_region].filter(Boolean).join(' · ') ||
        'Belirtilmemiş',
    },
    {
      label: 'İşleme',
      value: (c) =>
        c.process !== 'unknown'
          ? (PROCESS_LABELS[c.process] ?? c.process)
          : 'Belirtilmemiş',
    },
    {
      label: 'Kavrum',
      value: (c) =>
        c.roast_level !== 'unknown'
          ? (ROAST_LABELS[c.roast_level] ?? c.roast_level)
          : 'Belirtilmemiş',
    },
    {
      label: 'Tadım notları',
      value: (c) => c.flavor_notes_normalized.join(' · ') || 'Paylaşılmamış',
    },
    {
      label: 'Önerilen demleme',
      value: (c) =>
        c.brew_methods.map((m) => BREW_METHOD_LABELS[m] ?? m).join(' · ') ||
        'Paylaşılmamış',
    },
    { label: 'Kafeinsiz', value: (c) => (c.is_decaf ? 'Evet' : 'Hayır') },
    {
      label: 'Kaynak kontrolü',
      value: (c) => formatVerifiedAt(c.last_seen_at),
    },
  ];
  return (
    <div className="page-shell section-space">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kısa listen</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">
            Aynı masada, yan yana.
          </h1>
        </div>
        <CompareCatalogLink slugs={continuingSlugs} className="text-link">
          Kahve ekle ↗
        </CompareCatalogLink>
      </div>
      <p className="mb-8 max-w-2xl text-base leading-7 text-[#625e57]">
        Farklı paketleri 100 g fiyatıyla karşılaştır. Tat ve demleme bilgileri
        kavurucuların paylaştığı bilgilerdir; eksik bilgi uyumsuzluk anlamına
        gelmez.
      </p>
      {failed && (
        <div className="mb-6">
          <DataSourceNotice
            title="Bazı kahveler yüklenemedi."
            message="Veri kaynağına şu an ulaşamıyoruz. Seçimin bu sayfanın adresinde korunuyor; biraz sonra yeniden dene."
            actionHref={compareHref(slugs)}
            actionLabel="Tekrar dene"
          />
        </div>
      )}
      {missing && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
          <p role="status">
            Seçtiğin kahvelerden bazıları artık güncel katalogda bulunmuyor.
            Stok veya son kontrol tarihi değişmiş olabilir. Listeden çıkarıp
            yeni bir kahve ekleyebilirsin.
          </p>
          <div className="mt-3 space-y-3">
            {missingSlugs.map((slug) => (
              <div key={slug} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 break-all text-xs">{slug}</span>
                <CompareRemoveLink
                  name={slug}
                  href={compareHref(slugs.filter((value) => value !== slug))}
                  remainingSlugs={slugs.filter((value) => value !== slug)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {coffees.length ? (
        <>
          <p className="mb-3 text-sm text-[#625e57]">
            {coffees.length === 1
              ? 'Karşılaştırmak için katalogdan bir kahve daha seç.'
              : 'Bu sayfanın adresini paylaşarak aynı kahveleri birlikte inceleyebilirsin.'}{' '}
            <span className="sm:hidden">Tabloyu yana kaydır →</span>
          </p>
          <div
            className="compare-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Kahvelerin karşılaştırma tablosu"
          >
            <table
              className="compare-table"
              style={{ minWidth: 150 + coffees.length * 240 }}
            >
              <caption className="sr-only">
                Kahve fiyatı ve özellik karşılaştırması
              </caption>
              <thead>
                <tr>
                  <th scope="col">Özellik</th>
                  {coffees.map((coffee) => (
                    <th scope="col" key={coffee.id}>
                      <p className="text-xs font-semibold text-[#244b3d]">
                        {coffee.roasters.name}
                      </p>
                      <h2>
                        <Link
                          href={`/coffees/${coffee.slug}`}
                          className="hover:underline"
                        >
                          {coffee.name_normalized ?? coffee.name}
                        </Link>
                      </h2>
                      <CompareRemoveLink
                        name={coffee.name}
                        href={compareHref(
                          slugs.filter((slug) => slug !== coffee.slug),
                        )}
                        remainingSlugs={slugs.filter(
                          (slug) => slug !== coffee.slug,
                        )}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {coffees.map((coffee) => (
                      <td key={coffee.id}>{row.value(coffee)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">İncele</th>
                  {coffees.map((coffee) => (
                    <td key={coffee.id}>
                      <Link
                        href={`/coffees/${coffee.slug}`}
                        className="text-link"
                      >
                        Kahve detayları ↗
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="catalog-caption">
            Fiyatlara kargo dahil değildir. Birim fiyat, listelenen paket fiyatı
            ve gramajından hesaplanır. Son fiyat ve stok için kahve detayından
            kavurucuya geç.
          </p>
        </>
      ) : (
        !failed && (
          <div className="empty-catalog">
            <h2 className="font-display text-3xl">
              Kararsız kaldığın kahveleri buraya getir.
            </h2>
            <p>
              Kahve kartlarındaki “Karşılaştır” düğmesiyle en fazla 3 çekirdek
              seç. Paket fiyatını, gramajını ve tadım notlarını birlikte gör.
            </p>
            <CompareCatalogLink slugs={[]} className="button-dark">
              Katalogdan kahve seç ↗
            </CompareCatalogLink>
          </div>
        )
      )}
    </div>
  );
}
