import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

const TYPE_LABEL: Record<string, string> = {
  topup: "Wallet top-up",
  unlock_spend: "Site unlock",
  seller_earning: "Earning (pay-per-view)",
  platform_fee: "Platform fee",
  withdrawal: "Withdrawal",
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

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Wallet</h1>
        <Link href="/dashboard/billing" className="text-sm text-brand-blue underline">
          Top up
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Balance" value={`৳${profile?.wallet_balance ?? 0}`} tone="price" />
        {pendingTotal > 0 && (
          <MetricChip label="Pending earnings" value={`৳${pendingTotal}`} />
        )}
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
                    ৳{e.seller_earning} — releases{" "}
                    {e.earning_release_at ? new Date(e.earning_release_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              );
            })}
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
                ৳{entry.amount}
              </span>
            </div>
          );
        })}
        {!entries?.length && <p className="text-muted">No transactions yet.</p>}
      </div>
    </div>
  );
}
