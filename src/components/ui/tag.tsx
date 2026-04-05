const CATEGORY_COLORS: Record<string, string> = {
  Fruity: 'bg-red-50 text-red-700 border-red-200',
  Floral: 'bg-purple-50 text-purple-700 border-purple-200',
  Chocolate: 'bg-amber-50 text-amber-800 border-amber-200',
  Sweet: 'bg-orange-50 text-orange-700 border-orange-200',
  Nutty: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  Spicy: 'bg-rose-50 text-rose-700 border-rose-200',
  Roasted: 'bg-stone-100 text-stone-700 border-stone-300',
  Herbal: 'bg-green-50 text-green-700 border-green-200',
};

export function Tag({
  children,
  category,
  size = 'sm',
}: {
  children: React.ReactNode;
  category?: string;
  size?: 'xs' | 'sm';
}) {
  const colors = category
    ? CATEGORY_COLORS[category] ?? 'bg-stone-100 text-stone-600 border-stone-200'
    : 'bg-stone-100 text-stone-600 border-stone-200';

  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-block rounded-full border font-medium ${colors} ${sizeClasses}`}>
      {children}
    </span>
  );
}
