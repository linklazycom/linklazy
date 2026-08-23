"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  was_filtered: boolean;
  created_at: string;
}

export function ChatWindow({ orderId, userId }: { orderId: string; userId: string }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, body, was_filtered, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
    }
    load();

    const channel = supabase
      .channel(`order-${orderId}-messages`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Message couldn't be sent. Please try again.");
      setSending(false);
      return;
    }
    // Render our own message immediately instead of waiting on the
    // Realtime INSERT event (which can lag a beat or, for the sender's
    // own connection, sometimes not arrive at all) — the messages route
    // now returns the inserted row for exactly this. The Realtime
    // handler above dedupes by id, so if the event does still arrive
    // it's a no-op.
    const body = await res.json().catch(() => null);
    if (body?.message) {
      const own = body.message as Message;
      setMessages((prev) => (prev.some((m) => m.id === own.id) ? prev : [...prev, own]));
    }
    setText("");
    setSending(false);
  }

  return (
    <div className="rounded-chip border border-line bg-white">
      <div className="max-h-80 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded-chip px-3 py-2 text-sm ${
              m.sender_id === userId ? "ml-auto bg-ink text-paper" : "bg-paper"
            }`}
          >
            {m.body}
            {m.was_filtered && (
              <p className="mt-1 text-[10px] opacity-70">
                Contact info isn&apos;t allowed in chat and was removed.
              </p>
            )}
          </div>
        ))}
        {!messages.length && (
          <p className="text-sm text-muted">
            No messages yet. Personal contact details aren&apos;t allowed here —
            keep coordination on-platform.
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="border-t border-line px-3 pt-2 text-xs text-red-600">{error}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the other party…"
          className="flex-1 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <Button type="submit" size="sm" disabled={sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
