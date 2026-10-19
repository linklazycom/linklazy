"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { creditLine, type StockImage } from "@/lib/providers/images";

/**
 * Stock photo finder (Batch 15). Photos are previewed and LINKED from the provider; nothing is stored here.
 * The user downloads from the provider's page (where the licence applies) and keeps the credit line.
 */
export function ImageSearch({ onUseForAltText }: { onUseForAltText: (description: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<StockImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/content/images?q=${encodeURIComponent(q)}`, "GET");
    setBusy(false);
    if (!res.ok) {
      setImages(null);
      setError(res.error);
      return;
    }
    setImages((res.data?.images as StockImage[] | undefined) ?? []);
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  }

  return (
    <section className="space-y-3 rounded-chip border border-line bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-medium">Stock photos</h2>
        <p className="text-sm text-muted">
          Search free photos. They are linked from the source, not stored on LinkLazy: download from the photo page, follow its licence and keep the credit.
        </p>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input
          aria-label="Search stock photos"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          placeholder="e.g. laptop on a desk"
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || q.trim().length < 2}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {images && images.length === 0 && <p className="text-sm text-muted">No photos found. Try different words.</p>}
      {images && images.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-chip border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- provider CDN preview; not a hosted asset */}
              <img src={img.previewUrl} alt={img.alt || "Stock photo preview"} loading="lazy" referrerPolicy="no-referrer" className="h-40 w-full object-cover" />
              <div className="space-y-2 p-3 text-xs">
                <p className="text-muted">
                  {creditLine(img)} ·{" "}
                  <a href={img.licenseUrl} target="_blank" rel="noreferrer noopener" className="underline">
                    {img.licenseName}
                  </a>
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={img.pageUrl} target="_blank" rel="noreferrer noopener" className="rounded-chip border border-line px-2 py-1 underline">
                    Open &amp; download
                  </a>
                  <button type="button" className="rounded-chip border border-line px-2 py-1" onClick={() => copy(`c-${img.id}`, creditLine(img))}>
                    {copied === `c-${img.id}` ? "Copied" : "Copy credit"}
                  </button>
                  {img.alt && (
                    <button type="button" className="rounded-chip border border-line px-2 py-1" onClick={() => onUseForAltText(img.alt)}>
                      Draft alt text
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
