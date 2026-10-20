"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function PushSwitch({ enabled, ready }: { enabled: boolean; ready: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    if (!enabled && !window.confirm("Turn sending ON? Active campaigns can then hand contacts to Saleshandy when you press Send now on the Campaigns page.")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/admin/outreach/switch", "POST", { enabled: !enabled });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <section className={`space-y-2 rounded-chip border p-5 ${enabled ? "border-green-300 bg-green-50" : "border-line bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-medium">Sending is {enabled ? "ON" : "OFF"}</h2>
          <p className="text-sm text-muted">
            {enabled ? "Press Send now on a campaign to hand its daily batch to Saleshandy. Turn this off to stop everything at once." : "Nothing is handed to Saleshandy while this is off, even for active campaigns."}
          </p>
        </div>
        <Button type="button" variant={enabled ? "secondary" : "primary"} disabled={busy || (!enabled && !ready)} onClick={toggle}>
          {busy ? "…" : enabled ? "Turn OFF" : "Turn ON"}
        </Button>
      </div>
      {!enabled && !ready && <p className="text-xs text-muted">Finish the checklist above first (sender address, Saleshandy key and field ids).</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
