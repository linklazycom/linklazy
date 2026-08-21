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
      title="Couldn't load this article"
      description="We ran into a problem fetching this page. Please try again."
    />
  );
}
