"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import type { ProjectOption } from "@/components/backlinks/backlink-add-form";

export function BacklinkEditForm({ id, initial, projects }: { id: string; initial: { project_id: string | null; anchor_text: string | null; note: string | null; monitoring: boolean }; projects: ProjectOption[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initial.project_id ?? "");
  const [anchor, setAnchor] = useState(initial.anchor_text ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [monitoring, setMonitoring] = useState(initial.monitoring);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    setSaved(false);
    const res = await apiRequest(`/api/backlinks/${id}`, "PATCH", { project_id: projectId || null, anchor_text: anchor || null, note: note || null, monitoring });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="anchor_text" label="Expected anchor text" value={anchor} onChange={(e) => { setAnchor(e.target.value); setSaved(false); }} maxLength={150} />
        <Field id="note" label="Note" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} maxLength={500} />
      </div>
      {projects.length > 0 && (
        <div>
          <label htmlFor="project_id" className="mb-1 block text-sm text-muted">
            Project
          </label>
          <select id="project_id" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSaved(false); }} className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal">
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errorField === "project_id" && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={monitoring} onChange={(e) => { setMonitoring(e.target.checked); setSaved(false); }} />
        Check this link automatically every day
      </label>
      {error && !errorField && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved ✓</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
