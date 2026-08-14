"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";

interface UnlockRow {
  id: string;
  site_id: string;
  buyer_id: string;
  price_paid: number;
  platform_fee: number;
  seller_earning: number;
  earning_status: string;
  earning_release_at: string | null;
  unlocked_at: string;
  sites: { domain: string } | null;
}

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  pending: "price",
  released: "verified",
  reversed: "default",
};

export default function AdminPpvUnlocksPage() {
  const supabase = createClient();
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("site_unlocks")
      .select(
        "id, site_id, buyer_id, price_paid, platform_fee, seller_earning, earning_status, earning_release_at, unlocked_at, sites(domain)"
      )
      .order("unlocked_at", { ascending: false })
      .limit(100);
    setUnlocks((data as unknown as UnlockRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverse(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/site-unlocks/${id}/reverse`, { method: "POST" });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? "Could not reverse this unlock.");
      return;
    }
    load();
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Pay-per-view unlocks</h1>
      <p className="mb-6 text-sm text-muted">
        Seller earnings sit as &quot;pending&quot; until the hold window passes, then a cron job
        releases them automatically. Reverse a pending unlock to refund the buyer and cancel the
        seller&apos;s earning — this only works before it&apos;s released.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {unlocks.map((u) => (
          <div key={u.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{u.sites?.domain ?? u.site_id.slice(0, 8)}</span>
              <MetricChip
                label="Earning"
                value={u.earning_status}
                tone={STATUS_TONE[u.earning_status] ?? "default"}
              />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <MetricChip label="Buyer paid" value={u.price_paid} tone="price" />
              <MetricChip label="Platform fee" value={u.platform_fee} />
              <MetricChip label="Seller gets" value={u.seller_earning} />
              {u.earning_release_at && u.earning_status === "pending" && (
                <MetricChip
                  label="Releases"
                  value={new Date(u.earning_release_at).toLocaleDateString()}
                />
              )}
              <span className="text-xs text-muted">
                Unlocked {new Date(u.unlocked_at).toLocaleDateString()}
              </span>
            </div>
            {u.earning_status === "pending" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === u.id}
                onClick={() => reverse(u.id)}
              >
                {busyId === u.id ? "Reversing…" : "Reverse & refund buyer"}
              </Button>
            )}
          </div>
        ))}
        {!unlocks.length && <p className="text-muted">No pay-per-view unlocks yet.</p>}
      </div>
    </div>
  );
}
