"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function RefundChargeButton({ id, amount }: { id: string; amount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm(`Refund ৳${amount} to this user's wallet?`)) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/admin/usage-pricing/refund", "POST", { charge_id: id });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={busy}>
        {busy ? "Refunding…" : "Refund"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
