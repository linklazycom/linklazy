"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RetryTaskButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/tasks/${id}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(typeof body.error === "string" ? body.error : "Failed.");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" disabled={busy} onClick={retry}>
        Retry
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
