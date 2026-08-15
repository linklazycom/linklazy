"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { MetricChip } from "@/components/ui/metric-chip";
import { DrBadge } from "@/components/sites/dr-badge";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
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
  seller_plan: string | null;
  wallet_balance: number;
  created_at: string;
}

interface SiteRow {
  id: string;
  domain: string;
  niche: string;
  status: string;
  da: number | null;
  dr: number | null;
  dr_verified: number | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  status: string;
  order_type: string;
  price_amount: number | null;
  created_at: string;
  sites: { domain: string } | null;
}

interface DisputeRow {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  created_at: string;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  bkash_number: string;
  created_at: string;
}

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

interface ActivityResponse {
  profile: Profile;
  sites: SiteRow[];
  buyerOrders: OrderRow[];
  sellerOrders: OrderRow[];
  disputes: DisputeRow[];
  walletLedger: LedgerRow[];
  withdrawals: WithdrawalRow[];
  supportTickets: TicketRow[];
}

const STATUS_TONE: Record<string, "default" | "verified" | "price"> = {
  approved: "verified",
  rejected: "price",
  suspended: "price",
  disputed: "price",
  refunded: "price",
  accepted: "verified",
  resolved_buyer: "verified",
  resolved_seller: "verified",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-chip border border-line bg-white p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${id}/activity`);
      const body = await res.json();
      setData(body);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!data || !data.profile) return <p className="text-muted">User not found.</p>;

  const { profile, sites, buyerOrders, sellerOrders, disputes, walletLedger, withdrawals, supportTickets } =
    data;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/users" className="mb-4 inline-block text-sm text-muted underline">
        ← Back to users
      </Link>

      <h1 className="mb-1 font-display text-2xl font-medium">
        {profile.full_name || "(no name)"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {profile.email} · joined {new Date(profile.created_at).toLocaleDateString()}
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Role" value={profile.role} />
        {profile.seller_tier && profile.seller_tier !== "unranked" && (
          <MetricChip label="Tier" value={profile.seller_tier} tone="verified" />
        )}
        <MetricChip label="Buyer plan" value={profile.buyer_plan} />
        {profile.seller_plan && <MetricChip label="Seller plan" value={profile.seller_plan} />}
        <MetricChip label="Wallet" value={profile.wallet_balance} tone="price" />
        {profile.is_suspended && <MetricChip label="Status" value="suspended" tone="price" />}
        {profile.is_banned && <MetricChip label="Status" value="banned" tone="price" />}
        {profile.is_flagged && <MetricChip label="Flagged" value="yes" tone="price" />}
      </div>
      {profile.flag_reason && <p className="mb-2 text-xs text-muted">Flag reason: {profile.flag_reason}</p>}
      {profile.banned_reason && <p className="mb-6 text-xs text-muted">Ban reason: {profile.banned_reason}</p>}

      <Section title={`Listed sites (${sites.length})`}>
        {sites.length ? (
          <div className="space-y-2">
            {sites.map((s) => (
              <Link
                key={s.id}
                href={`/admin/sites/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line p-2 text-sm hover:border-ink"
              >
                <span className="font-medium">{s.domain}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Niche" value={s.niche} />
                  <MetricChip label="Status" value={s.status} tone={STATUS_TONE[s.status] ?? "default"} />
                  <DrBadge selfReportedDr={s.dr} verifiedDr={s.dr_verified} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No sites listed.</p>
        )}
      </Section>

      <Section title={`Orders as buyer (${buyerOrders.length})`}>
        {buyerOrders.length ? (
          <div className="space-y-2">
            {buyerOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line p-2 text-sm hover:border-ink"
              >
                <span>{o.sites?.domain ?? "(site removed)"}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Type" value={o.order_type} />
                  {o.price_amount != null && (
                    <MetricChip label="Price" value={o.price_amount} tone="price" />
                  )}
                  <MetricChip label="Status" value={o.status} tone={STATUS_TONE[o.status] ?? "default"} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No orders placed.</p>
        )}
      </Section>

      <Section title={`Orders as seller (${sellerOrders.length})`}>
        {sellerOrders.length ? (
          <div className="space-y-2">
            {sellerOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line p-2 text-sm hover:border-ink"
              >
                <span>{o.sites?.domain ?? "(site removed)"}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Type" value={o.order_type} />
                  {o.price_amount != null && (
                    <MetricChip label="Price" value={o.price_amount} tone="price" />
                  )}
                  <MetricChip label="Status" value={o.status} tone={STATUS_TONE[o.status] ?? "default"} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No orders received.</p>
        )}
      </Section>

      <Section title={`Disputes raised (${disputes.length})`}>
        {disputes.length ? (
          <div className="space-y-2">
            {disputes.map((d) => (
              <Link
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                className="block rounded-chip border border-line p-2 text-sm hover:border-ink"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <MetricChip label="Status" value={d.status} tone={STATUS_TONE[d.status] ?? "default"} />
                  <span className="text-xs text-muted">
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted">{d.reason}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No disputes raised.</p>
        )}
      </Section>

      <Section title={`Wallet ledger (${walletLedger.length})`}>
        {walletLedger.length ? (
          <div className="space-y-1 text-sm">
            {walletLedger.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-line py-1.5">
                <div>
                  <span className="font-medium">{l.type}</span>
                  {l.notes && <span className="ml-2 text-xs text-muted">{l.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={l.amount < 0 ? "text-red-600" : "text-signal"}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(l.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No wallet activity.</p>
        )}
      </Section>

      <Section title={`Withdrawal requests (${withdrawals.length})`}>
        {withdrawals.length ? (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line p-2 text-sm"
              >
                <span>৳{w.amount} → {w.bkash_number}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Status" value={w.status} tone={STATUS_TONE[w.status] ?? "default"} />
                  <span className="text-xs text-muted">
                    {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No withdrawal requests.</p>
        )}
      </Section>

      <Section title={`Support tickets (${supportTickets.length})`}>
        {supportTickets.length ? (
          <div className="space-y-2">
            {supportTickets.map((t) => (
              <Link
                key={t.id}
                href={`/admin/support/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line p-2 text-sm hover:border-ink"
              >
                <span>{t.subject}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Status" value={t.status} />
                  <span className="text-xs text-muted">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No support tickets.</p>
        )}
      </Section>
    </div>
  );
}
