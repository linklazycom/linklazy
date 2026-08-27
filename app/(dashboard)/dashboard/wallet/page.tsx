import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Money } from "@/components/currency/money";
import { WithdrawalForm } from "@/components/dashboard/withdrawal-form";

const TYPE_LABEL: Record<string, string> = {
  topup: "Wallet top-up",
  unlock_spend: "Site unlock",
  seller_earning: "Earning (pay-per-view)",
  platform_fee: "Platform fee",
  withdrawal: "Withdrawal",
};

const WITHDRAWAL_STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  paid: "verified",
  approved: "price",
  pending: "price",
  rejected: "default",
};

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user!.id)
    .single();

  const { data: entries } = await supabase
    .from("wallet_ledger")
    .select("id, type, amount, balance_after, related_site_id, notes, created_at, sites(domain)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Pending pay-per-view earnings (not yet in wallet_balance) for sellers.
  const { data: pendingEarnings } = await supabase
    .from("site_unlocks")
    .select("seller_earning, earning_release_at, sites!inner(owner_id, domain)")
    .eq("sites.owner_id", user!.id)
    .eq("earning_status", "pending")
    .order("earning_release_at", { ascending: true });

  const pendingTotal = (pendingEarnings ?? []).reduce((sum, e) => sum + e.seller_earning, 0);

  // Same "available to withdraw" math as /api/withdrawals: wallet balance
  // plus referral credits, minus whatever's already locked in a pending,
  // approved, or paid withdrawal request.
  const { data: referralCredits } = await supabase
    .from("referral_credits")
    .select("amount")
    .eq("referrer_id", user!.id);
  const totalReferralEarned = (referralCredits ?? []).reduce((sum, c) => sum + c.amount, 0);

  const { data: withdrawalRequests } = await supabase
    .from("withdrawal_requests")
    .select("id, amount, bkash_number, status, admin_note, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const totalLocked = (withdrawalRequests ?? [])
    .filter((r) => r.status === "pending" || r.status === "approved" || r.status === "paid")
    .reduce((sum, r) => sum + r.amount, 0);

  const availableToWithdraw = Math.max(
    0,
    totalReferralEarned + (profile?.wallet_balance ?? 0) - totalLocked
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Wallet</h1>
        <Link href="/dashboard/billing" className="text-sm text-brand-blue underline">
          Top up
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Balance" value={profile?.wallet_balance ?? 0} tone="price" />
        {pendingTotal > 0 && <MetricChip label="Pending earnings" value={pendingTotal} />}
        {totalReferralEarned > 0 && <MetricChip label="Referral credit" value={totalReferralEarned} />}
      </div>

      {pendingEarnings && pendingEarnings.length > 0 && (
        <div className="mb-8 rounded-chip border border-line bg-white p-4">
          <p className="mb-2 text-sm font-medium">Pending pay-per-view earnings</p>
          <p className="mb-3 text-xs text-muted">
            These will move into your balance automatically once the hold period passes.
          </p>
          <div className="space-y-2">
            {pendingEarnings.map((e, i) => {
              const site = e.sites as unknown as { domain: string };
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{site?.domain ?? "—"}</span>
                  <span className="text-muted">
                    <Money amount={e.seller_earning} /> — releases{" "}
                    {e.earning_release_at ? new Date(e.earning_release_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-8 rounded-chip border border-line bg-white p-4">
        <h2 className="mb-1 text-sm font-medium">Withdraw to bKash</h2>
        <p className="mb-3 text-xs text-muted">
          Available to withdraw: ৳{availableToWithdraw.toLocaleString()} (wallet balance
          {totalReferralEarned > 0 ? " + referral credit" : ""}, minus any request already in
          progress). Requests are reviewed manually — you&apos;ll see the status below once submitted.
        </p>
        <WithdrawalForm available={availableToWithdraw} />
      </div>

      {withdrawalRequests && withdrawalRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-display text-lg font-medium">Withdrawal requests</h2>
          <div className="space-y-2">
            {withdrawalRequests.map((r) => (
              <div key={r.id} className="rounded-chip border border-line bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">৳{r.amount.toLocaleString()}</span>
                  <MetricChip
                    label="Status"
                    value={r.status}
                    tone={WITHDRAWAL_STATUS_TONE[r.status] ?? "default"}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  To {r.bkash_number} · {new Date(r.created_at).toLocaleString()}
                </p>
                {r.admin_note && (
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium">Note: </span>
                    {r.admin_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg font-medium">Transaction history</h2>
      <div className="space-y-2">
        {entries?.map((entry) => {
          const site = entry.sites as unknown as { domain: string } | null;
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-chip border border-line bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium">{TYPE_LABEL[entry.type] ?? entry.type}</p>
                {site?.domain && <p className="text-xs text-muted">{site.domain}</p>}
                {entry.notes && <p className="text-xs text-muted">{entry.notes}</p>}
                <p className="text-xs text-muted">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`font-mono text-sm ${entry.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {entry.amount >= 0 ? "+" : ""}
                <Money amount={entry.amount} />
              </span>
            </div>
          );
        })}
        {!entries?.length && <p className="text-muted">No transactions yet.</p>}
      </div>
    </div>
  );
}
