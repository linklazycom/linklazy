"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest, type ApiResult } from "@/components/links/api";

export function CampaignActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<ApiResult>, onOk?: (d: Record<string, unknown> | null) => void) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    onOk?.(res.data);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("pause", () => apiRequest(`/api/admin/outreach/campaigns/${id}`, "PATCH", { status: "paused" }))}>Pause</Button>
        ) : (
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => window.confirm("Activate this campaign? Its contacts are handed to Saleshandy only when you press Send now (once a day, within the daily limit).") && void run("activate", () => apiRequest(`/api/admin/outreach/campaigns/${id}`, "PATCH", { status: "active" }))}>Activate</Button>
        )}
        {status === "active" && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              window.confirm("Hand today's batch to Saleshandy now? It counts toward today's daily limit; pressing it again the same day only sends what is left of the limit.") &&
              void run("push", () => apiRequest(`/api/admin/outreach/campaigns/${id}/push`, "POST"), (d) => {
                const r = d?.result as { pushed?: number; failed?: number; note?: string | null } | null | undefined;
                setMessage(r ? `Sent to Saleshandy: ${r.pushed ?? 0}. Failed: ${r.failed ?? 0}.${r.note ? ` ${r.note}` : ""}` : "Done.");
              })
            }
          >
            {busy === "push" ? "Sending…" : "Send now"}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => window.confirm("Delete this campaign?") && void run("delete", () => apiRequest(`/api/admin/outreach/campaigns/${id}`, "DELETE"))}>Delete</Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {message && <p className="text-xs text-green-700">{message}</p>}
    </div>
  );
}
