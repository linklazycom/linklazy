"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function AdminBioActions({ id, disabledReason }: { id: string; disabledReason: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "takedown" | "restore", flag = false) {
    let note: string | null = null;
    if (action === "takedown") {
      note = window.prompt("Reason for the takedown (shown only to admins):", "Abuse");
      if (note === null) return;
    } else if (!window.confirm("Restore this page?")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/bio/${id}`, "PATCH", { action, note, flag_owner: flag });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {disabledReason === null ? (
        <>
          <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run("takedown")}>
            Take down
          </Button>
          <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => run("takedown", true)}>
            Take down + flag owner
          </Button>
        </>
      ) : disabledReason === "admin_takedown" ? (
        <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run("restore")}>
          Restore
        </Button>
      ) : (
        <span className="text-xs text-muted">Owner banned/suspended</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
