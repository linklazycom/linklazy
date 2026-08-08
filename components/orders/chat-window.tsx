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
          setMessages((prev) => [...prev, payload.new as Message]);
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
    await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
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
