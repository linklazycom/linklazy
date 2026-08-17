import { TableSkeleton } from "@/components/ui/skeleton";

/**
 * Covers every /admin/* route (users, orders, sites, coupons, etc.)
 * unless a specific sub-route adds its own loading.tsx. Most admin
 * pages are table/list based, so a table skeleton fits best here.
 */
export default function AdminLoading() {
  return (
    <div className="p-6">
      <div className="mb-4 h-6 w-40 animate-pulse rounded-chip bg-line/60" />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
