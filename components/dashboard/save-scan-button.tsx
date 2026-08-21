"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SaveScanButton({ scanId, initialSaved }: { scanId: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = !saved;
    const res = await fetch(`/api/buyer-scan/${scanId}/save`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ save: next }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Could not update this scan.");
      return;
    }

    setSaved(next);
    // Re-fetch the server-rendered list so ordering (saved-first) and
    // the pruning cutoff stay correct without a full page reload.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-chip border px-2 py-1 text-xs ${
          saved
            ? "border-signal bg-signal-soft text-signal"
            : "border-line bg-white text-muted hover:border-signal"
        }`}
      >
        {busy ? "…" : saved ? "★ Saved" : "☆ Save"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
