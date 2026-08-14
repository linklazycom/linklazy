import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { WithdrawalStatusActions } from "@/components/dashboard/withdrawal-status-actions";

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, bkash_number, status, admin_note, requested_at, processed_at, profiles(full_name)")
    .eq("id", id)
    .single();

  if (!req) notFound();

  const name = Array.isArray(req.profiles) ? req.profiles[0]?.full_name : (req.profiles as { full_name: string } | null)?.full_name;
  const statusTone: Record<string, "default" | "verified" | "price"> = {
    pending: "price",
    approved: "price",
    paid: "verified",
    rejected: "default",
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Withdrawal request</h1>
        <MetricChip label="Status" value={req.status} tone={statusTone[req.status]} />
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-5">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">User</dt>
            <dd>{name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Amount</dt>
            <dd className="font-medium">৳{req.amount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">bKash number</dt>
            <dd>{req.bkash_number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Requested</dt>
            <dd>{new Date(req.requested_at).toLocaleString()}</dd>
          </div>
          {req.processed_at && (
            <div className="flex justify-between">
              <dt className="text-muted">Processed</dt>
              <dd>{new Date(req.processed_at).toLocaleString()}</dd>
            </div>
          )}
          {req.admin_note && (
            <div>
              <dt className="mb-1 text-muted">Admin note</dt>
              <dd>{req.admin_note}</dd>
            </div>
          )}
        </dl>
      </div>

      {req.status === "pending" && (
        <div className="mb-6 rounded-chip border border-brand-violet/30 bg-brand-soft p-4 text-sm">
          <p className="mb-1 font-medium">Manual step required</p>
          <p className="text-muted">
            Approve this first, then send ৳{req.amount} via bKash Send Money
            to {req.bkash_number} yourself — this platform doesn't send
            payouts automatically. Once sent, mark it Paid below.
          </p>
        </div>
      )}

      <WithdrawalStatusActions id={req.id} currentStatus={req.status} />
    </div>
  );
}
