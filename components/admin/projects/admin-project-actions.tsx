"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

/** Pause / restore buttons for one project row (Admin > Projects). */
export function AdminProjectActions({ id, paused }: { id: string; paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "suspend" | "restore") {
    let note: string | null = null;
    if (action === "suspend") {
      note = window.prompt("কারণ লিখুন (মালিককে ইমেইলে জানানো হবে):", "Misuse");
      if (note === null) return;
    } else if (!window.confirm("প্রজেক্টটি আবার চালু করবেন?")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/projects/${id}`, "PATCH", { action, note });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run(paused ? "restore" : "suspend")}>
        {paused ? "Restore" : "Pause"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
