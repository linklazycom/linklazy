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

export function InquiryChatWindow({ inquiryId, userId }: { inquiryId: string; userId: string }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("inquiry_messages")
        .select("id, sender_id, body, was_filtered, created_at")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
    }
    load();

    const channel = supabase
      .channel(`inquiry-${inquiryId}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inquiry_messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/inquiries/${inquiryId}/messages`, {
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
            Ask a pre-sale question about this site. Personal contact details aren&apos;t
            allowed here — keep coordination on-platform.
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="border-t border-line px-3 pt-2 text-xs text-red-600">{error}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the seller a question…"
          className="flex-1 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <Button type="submit" size="sm" disabled={sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
