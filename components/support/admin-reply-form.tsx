"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(close: boolean) {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, close }),
    });
    if (!res.ok) {
      setError("Couldn't send reply — try again.");
      setSending(false);
      return;
    }
    setMessage("");
    setSending(false);
    router.refresh();
  }

  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <label htmlFor="admin-reply" className="mb-1 block text-sm text-muted">
        Reply to this ticket
      </label>
      <textarea
        id="admin-reply"
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" disabled={sending} onClick={() => send(false)}>
          {sending ? "Sending…" : "Send reply"}
        </Button>
        <Button type="button" variant="secondary" disabled={sending} onClick={() => send(true)}>
          Send & close ticket
        </Button>
      </div>
    </div>
  );
}
