"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BonusRowActions({ id, status, remaining }: { id: string; status: string; remaining: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "clawback" | "retry") {
    if (action === "clawback" && !window.confirm(`Take back the unspent bonus (৳${remaining})? Only do this after the deposit was refunded at the payment provider.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/deposit-bonus/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(typeof body.error === "string" ? body.error : "Failed.");
    router.refresh();
  }

  if (status === "granted")
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("clawback")}>
          Claw back
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("retry")}>
          Retry credit
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  return null;
}
