export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-stone-200 ${className}`} />
  );
}

export function CoffeeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
