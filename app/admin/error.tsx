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
      title="Couldn't load the admin panel"
      description="We ran into a problem fetching this data. Please try again, or contact the developer if the issue continues."
    />
  );
}
