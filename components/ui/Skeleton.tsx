export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-neutral-200 rounded-lg ${className ?? ""}`} />
  );
}

export function TruckCardSkeleton() {
  return (
    <div className="bg-white border-b border-neutral-100 md:border md:rounded-2xl md:shadow-sm md:overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Photo */}
        <Skeleton className="w-[88px] h-[88px] rounded-2xl flex-shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0 py-0.5 space-y-2">
          {/* Name row */}
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-6 w-14 rounded-lg flex-shrink-0" />
          </div>
          {/* Cuisine */}
          <Skeleton className="h-3 w-24 rounded" />
          {/* Description */}
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MenuItemSkeleton() {
  return (
    <div className="flex gap-3 p-4 border-b border-neutral-50 last:border-0">
      {/* Photo */}
      <Skeleton className="w-[72px] h-[72px] rounded-xl flex-shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}
