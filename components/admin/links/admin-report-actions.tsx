"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function AdminReportActions({ id, hasLink }: { id: string; hasLink: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "takedown" | "dismiss", flag = false) {
    const note = window.prompt(action === "takedown" ? "Note (optional) — the link will be disabled:" : "Note (optional):", "");
    if (note === null) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/links/reports/${id}`, "PATCH", { action, note: note || null, flag_owner: flag });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasLink && (
        <>
          <Button size="sm" type="button" disabled={busy} onClick={() => run("takedown")}>
            Take down link
          </Button>
          <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run("takedown", true)}>
            Take down + flag owner
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => run("dismiss")}>
        Dismiss
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
