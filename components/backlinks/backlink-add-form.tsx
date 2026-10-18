"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export interface ProjectOption {
  id: string;
  name: string;
}

const SELECT = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export function BacklinkAddForm({ projects, defaultProjectId }: { projects: ProjectOption[]; defaultProjectId: string | null }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [anchor, setAnchor] = useState("");
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  const fieldErr = (f: string) => (errorField === f && error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    setMessage(null);
    const res = await apiRequest("/api/backlinks", "POST", {
      source_url: source,
      target_url: target,
      anchor_text: anchor || null,
      note: note || null,
      project_id: projectId || null,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    // Check it right away so the first status is real, not "Not checked yet".
    const id = (res.data?.backlink as { id?: string } | undefined)?.id;
    if (id) await apiRequest(`/api/backlinks/${id}/check`, "POST");
    setBusy(false);
    setSource("");
    setTarget("");
    setAnchor("");
    setNote("");
    setMessage("Added and checked.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field id="source_url" label="Page that links to you" placeholder="https://blog.example.org/my-post" value={source} onChange={(e) => setSource(e.target.value)} required />
          {fieldErr("source_url")}
        </div>
        <div>
          <Field id="target_url" label="Your page it should link to" placeholder="https://yoursite.com/page" value={target} onChange={(e) => setTarget(e.target.value)} required />
          {fieldErr("target_url")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Field id="anchor_text" label="Expected anchor text (optional)" value={anchor} onChange={(e) => setAnchor(e.target.value)} maxLength={150} />
          {fieldErr("anchor_text")}
        </div>
        <div>
          <Field id="note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>
        {projects.length > 0 && (
          <div>
            <label htmlFor="project_id" className="mb-1 block text-sm text-muted">
              Project (optional)
            </label>
            <select id="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={SELECT}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {fieldErr("project_id")}
          </div>
        )}
      </div>
      {error && !errorField && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-signal">{message}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Adding and checking…" : "Add backlink"}
      </Button>
    </form>
  );
}
