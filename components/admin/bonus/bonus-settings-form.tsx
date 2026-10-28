"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { computeBonus } from "@/lib/deposit-bonus";

const field = "mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink";

export function BonusSettingsForm(props: { enabled: boolean; minAmount: number; percent: number; maxBonus: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(props.enabled);
  const [minAmount, setMinAmount] = useState(String(props.minAmount));
  const [percent, setPercent] = useState(String(props.percent));
  const [maxBonus, setMaxBonus] = useState(String(props.maxBonus));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const sample = computeBonus(1000, { enabled: true, minAmount: Number(minAmount), percent: Number(percent), maxBonus: Number(maxBonus) });

  async function save() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/deposit-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, minAmount: Number(minAmount), percent: Number(percent), maxBonus: Number(maxBonus) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? "Saved. New top-ups use these terms within about 20 seconds." : typeof body.error === "string" ? body.error : "Could not save.");
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3 rounded-chip border border-line bg-white p-5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Deposit bonus ON
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-muted">
          Minimum top-up (৳)
          <input type="number" min={50} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-muted">
          Bonus (%)
          <input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-muted">
          Maximum bonus per top-up (৳)
          <input type="number" min={1} value={maxBonus} onChange={(e) => setMaxBonus(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-xs text-muted">Example: a ৳1,000 top-up would get ৳{sample.toLocaleString()} bonus.</p>
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
