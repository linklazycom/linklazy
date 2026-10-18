import { Skeleton } from "@/components/ui/skeleton";

export default function BacklinksLoading() {
  return (
    <div className="max-w-4xl space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
