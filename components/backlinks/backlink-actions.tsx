"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function CheckNowButton({ id, label = "Check now" }: { id: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/backlinks/${id}/check`, "POST");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={busy}>
        {busy ? "Checking…" : label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function DeleteBacklinkButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Stop tracking this backlink? Its check history will be deleted too.")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/backlinks/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/dashboard/backlinks");
    router.refresh();
  }

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={remove} disabled={busy} className="text-red-700">
        {busy ? "Deleting…" : "Delete backlink"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
