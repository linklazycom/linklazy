"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PAYOUT_METHODS, type PayoutMethod } from "@/lib/payout-methods";

const inputClass = "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal";

export function WithdrawalForm({ available }: { available: number }) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethod>("bkash");
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isBank = method === "bank";
  const methodLabel = PAYOUT_METHODS.find((m) => m.id === method)?.label ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        method,
        account_number: accountNumber,
        ...(isBank
          ? { account_name: accountName, bank_name: bankName, bank_branch: bankBranch, routing_number: routingNumber }
          : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Something went wrong.");
      setSending(false);
      return;
    }

    setSuccess(true);
    setAmount("");
    setAccountNumber("");
    setAccountName("");
    setBankName("");
    setBankBranch("");
    setRoutingNumber("");
    setSending(false);
    router.refresh();
  }

  if (available <= 0) {
    return <p className="text-sm text-muted">No available balance to withdraw yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="method" className="mb-1 block text-sm text-muted">
          Payout method
        </label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PayoutMethod)}
          className={inputClass}
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
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
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="account_number" className="mb-1 block text-sm text-muted">
          {isBank ? "Bank account number" : `${methodLabel} number`}
        </label>
        <input
          id="account_number"
          type={isBank ? "text" : "tel"}
          required
          placeholder={isBank ? "Account number" : "01XXXXXXXXX"}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className={inputClass}
        />
      </div>
      {isBank && (
        <>
          <div>
            <label htmlFor="account_name" className="mb-1 block text-sm text-muted">
              Account holder name
            </label>
            <input
              id="account_name"
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bank_name" className="mb-1 block text-sm text-muted">
              Bank name
            </label>
            <input
              id="bank_name"
              type="text"
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bank_branch" className="mb-1 block text-sm text-muted">
                Branch (optional)
              </label>
              <input
                id="bank_branch"
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="routing_number" className="mb-1 block text-sm text-muted">
                Routing no. (optional)
              </label>
              <input
                id="routing_number"
                type="text"
                inputMode="numeric"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-signal">Request submitted — we&apos;ll review it shortly.</p>}
      <Button type="submit" size="sm" disabled={sending}>
        {sending ? "Submitting…" : "Request withdrawal"}
      </Button>
    </form>
  );
}
