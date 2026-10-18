"use client";

import { RouteError } from "@/components/ui/route-error";

export default function BacklinksError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="Couldn't load your backlinks" description="We ran into a problem fetching your backlinks. Please try again." />;
}
