"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_suspended: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  is_banned: boolean;
  banned_reason: string | null;
  seller_tier: string | null;
  buyer_plan: string;
  buyer_views_quota: number;
  buyer_views_used: number;
  buyer_plan_renews_at: string | null;
  seller_plan: string | null;
  wallet_balance: number;
}

interface FraudSignal {
  user_id: string;
  dispute_count: number;
  rejected_site_count: number;
  total_sites: number;
}

const BUYER_PLANS = ["free", "starter", "growth", "pro"];
const SELLER_PLANS = ["commission", "monthly"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [signals, setSignals] = useState<Map<string, FraudSignal>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState<{ buyer_plan: string; seller_plan: string }>({
    buyer_plan: "free",
    seller_plan: "commission",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    setUsers(body.users ?? []);

    // fraud_signals is a low-traffic RLS-open table for admins — kept as a
    // direct client read like before, no need to route it through the API.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: signalData } = await supabase.from("fraud_signals").select("*");
    setSignals(new Map((signalData ?? []).map((s: FraudSignal) => [s.user_id, s])));
    setLoading(false);
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

  async function toggleBan(u: UserRow) {
    if (!u.is_banned && !confirm(`Ban ${u.full_name || u.email}? They'll be logged out and locked out of login entirely.`)) {
      return;
    }
    setBusyId(u.id);
    const reason = u.is_banned ? undefined : window.prompt("Reason for ban (optional)") ?? undefined;
    const res = await fetch(`/api/admin/users/${u.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !u.is_banned, reason }),
    });
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "Could not update ban status.");
      return;
    }
    load();
  }

  async function deleteUser(u: UserRow) {
    const confirmText = window.prompt(
      `Type DELETE to permanently remove ${u.full_name || u.email}. This cannot be undone.`
    );
    if (confirmText !== "DELETE") return;

    setBusyId(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "Could not delete user.");
      return;
    }
    load();
  }

  function openSubscriptionPanel(u: UserRow) {
    setExpandedSub(expandedSub === u.id ? null : u.id);
    setSubDraft({ buyer_plan: u.buyer_plan, seller_plan: u.seller_plan ?? "commission" });
  }

  async function saveSubscription(u: UserRow) {
    setBusyId(u.id);
    const res = await fetch(`/api/admin/users/${u.id}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_plan: subDraft.buyer_plan,
        seller_plan: subDraft.seller_plan,
      }),
    });
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "Could not update subscription.");
      return;
    }
    setExpandedSub(null);
    load();
  }

  const visibleUsers = users
    .filter((u) => (showOnlyFlagged ? u.is_flagged || signals.has(u.id) : true))
    .filter((u) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium">Users</h1>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyFlagged}
              onChange={(e) => setShowOnlyFlagged(e.target.checked)}
            />
            Flagged only
          </label>
          <Link href="/admin/users/new">
            <Button size="sm">Create user</Button>
          </Link>
        </div>
      </div>

      {message && (
        <p className="mb-4 rounded-chip border border-line bg-white px-3 py-2 text-sm">{message}</p>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-3">
          {visibleUsers.map((u) => {
            const signal = signals.get(u.id);
            return (
              <div key={u.id} className="rounded-chip border border-line bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{u.full_name || "(no name)"}</span>
                    {u.email && <span className="ml-2 text-sm text-muted">{u.email}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MetricChip label="Role" value={u.role} />
                    {u.seller_tier && u.seller_tier !== "unranked" && (
                      <MetricChip label="Tier" value={u.seller_tier} tone="verified" />
                    )}
                    <MetricChip label="Buyer plan" value={u.buyer_plan} />
                    {u.seller_plan && <MetricChip label="Seller plan" value={u.seller_plan} />}
                    {u.is_suspended && <MetricChip label="Status" value="suspended" />}
                    {u.is_banned && <MetricChip label="Status" value="banned" tone="price" />}
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
                {u.banned_reason && <p className="mb-2 text-xs text-muted">Ban reason: {u.banned_reason}</p>}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleSuspend(u)}
                    disabled={busyId === u.id}
                  >
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleBan(u)}
                    disabled={busyId === u.id}
                  >
                    {u.is_banned ? "Unban" : "Ban"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleFlag(u)} disabled={busyId === u.id}>
                    {u.is_flagged ? "Remove flag" : "Flag for review"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openSubscriptionPanel(u)}
                    disabled={busyId === u.id}
                  >
                    {expandedSub === u.id ? "Close" : "Manage subscription"}
                  </Button>
                  <button
                    onClick={() => deleteUser(u)}
                    disabled={busyId === u.id}
                    className="rounded-chip border border-line px-3 py-1.5 text-sm text-red-600 hover:border-red-300"
                  >
                    Delete
                  </button>
                </div>

                {expandedSub === u.id && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted">Buyer plan</label>
                      <select
                        value={subDraft.buyer_plan}
                        onChange={(e) => setSubDraft((prev) => ({ ...prev, buyer_plan: e.target.value }))}
                        className="rounded-chip border border-line px-2 py-1.5 text-sm"
                      >
                        {BUYER_PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Seller plan</label>
                      <select
                        value={subDraft.seller_plan}
                        onChange={(e) => setSubDraft((prev) => ({ ...prev, seller_plan: e.target.value }))}
                        className="rounded-chip border border-line px-2 py-1.5 text-sm"
                      >
                        {SELLER_PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-muted">
                      Views used: {u.buyer_views_used}/{u.buyer_views_quota} · Wallet ৳{u.wallet_balance}
                      {u.buyer_plan_renews_at &&
                        ` · renews ${new Date(u.buyer_plan_renews_at).toLocaleDateString()}`}
                    </p>
                    <Button size="sm" onClick={() => saveSubscription(u)} disabled={busyId === u.id}>
                      {busyId === u.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {!visibleUsers.length && <p className="text-muted">No users match this view.</p>}
        </div>
      )}
    </div>
  );
}
