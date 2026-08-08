"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
      }),
    });

    if (!res.ok) {
      setError(`Something went wrong — please email us directly at ${contactEmail}.`);
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
  }

  if (sent) {
    return (
      <div className="rounded-chip border border-signal/30 bg-signal-soft p-6 text-sm">
        Thanks — we&apos;ve received your message and will get back to you soon.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <Field id="name" name="name" label="Name" required />
      <Field id="email" name="email" type="email" label="Email" required />
      <div>
        <label htmlFor="message" className="mb-1 block text-sm text-muted">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
