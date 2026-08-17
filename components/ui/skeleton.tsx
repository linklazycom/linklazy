import { cn } from "@/lib/utils";

/**
 * Base skeleton block. Compose these into shapes that mirror the real
 * content (card, row, chip) so loading states don't jump/shift layout
 * once real data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-chip bg-line/60", className)}
      aria-hidden="true"
    />
  );
}

/** Mirrors the shape of components/sites/site-card.tsx */
export function SiteCardSkeleton() {
  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/** Mirrors a typical dashboard/admin table row. */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-line px-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === 0 ? "w-32" : "w-20")} />
      ))}
    </div>
  );
}

/** A grid of SiteCardSkeletons — drop into any browse/listing loading.tsx. */
export function SiteGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SiteCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A stacked list of table row skeletons — drop into dashboard/admin loading.tsx. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-chip border border-line bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}
