import axios from 'axios';
import { BaseScraper } from '../base-scraper.js';
import type { RawProduct } from '../types.js';
import { normalizeRoasterImageUrl } from '../url-policy.js';
import { comparePackageWeightPreference, parsePackageWeight } from './package-selection.js';

interface ParsaCoffee {
  kod: string;
  ad: string;
  aktif: boolean;
  taban_fiyat_tl: string | number;
  indirim_orani?: string | number;
  resim_url_on?: string | null;
  koken_tr?: string | null;
  origin?: string | null;
  islem_tr?: string | null;
  cultivar?: string | null;
  rakim?: string | null;
  uretici?: string | null;
  kavrum_tipi_tr?: string | null;
  tadim_notlari_tr?: string | null;
  varyasyonlar?: Array<{
    gramaj: string;
    ek_fiyat_tl: string | number;
    stok: number;
    aktif: boolean;
  }>;
}

// Parsa replaced WooCommerce with this public storefront API in July 2026.
// Read package details so a default catalog price is never paired with another
// variant's weight or stock.
export class ParsaAdapter extends BaseScraper {
  async fetchProducts(): Promise<RawProduct[]> {
    const endpoint = new URL('/api/katalog/kahveler', this.config.websiteUrl).toString();
    const { data: catalog } = await axios.get<ParsaCoffee[]>(endpoint, { timeout: 30_000 });
    if (!Array.isArray(catalog)) throw new Error('Parsa catalog API returned a non-product response.');

    const products: RawProduct[] = [];
    for (const listed of catalog) {
      if (!listed.aktif) continue;
      if (typeof listed.kod !== 'string' || !listed.kod.trim() || !listed.ad?.trim()) {
        throw new Error('Parsa catalog entry is missing its product code or name.');
      }

      const { data: coffee } = await axios.get<ParsaCoffee>(
        `${endpoint}/${encodeURIComponent(listed.kod)}`,
        { timeout: 30_000 }
      );
      if (coffee.kod !== listed.kod || !Array.isArray(coffee.varyasyonlar)) {
        throw new Error(`Parsa product ${listed.kod} returned invalid package details.`);
      }

      const packages = coffee.varyasyonlar
        .filter((variant) => variant.aktif)
        .map((variant) => ({
          ...variant,
          weightGrams: parsePackageWeight(variant.gramaj),
          price: finiteNumber(coffee.taban_fiyat_tl) + finiteNumber(variant.ek_fiyat_tl),
        }))
        .filter((variant) => variant.weightGrams !== null && variant.price > 0)
        .sort((left, right) => {
          if ((left.stok > 0) !== (right.stok > 0)) return left.stok > 0 ? -1 : 1;
          return comparePackageWeightPreference(left.weightGrams, left.gramaj, right.weightGrams, right.gramaj);
        });
      const selected = packages[0];
      if (!selected) throw new Error(`Parsa product ${listed.kod} has no valid retail package.`);

      const discount = finiteNumber(coffee.indirim_orani ?? 0);
      if (discount < 0 || discount >= 100) throw new Error(`Parsa product ${listed.kod} has an invalid discount.`);
      const attributes = [
        ['Menşei', coffee.koken_tr],
        ['Bölge', coffee.origin],
        ['İşleme', coffee.islem_tr],
        ['Varyete', coffee.cultivar],
        ['Rakım', coffee.rakim],
        ['Üretici', coffee.uretici],
        ['Demleme', coffee.kavrum_tipi_tr],
        ['Tadım notları', coffee.tadim_notlari_tr],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]));

      products.push({
        externalId: `catalog-${coffee.kod}`,
        name: coffee.ad.trim(),
        description: attributes.map(([name, value]) => `${name}: ${value}`).join('\n'),
        price: Math.round(selected.price * (1 - discount / 100) * 100) / 100,
        currency: 'TRY',
        weightGrams: selected.weightGrams,
        imageUrl: normalizeRoasterImageUrl(coffee.resim_url_on, this.config),
        productUrl: new URL(`/tr/kahve/${encodeURIComponent(coffee.kod)}`, this.config.websiteUrl).toString(),
        isAvailable: coffee.aktif && selected.stok > 0,
        tags: coffee.tadim_notlari_tr?.split(',').map((note) => note.trim()).filter(Boolean) ?? [],
        rawData: {
          attributes: attributes.map(([name, value]) => ({ name, terms: [{ name: value }] })),
          packageSelection: { label: selected.gramaj, price: selected.price },
        },
      });
    }
    return products;
  }
}

function finiteNumber(value: string | number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Parsa product contains an invalid price.');
  return number;
}
