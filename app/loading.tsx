import { Skeleton } from "@/components/ui/skeleton";

/**
 * Global fallback — shown for any route segment that doesn't have its
 * own more specific loading.tsx. Keep this minimal since it covers a
 * wide variety of page shapes (marketing pages, forms, etc).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Skeleton className="mb-4 h-8 w-1/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
