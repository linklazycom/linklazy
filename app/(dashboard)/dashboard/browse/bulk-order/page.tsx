"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface SiteRow {
  id: string;
  domain: string;
  niche: string;
  price_amount: number | null;
}

interface CreatedResult {
  created: { id: string; domain: string }[];
  skipped: { domain: string; reason: string }[];
}

export default function BulkOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!ids.length) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("sites")
        .select("id, domain, niche, price_amount")
        .in("id", ids);
      setSites((data as SiteRow[]) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/orders/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_ids: ids,
        target_url: form.get("target_url"),
        anchor_text: form.get("anchor_text"),
        notes: form.get("notes") || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not place bulk order.");
      return;
    }

    setResult(await res.json());
  }

  const total = sites.reduce((sum, s) => sum + (s.price_amount ?? 0), 0);

  if (loading) return <p className="text-muted">Loading…</p>;

  if (result) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-6 font-display text-2xl font-medium">Bulk order placed</h1>
        {result.created.length > 0 && (
          <div className="mb-4 rounded-chip border border-signal/40 bg-signal-soft p-4">
            <p className="mb-2 text-sm font-medium">
              {result.created.length} order{result.created.length > 1 ? "s" : ""} created
            </p>
            <div className="space-y-1">
              {result.created.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/orders/${c.id}`}
                  className="block text-sm text-brand-blue underline"
                >
                  {c.domain} →
                </Link>
              ))}
            </div>
          </div>
        )}
        {result.skipped.length > 0 && (
          <div className="mb-4 rounded-chip border border-amber/40 bg-amber-soft p-4">
            <p className="mb-2 text-sm font-medium">Skipped</p>
            {result.skipped.map((s, i) => (
              <p key={i} className="text-sm text-muted">
                {s.domain} — {s.reason}
              </p>
            ))}
          </div>
        )}
        <Link href="/dashboard/orders">
          <Button size="sm">View all orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 font-display text-2xl font-medium">Bulk order review</h1>
      <p className="mb-6 text-sm text-muted">
        Same target URL and anchor text will be used for every site below. Bulk orders are
        paid placements only.
      </p>

      <div className="mb-6 space-y-2">
        {sites.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-chip border border-line bg-white p-3 text-sm"
          >
            <div>
              <span className="font-mono font-medium">{s.domain}</span>
              <span className="ml-2 text-muted">{s.niche}</span>
            </div>
            {s.price_amount != null && <MetricChip label="Price" value={s.price_amount} tone="price" />}
          </div>
        ))}
        {!sites.length && (
          <p className="text-sm text-muted">
            No valid sites selected.{" "}
            <Link href="/dashboard/browse" className="underline">
              Go back to browse
            </Link>
            .
          </p>
        )}
      </div>

      {sites.length > 0 && (
        <>
          <p className="mb-4 text-sm font-medium">Estimated total: ৳{total}</p>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-chip border border-line bg-white p-5">
            <div>
              <label htmlFor="target_url" className="mb-1 block text-sm text-muted">
                Target URL
              </label>
              <input
                id="target_url"
                name="target_url"
                type="url"
                required
                placeholder="https://yoursite.com/page"
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="anchor_text" className="mb-1 block text-sm text-muted">
                Anchor text
              </label>
              <input
                id="anchor_text"
                name="anchor_text"
                required
                maxLength={200}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1 block text-sm text-muted">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                maxLength={1000}
                rows={3}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Placing orders…" : `Place ${sites.length} order${sites.length > 1 ? "s" : ""}`}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
