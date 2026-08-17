import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Covers /dashboard/* — the buyer/seller dashboard. Mirrors the rough
 * shape of app/(dashboard)/dashboard/page.tsx: a metrics row up top,
 * then a table/list below.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
