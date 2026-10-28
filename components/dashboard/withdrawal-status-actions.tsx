"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function WithdrawalStatusActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateStatus(status: "approved" | "rejected" | "paid") {
    setSending(true);
    setMessage(null);
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        admin_note: note || undefined,
        ...(status === "paid" ? { transaction_id: transactionId, proof_url: proofUrl || undefined } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Could not update this request.");
    } else if (typeof body.warning === "string") {
      setMessage(body.warning);
    } else if (body.emailSent === false) {
      setMessage("Saved. The email to the user could not be sent (check Resend), so tell them yourself.");
    }
    router.refresh();
  }

  if (currentStatus === "paid" || currentStatus === "rejected") {
    return (
      <div className="space-y-2 text-sm">
        {message && <p className="text-red-600">{message}</p>}
        <p className="text-muted">This request is finalized — no further action needed.</p>
      </div>
    );
  }

  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <label htmlFor="note" className="mb-1 block text-sm text-muted">
        Note (optional)
      </label>
      <textarea
        id="note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
      />
      {currentStatus === "approved" && (
        <div className="mb-3 space-y-3">
          <div>
            <label htmlFor="transaction_id" className="mb-1 block text-sm text-muted">
              Payout transaction ID (required to mark as paid)
            </label>
            <input
              id="transaction_id"
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label htmlFor="proof_url" className="mb-1 block text-sm text-muted">
              Proof link, https:// (optional, e.g. a screenshot link)
            </label>
            <input
              id="proof_url"
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
        </div>
      )}
      {message && <p className="mb-3 text-sm text-red-600">{message}</p>}
      <div className="flex flex-wrap gap-3">
        {currentStatus === "pending" && (
          <>
            <Button type="button" size="sm" disabled={sending} onClick={() => updateStatus("approved")}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={sending} onClick={() => updateStatus("rejected")}>
              Reject
            </Button>
          </>
        )}
        {currentStatus === "approved" && (
          <Button type="button" size="sm" disabled={sending} onClick={() => updateStatus("paid")}>
            Mark as paid
          </Button>
        )}
      </div>
    </div>
  );
}
