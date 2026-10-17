"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function AdminDomainActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "disable" | "enable" | "mark_active") {
    let note: string | null = null;
    if (action === "disable") {
      note = window.prompt("Reason for disabling (shown only to admins):", "Abuse");
      if (note === null) return;
    } else if (action === "mark_active" && !window.confirm("Mark active only after the domain is added to the hosting project and DNS works. Continue?")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/domains/${id}`, "POST", { action, note });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }
  async function remove() {
    if (!window.confirm("Delete this domain permanently?")) return;
    setBusy(true);
    const res = await apiRequest(`/api/admin/domains/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "verified" && (
        <Button size="sm" type="button" disabled={busy} onClick={() => run("mark_active")}>
          Mark active
        </Button>
      )}
      {status === "disabled" ? (
        <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run("enable")}>
          Re-enable
        </Button>
      ) : (
        <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => run("disable")}>
          Disable
        </Button>
      )}
      <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={remove}>
        Delete
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
