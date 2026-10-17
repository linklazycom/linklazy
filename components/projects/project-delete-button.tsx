"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function ProjectDeleteButton({ id, name, linkCount }: { id: string; name: string; linkCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const extra = linkCount > 0 ? `\n\nYour ${linkCount} short link${linkCount === 1 ? "" : "s"} in this project will NOT be deleted; they just stop belonging to a project.` : "";
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
