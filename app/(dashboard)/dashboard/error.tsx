"use client";

import { RouteError } from "@/components/ui/route-error";

export default function DashboardError({
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
      title="ড্যাশবোর্ড লোড করা যায়নি"
      description="আপনার ডেটা আনতে সমস্যা হচ্ছে। আবার চেষ্টা করুন।"
    />
  );
}
