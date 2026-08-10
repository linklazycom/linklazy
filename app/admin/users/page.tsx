"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface UserRow {
  id: string;
  full_name: string | null;
  role: string;
  is_suspended: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  seller_tier: string | null;
}

interface FraudSignal {
  user_id: string;
  dispute_count: number;
  rejected_site_count: number;
  total_sites: number;
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [signals, setSignals] = useState<Map<string, FraudSignal>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  async function load() {
    const { data: userData } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_suspended, is_flagged, flag_reason, seller_tier")
      .order("full_name", { ascending: true });
    setUsers((userData as UserRow[]) ?? []);

    const { data: signalData } = await supabase.from("fraud_signals").select("*");
    setSignals(new Map((signalData ?? []).map((s: FraudSignal) => [s.user_id, s])));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleSuspend(u: UserRow) {
    setBusyId(u.id);
    await fetch(`/api/admin/users/${u.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !u.is_suspended }),
    });
    setBusyId(null);
    load();
  }

  async function toggleFlag(u: UserRow) {
    setBusyId(u.id);
    const reason = u.is_flagged ? undefined : window.prompt("Reason for flagging (optional)") ?? undefined;
    await fetch(`/api/admin/users/${u.id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !u.is_flagged, reason }),
    });
    setBusyId(null);
    load();
  }

  const visibleUsers = showOnlyFlagged
    ? users.filter((u) => u.is_flagged || signals.has(u.id))
    : users;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Users</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOnlyFlagged}
            onChange={(e) => setShowOnlyFlagged(e.target.checked)}
          />
          Show only flagged / fraud-signal accounts
        </label>
      </div>

      <div className="space-y-3">
        {visibleUsers.map((u) => {
          const signal = signals.get(u.id);
          return (
            <div key={u.id} className="rounded-chip border border-line bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{u.full_name || "(no name)"}</span>
                <div className="flex gap-2">
                  <MetricChip label="Role" value={u.role} />
                  {u.seller_tier && u.seller_tier !== "unranked" && (
                    <MetricChip label="Tier" value={u.seller_tier} tone="verified" />
                  )}
                  {u.is_suspended && <MetricChip label="Status" value="suspended" />}
                  {u.is_flagged && <MetricChip label="Flagged" value="yes" tone="price" />}
                </div>
              </div>

              {signal && !u.is_flagged && (
                <p className="mb-2 text-xs text-amber">
                  ⚠ Fraud signal: {signal.dispute_count} dispute(s), {signal.rejected_site_count}/
                  {signal.total_sites} listings rejected
                </p>
              )}
              {u.flag_reason && <p className="mb-2 text-xs text-muted">Flag reason: {u.flag_reason}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleSuspend(u)}
                  disabled={busyId === u.id}
                >
                  {u.is_suspended ? "Unsuspend" : "Suspend"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFlag(u)} disabled={busyId === u.id}>
                  {u.is_flagged ? "Remove flag" : "Flag for review"}
                </Button>
              </div>
            </div>
          );
        })}
        {!visibleUsers.length && <p className="text-muted">No users match this view.</p>}
      </div>
    </div>
  );
}
