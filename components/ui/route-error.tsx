"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** The error Next.js passes into error.tsx */
  error: Error & { digest?: string };
  /** The reset function Next.js passes into error.tsx */
  reset: () => void;
  /** Optional context-specific heading, e.g. "Couldn't load your dashboard" */
  title?: string;
  /** Optional context-specific body copy */
  description?: string;
}

/**
 * Shared visual for every route-level error.tsx. Keep the actual
 * error.tsx files thin — they just render this with route-specific copy.
 */
export function RouteError({
  error,
  reset,
  title = "কিছু একটা ভুল হয়েছে",
  description = "পেজটা লোড করতে সমস্যা হচ্ছে। আবার চেষ্টা করুন, সমস্যা থাকলে সাপোর্টে জানান।",
}: Props) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" />
      </div>
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
      </div>
      {process.env.NODE_ENV === "development" && (
        <pre className="max-w-full overflow-auto rounded-chip border border-line bg-paper p-3 text-left text-xs text-muted">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={reset}>
          আবার চেষ্টা করুন
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          হোমে ফিরে যান
        </Button>
      </div>
    </div>
  );
}
