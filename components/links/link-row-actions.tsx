"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function LinkRowActions({ id, isActive, locked }: { id: string; isActive: boolean; locked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/links/${id}`, "PATCH", { is_active: !isActive });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this link? Anyone using it (including printed QR codes) will get a \"not found\" page. This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/links/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/links/${id}`}>
        <Button size="sm" variant="secondary" type="button">
          Edit / QR
        </Button>
      </Link>
      {!locked && (
        <Button size="sm" variant="ghost" type="button" onClick={toggle} disabled={busy}>
          {isActive ? "Turn off" : "Turn on"}
        </Button>
      )}
      <Button size="sm" variant="ghost" type="button" onClick={remove} disabled={busy}>
        Delete
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
