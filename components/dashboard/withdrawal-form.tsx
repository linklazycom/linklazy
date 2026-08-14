"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function WithdrawalForm({ available }: { available: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bkashNumber, setBkashNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), bkash_number: bkashNumber }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Something went wrong.");
      setSending(false);
      return;
    }

    setSuccess(true);
    setAmount("");
    setBkashNumber("");
    setSending(false);
    router.refresh();
  }

  if (available <= 0) {
    return <p className="text-sm text-muted">No available balance to withdraw yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="amount" className="mb-1 block text-sm text-muted">
          Amount (৳, max {available})
        </label>
        <input
          id="amount"
          type="number"
          min={1}
          max={available}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div>
        <label htmlFor="bkash_number" className="mb-1 block text-sm text-muted">
          bKash number
        </label>
        <input
          id="bkash_number"
          type="tel"
          required
          placeholder="01XXXXXXXXX"
          value={bkashNumber}
          onChange={(e) => setBkashNumber(e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-signal">Request submitted — we'll review it shortly.</p>}
      <Button type="submit" size="sm" disabled={sending}>
        {sending ? "Submitting…" : "Request withdrawal"}
      </Button>
    </form>
  );
}
