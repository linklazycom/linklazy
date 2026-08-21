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
      title="Couldn't load your dashboard"
      description="We ran into a problem fetching your data. Please try again."
    />
  );
}
