"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MetricChip } from "@/components/ui/metric-chip";

interface LedgerRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  provider: string | null;
  notes: string | null;
  created_at: string;
  related_site_id: string | null;
  profiles: { full_name?: string | null } | null;
  sites: { domain: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  topup: "Top-up",
  unlock_spend: "Unlock spend",
  seller_earning: "Seller earning",
  platform_fee: "Platform fee",
  withdrawal: "Withdrawal reserved",
};

const TYPES = ["all", "topup", "unlock_spend", "seller_earning", "platform_fee", "withdrawal"];

export default function AdminWalletLedgerPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("wallet_ledger")
      .select(
        "id, user_id, type, amount, balance_after, provider, notes, created_at, related_site_id, profiles(full_name), sites(domain)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (userIdFilter.trim()) query = query.eq("user_id", userIdFilter.trim());

    const { data } = await query;
    setRows((data as unknown as LedgerRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  // Simple abuse signal: same buyer+site pair unlocked more than once via
  // wallet within the loaded window (excluding legitimate re-unlocks after
  // expiry — this is a heads-up list, not an automatic block).
  const spendBySiteBuyer = new Map<string, number>();
  rows
    .filter((r) => r.type === "unlock_spend")
    .forEach((r) => {
      const key = `${r.user_id}:${r.related_site_id}`;
      spendBySiteBuyer.set(key, (spendBySiteBuyer.get(key) ?? 0) + 1);
    });
  const repeatedPairs = [...spendBySiteBuyer.entries()].filter(([, count]) => count > 1);

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Wallet ledger</h1>
      <p className="mb-6 text-sm text-muted">
        Every top-up, spend, earning, fee, and withdrawal reservation across all users. Use this to
        spot unusual patterns — e.g. the same buyer unlocking the same site repeatedly.
      </p>

      {repeatedPairs.length > 0 && (
        <div className="mb-6 rounded-chip border border-amber/40 bg-amber-soft p-4 text-sm">
          <p className="mb-1 font-medium">Possible repeat-unlock activity (last 200 entries)</p>
          <p className="text-xs text-muted">
            {repeatedPairs.length} buyer/site pair(s) show multiple unlock charges. This can be
            legitimate (access expired and was renewed), but worth a manual look if it recurs
            between the same owner and buyer.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-chip border border-line px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">User ID</label>
          <input
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="paste a user id"
            className="w-64 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <button
          onClick={load}
          className="rounded-chip border border-line bg-white px-3 py-2 text-sm hover:border-ink"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-chip border border-line bg-white p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{TYPE_LABEL[r.type] ?? r.type}</span>
                  {r.provider && <MetricChip label="Via" value={r.provider} />}
                </div>
                <p className="text-xs text-muted">
                  User {r.profiles?.full_name ?? r.user_id.slice(0, 8)}
                  {r.sites?.domain ? ` · ${r.sites.domain}` : ""}
                </p>
                {r.notes && <p className="text-xs text-muted">{r.notes}</p>}
                <p className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm ${r.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {r.amount >= 0 ? "+" : ""}৳{r.amount}
                </p>
                <p className="text-xs text-muted">Bal ৳{r.balance_after}</p>
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-muted">No entries match this filter.</p>}
        </div>
      )}
    </div>
  );
}
