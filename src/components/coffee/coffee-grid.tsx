import { CoffeeCard } from './coffee-card';
import type { CoffeeWithRoaster } from '@/lib/types/database';

export function CoffeeGrid({ coffees }: { coffees: CoffeeWithRoaster[] }) {
  if (coffees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg className="h-16 w-16 text-[#1f1d1b]/25" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-[#1f1d1b]">Kahve bulunamadı</h3>
        <p className="mt-1 text-sm text-[#5d5853]">
          Filtrelerinizi ya da arama teriminizi değiştirmeyi deneyin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {coffees.map((coffee, index) => (
        <CoffeeCard
          key={coffee.id}
          coffee={coffee}
          imageLoading={index < 8 ? 'eager' : 'lazy'}
        />
      ))}
    </div>
  );
}
