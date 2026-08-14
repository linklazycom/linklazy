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
  const [sending, setSending] = useState(false);

  async function updateStatus(status: "approved" | "rejected" | "paid") {
    setSending(true);
    await fetch(`/api/admin/withdrawals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_note: note || undefined }),
    });
    setSending(false);
    router.refresh();
  }

  if (currentStatus === "paid" || currentStatus === "rejected") {
    return <p className="text-sm text-muted">This request is finalized — no further action needed.</p>;
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
