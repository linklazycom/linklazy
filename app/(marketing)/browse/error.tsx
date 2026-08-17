"use client";

import { RouteError } from "@/components/ui/route-error";

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="সাইট লিস্ট লোড করা যায়নি"
      description="সাইটগুলো আনতে সমস্যা হচ্ছে। আবার চেষ্টা করুন।"
    />
  );
}
