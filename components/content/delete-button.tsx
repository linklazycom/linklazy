"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function ContentDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/content/documents/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
        {busy ? "Deleting…" : "Delete"}
      </Button>
    </span>
  );
}
