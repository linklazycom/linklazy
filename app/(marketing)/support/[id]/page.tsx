"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

type Message = {
  id: string;
  sender_type: "user" | "admin";
  sender_name: string;
  body: string;
  created_at: string;
};

type Ticket = {
  id: string;
  name: string;
  subject: string;
  status: "open" | "replied" | "closed";
  created_at: string;
};

function TicketThread() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/support/${id}?token=${token}`);
    if (!res.ok) {
      setError("This ticket link is invalid or has expired.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTicket(data.ticket);
    setMessages(data.messages);
    setLoading(false);
  }

  useEffect(() => {
    if (id && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/support/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, message: reply }),
    });
    if (res.ok) {
      setReply("");
      await load();
    }
    setSending(false);
  }

  if (loading) return <main className="mx-auto max-w-2xl px-6 py-16 text-sm text-muted">Loading…</main>;

  if (error || !ticket) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-red-600">{error ?? "Ticket not found."}</p>
      </main>
    );
  }

  const statusTone = ticket.status === "closed" ? "verified" : ticket.status === "open" ? "price" : undefined;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">{ticket.subject}</h1>
        <MetricChip label="Status" value={ticket.status} tone={statusTone} />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-chip border p-4 ${
              m.sender_type === "admin"
                ? "border-brand-violet/30 bg-brand-soft"
                : "border-line bg-white"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span className="font-medium text-ink">
                {m.sender_type === "admin" ? "LinkLazy Support" : m.sender_name}
              </span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status === "closed" && (
        <p className="mb-3 text-xs text-muted">
          This ticket is closed. Sending a reply will automatically reopen it.
        </p>
      )}
      <form onSubmit={handleReply} className="rounded-chip border border-line bg-white p-4">
        <label htmlFor="reply" className="mb-1 block text-sm text-muted">
          Add a reply
        </label>
        <textarea
          id="reply"
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send reply"}
        </Button>
      </form>
    </main>
  );
}

// FIX: useSearchParams() must be wrapped in <Suspense> in Next.js App
// Router — same issue as /register. Logic moved into TicketThread above.
export default function TicketThreadPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-6 py-16 text-sm text-muted">Loading…</main>}>
      <TicketThread />
    </Suspense>
  );
}
