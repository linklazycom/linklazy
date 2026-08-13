"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DashboardTicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/dashboard/support/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
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
    <form onSubmit={handleSubmit} className="rounded-chip border border-line bg-white p-4">
      <label htmlFor="reply" className="mb-1 block text-sm text-muted">
        Add a reply
      </label>
      <textarea
        id="reply"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
