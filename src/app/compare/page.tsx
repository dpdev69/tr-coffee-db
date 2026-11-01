import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { getCoffeeBySlug } from '@/lib/queries/coffees';
import { displayCoffeeName, displayNotes, formatPackageWeight } from '@/lib/coffee-display';
import { countryLabel } from '../../../shared/v2/country-labels';
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
import type { LegacyCatalogCoffee } from '@/lib/v2-legacy';
type ComparisonCoffee = CoffeeWithRoaster & Partial<Pick<LegacyCatalogCoffee, 'stock_status' | 'decaf_status'>>;

/** An empty table cell: a dash, never a note about what the roaster did or did not publish (owner, 1 Nov). */
const UNSTATED = '—';
export const metadata: Metadata = {
  ...pageMetadata('Kahveleri Karşılaştır', 'Kahvelerin paket fiyatını, gramajını, kökenini ve tat notlarını yan yana karşılaştır.', '/compare'),
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
  const coffees = [...new Map(results.flatMap(result => result.coffee ? [[result.coffee.id, result.coffee] as const] : [])).values()];
  const withoutCoffee = (id: string) => slugs.filter((_, index) => results[index].coffee?.id !== id);
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
    value: (coffee: ComparisonCoffee) => string;
  }[] = [
    {
      label: 'Paket fiyatı',
      value: (c) =>
        c.price_amount
          ? `${c.price_amount.toLocaleString('tr-TR')} ${c.price_currency === 'TRY' ? 'TL' : c.price_currency || '(para birimi bilinmiyor)'}`
          : UNSTATED,
    },
    {
      label: 'Paket miktarı',
      value: (c) =>
        c.weight_grams ? formatPackageWeight(c.weight_grams) : UNSTATED,
    },
    {
      label: 'Köken',
      value: (c) =>
        [c.origin_country && countryLabel(c.origin_country), c.origin_region].filter(Boolean).join(' · ') ||
        UNSTATED,
    },
    {
      label: 'İşlem',
      value: (c) =>
        c.process !== 'unknown'
          ? (PROCESS_LABELS[c.process] ?? c.process)
          : UNSTATED,
    },
    {
      label: 'Kavrum',
      value: (c) =>
        c.roast_level !== 'unknown'
          ? (ROAST_LABELS[c.roast_level] ?? c.roast_level)
          : UNSTATED,
    },
    {
      label: 'Tadım notları',
      value: (c) => (displayNotes(c.flavor_notes).length ? displayNotes(c.flavor_notes) : displayNotes(c.flavor_notes_normalized)).join(' · ') || UNSTATED,
    },
    {
      label: 'Önerilen demleme',
      value: (c) =>
        c.brew_methods.map((m) => BREW_METHOD_LABELS[m] ?? m).join(' · ') ||
        UNSTATED,
    },
    { label: 'Kafeinsiz', value: (c) => ('decaf_status' in c && c.decaf_status == null ? 'Bilinmiyor' : c.is_decaf ? 'Evet' : 'Hayır') },
    { label: 'Seçilen paketin stoku', value: (c) => ('stock_status' in c && c.stock_status == null ? 'Bilinmiyor' : c.is_available ? 'Stokta' : 'Stokta yok') },
  ];
  return (
    <div className="page-shell section-space">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kısa listen</p>
          <h1 className="mt-3 font-display text-title">
            Aynı masada, yan yana.
          </h1>
        </div>
        <CompareCatalogLink slugs={continuingSlugs} className="text-link">
          Kahve ekle ↗
        </CompareCatalogLink>
      </div>
      <p className="mb-8 max-w-2xl text-base leading-7 text-muted">
        Kavurucuların sunduğu paketleri, fiyatları ve tat profillerini yan yana incele. Fiyatı değerlendirirken paket gramajına da bak.
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
        <div className="mb-6 rounded-lg border border-line bg-tint p-4 text-sm leading-6">
          <p role="status">
            Seçtiğin kahvelerden bazıları artık güncel katalogda bulunmuyor.
            Satış durumu değişmiş olabilir. Listeden çıkarıp
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
          <p className="mb-3 text-sm text-muted">
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
                      <p className="text-xs font-semibold text-accent">
                        {coffee.roasters.name}
                      </p>
                      <h2>
                        <Link
                          href={`/kahve/${coffee.slug}`}
                          className="hover:underline"
                        >
                          {displayCoffeeName(coffee.name_normalized ?? coffee.name)}
                        </Link>
                      </h2>
                      <CompareRemoveLink
                        name={coffee.name}
                        href={compareHref(
                          withoutCoffee(coffee.id),
                        )}
                        remainingSlugs={withoutCoffee(coffee.id)}
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
                        href={`/kahve/${coffee.slug}`}
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
            Fiyatlara kargo dahil değildir. Güncel fiyatı ve stoğu görmek için
            kahve detayından kavurucuya geç.
          </p>
        </>
      ) : (
        !failed && (
          <div className="empty-catalog">
            <h2 className="font-display text-subtitle">
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
