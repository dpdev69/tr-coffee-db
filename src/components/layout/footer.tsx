import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">TR CoffeeDB</h3>
            <p className="mt-2 text-sm text-stone-500">
              Discover and compare specialty coffees from Turkey&apos;s best roasters.
              All purchases go directly to roaster websites.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Explore</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/coffees" className="text-sm text-stone-500 hover:text-stone-700">
                  All Coffees
                </Link>
              </li>
              <li>
                <Link href="/roasters" className="text-sm text-stone-500 hover:text-stone-700">
                  Roasters
                </Link>
              </li>
              <li>
                <Link href="/quiz" className="text-sm text-stone-500 hover:text-stone-700">
                  Coffee Matchmaker
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">About</h3>
            <p className="mt-2 text-sm text-stone-500">
              We are not a store. TR CoffeeDB is a free discovery tool that helps
              you find specialty coffee from independent Turkish roasters.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-stone-200 pt-8 text-center text-xs text-stone-400">
          TR CoffeeDB &middot; Data updated every 48 hours
        </div>
      </div>
    </footer>
  );
}
