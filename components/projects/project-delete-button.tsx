"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function ProjectDeleteButton({ id, name, linkCount, backlinkCount = 0 }: { id: string; name: string; linkCount: number; backlinkCount?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const parts = [
      linkCount > 0 ? `${linkCount} short link${linkCount === 1 ? "" : "s"}` : "",
      backlinkCount > 0 ? `${backlinkCount} tracked backlink${backlinkCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    const extra = parts.length ? `\n\nYour ${parts.join(" and ")} in this project will NOT be deleted; they just stop belonging to a project.` : "";
    if (!window.confirm(`Delete the project "${name}" and its saved keywords?${extra}`)) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/projects/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/dashboard/projects");
    router.refresh();
  }

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={remove} disabled={busy} className="text-red-700">
        {busy ? "Deleting…" : "Delete project"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
