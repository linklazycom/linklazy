import { Skeleton } from "@/components/ui/skeleton";

/** Covers /blog and /blog/[slug] — article list or article body. */
export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-4 h-8 w-2/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-6 h-4 w-3/4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
