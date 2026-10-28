import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { payoutAccount, payoutLabel } from "@/lib/payout-methods";
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
    .select(
      "id, user_id, amount, bkash_number, method, account_number, account_name, bank_name, bank_branch, routing_number, transaction_id, proof_url, status, admin_note, requested_at, processed_at, profiles(full_name)"
    )
    .eq("id", id)
    .single();

  if (!req) notFound();

  const name = Array.isArray(req.profiles) ? req.profiles[0]?.full_name : (req.profiles as { full_name: string } | null)?.full_name;
  const isBank = req.method === "bank";
  const methodLabel = payoutLabel(req.method);
  const account = payoutAccount(req);

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
            <dt className="text-muted">Method</dt>
            <dd>{methodLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{isBank ? "Account number" : `${methodLabel} number`}</dt>
            <dd className="font-mono">{account}</dd>
          </div>
          {isBank && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">Account holder</dt>
                <dd>{req.account_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Bank</dt>
                <dd>{req.bank_name ?? "—"}</dd>
              </div>
              {req.bank_branch && (
                <div className="flex justify-between">
                  <dt className="text-muted">Branch</dt>
                  <dd>{req.bank_branch}</dd>
                </div>
              )}
              {req.routing_number && (
                <div className="flex justify-between">
                  <dt className="text-muted">Routing no.</dt>
                  <dd className="font-mono">{req.routing_number}</dd>
                </div>
              )}
            </>
          )}
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
          {req.transaction_id && (
            <div className="flex justify-between">
              <dt className="text-muted">Payout transaction ID</dt>
              <dd className="font-mono">{req.transaction_id}</dd>
            </div>
          )}
          {req.proof_url && (
            <div className="flex justify-between">
              <dt className="text-muted">Proof</dt>
              <dd>
                <a href={req.proof_url} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">
                  Open link
                </a>
              </dd>
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
            Approve this first, then send ৳{req.amount} yourself via {methodLabel}
            {isBank ? " bank transfer" : " Send Money"} to {account} — this platform doesn&apos;t
            send payouts automatically. Once sent, enter the transaction ID and mark it Paid below.
          </p>
        </div>
      )}

      <WithdrawalStatusActions id={req.id} currentStatus={req.status} />
    </div>
  );
}
