import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">TR CoffeeDB</h3>
            <p className="mt-2 text-sm text-stone-500">
              Türkiye&apos;nin önde gelen kavurucularındaki nitelikli kahveleri keşfedin ve karşılaştırın.
              Tüm satın almalar doğrudan kavurucuların sitesinde gerçekleşir.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Keşfet</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/coffees" className="text-sm text-stone-500 hover:text-stone-700">
                  Tüm Kahveler
                </Link>
              </li>
              <li>
                <Link href="/roasters" className="text-sm text-stone-500 hover:text-stone-700">
                  Kavurucular
                </Link>
              </li>
              <li>
                <Link href="/quiz" className="text-sm text-stone-500 hover:text-stone-700">
                  Kahve Eşleştirici
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Hakkında</h3>
            <p className="mt-2 text-sm text-stone-500">
              Biz bir mağaza değiliz. TR CoffeeDB, bağımsız Türk kavurucularının nitelikli
              kahvelerini bulmanıza yardımcı olan ücretsiz bir keşif aracıdır.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-stone-200 pt-8 text-center text-xs text-stone-400">
          TR CoffeeDB &middot; Veriler 48 saatte bir güncellenir
        </div>
      </div>
    </footer>
  );
}
