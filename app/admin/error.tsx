"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AdminError({
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
      title="অ্যাডমিন প্যানেল লোড করা যায়নি"
      description="ডেটা আনতে সমস্যা হচ্ছে। আবার চেষ্টা করুন, সমস্যা থাকলে ডেভেলপারকে জানান।"
    />
  );
}
