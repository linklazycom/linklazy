import { Skeleton, SiteGridSkeleton } from "@/components/ui/skeleton";

/**
 * Covers /browse — the public site marketplace listing. Uses
 * SiteGridSkeleton so the skeleton cards match the real SiteCard grid
 * and there's no layout jump when real data arrives.
 */
export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <SiteGridSkeleton count={9} />
    </div>
  );
}
