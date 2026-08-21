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
      title="Couldn't load the site listings"
      description="We ran into a problem fetching sites. Please try again."
    />
  );
}
