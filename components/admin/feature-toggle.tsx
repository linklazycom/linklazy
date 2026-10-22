"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/links/api";

export function FeatureToggle({ id, label, enabled }: { id: string; label: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    if (busy) return;
    const next = !enabled;
    if (!next && !window.confirm(`Switch OFF "${label}" for all users? Their saved data is kept. The change reaches everyone within about 15 seconds.`)) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/admin/features", "POST", { id, enabled: next });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label}: ${enabled ? "on" : "off"}`}
        disabled={busy}
        onClick={flip}
        className={`rounded-chip px-3 py-1 text-sm font-medium ${enabled ? "bg-green-600 text-white" : "bg-gray-300 text-gray-800"}`}
      >
        {busy ? "…" : enabled ? "ON" : "OFF"}
      </button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
