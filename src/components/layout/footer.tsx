import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">TR CoffeeDB</h3>
            <p className="mt-2 text-sm text-stone-500">
              Türkiye&apos;deki bağımsız kavurucuların güncel nitelikli kahvelerini
              tek yerde karşılaştırın. Satın alma doğrudan kavurucuda tamamlanır.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Keşfet</h3>
            <ul className="mt-2">
              <li>
                <Link href="/coffees" className="inline-flex min-h-11 items-center text-sm text-stone-500 hover:text-stone-700">
                  Tüm Kahveler
                </Link>
              </li>
              <li>
                <Link href="/roasters" className="inline-flex min-h-11 items-center text-sm text-stone-500 hover:text-stone-700">
                  Kavurucular
                </Link>
              </li>
              <li>
                <Link href="/quiz" className="inline-flex min-h-11 items-center text-sm text-stone-500 hover:text-stone-700">
                  Tercihime Göre Bul
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Hakkında</h3>
            <p className="mt-2 text-sm text-stone-500">
              Biz bir mağaza değiliz. TR CoffeeDB, kavurucu siteleri arasında kaybolmadan
              doğru çekirdeği seçmenize yardımcı olan ücretsiz bir karşılaştırma aracıdır.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-stone-200 pt-8 text-center text-xs text-stone-400">
          TR CoffeeDB &middot; Desteklenen kavurucularda veriler düzenli olarak güncellenir
        </div>
      </div>
    </footer>
  );
}
