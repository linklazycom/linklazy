"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function TicketForm({
  contactEmail,
  defaultName,
  defaultEmail,
}: {
  contactEmail: string;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        subject: form.get("subject"),
        message: form.get("message"),
      }),
    });

    if (!res.ok) {
      setError(`Something went wrong — please email us directly at ${contactEmail}.`);
      setSending(false);
      return;
    }

    const { id } = await res.json();
    // The support page requires login (see app/(marketing)/support/page.tsx),
    // so every ticket created here already has a user_id — send them to
    // their dashboard ticket view instead of the guest access_token link.
    router.push(`/dashboard/support/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <Field id="name" name="name" label="Name" defaultValue={defaultName} required />
      <Field id="email" name="email" type="email" label="Email" defaultValue={defaultEmail} required />
      <Field id="subject" name="subject" label="Subject" required />
      <div>
        <label htmlFor="message" className="mb-1 block text-sm text-muted">
          How can we help?
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
        {sending ? "Submitting…" : "Open ticket"}
      </Button>
    </form>
  );
}
