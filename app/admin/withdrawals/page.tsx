import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, bkash_number, status, requested_at, profiles(full_name)")
    .order("requested_at", { ascending: false });

  const statusTone: Record<string, "default" | "verified" | "price"> = {
    pending: "price",
    approved: "price",
    paid: "verified",
    rejected: "default",
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Withdrawal requests</h1>
      <div className="space-y-3">
        {requests?.map((r) => {
          const name = Array.isArray(r.profiles) ? r.profiles[0]?.full_name : (r.profiles as { full_name: string } | null)?.full_name;
          return (
            <Link
              key={r.id}
              href={`/admin/withdrawals/${r.id}`}
              className="block rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">
                  ৳{r.amount} — {name ?? "User"}
                </span>
                <MetricChip label="Status" value={r.status} tone={statusTone[r.status]} />
              </div>
              <p className="text-xs text-muted">
                bKash: {r.bkash_number} · requested {new Date(r.requested_at).toLocaleString()}
              </p>
            </Link>
          );
        })}
        {!requests?.length && <p className="text-muted">No withdrawal requests yet.</p>}
      </div>
    </div>
  );
}
