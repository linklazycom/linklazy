"use client";

import { RouteError } from "@/components/ui/route-error";

export default function BlogError({
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
      title="আর্টিকেল লোড করা যায়নি"
      description="এই পেজটা আনতে সমস্যা হচ্ছে। আবার চেষ্টা করুন।"
    />
  );
}
