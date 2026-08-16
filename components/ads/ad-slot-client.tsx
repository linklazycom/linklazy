"use client";

import { useEffect, useState } from "react";
import { AdHtmlRenderer } from "@/components/ads/ad-html-renderer";

interface AdSlotData {
  id: string;
  kind: "image_link" | "html";
  image_url: string | null;
  link_url: string | null;
  html_code: string | null;
  alt_text: string | null;
}

/**
 * Same rendering rules as the server AdSlot component, but data comes
 * from /api/ads instead of a direct Supabase call — needed inside pages
 * that are "use client" (can't bundle next/headers-based server code).
 */
export function AdSlotClient({ placement }: { placement: string }) {
  const [slot, setSlot] = useState<AdSlotData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads?placement=${encodeURIComponent(placement)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setSlot(body.slot ?? null);
      })
      .catch(() => {
        if (!cancelled) setSlot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!slot) return null;

  if (slot.kind === "html" && slot.html_code) {
    return (
      <div className="ad-slot my-4" data-placement={placement}>
        <AdHtmlRenderer html={slot.html_code} />
      </div>
    );
  }

  if (slot.kind === "image_link" && slot.image_url) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element -- ad creative is arbitrary admin-supplied content, not an optimizable local asset
      <img src={slot.image_url} alt={slot.alt_text ?? "Advertisement"} className="mx-auto max-w-full rounded-chip" />
    );
    return (
      <div className="ad-slot my-4 text-center" data-placement={placement}>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Sponsored</p>
        {slot.link_url ? (
          <a href={slot.link_url} target="_blank" rel="noopener noreferrer nofollow sponsored">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    );
  }

  return null;
}
