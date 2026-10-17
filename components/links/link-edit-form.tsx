"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { UtmBuilder } from "@/components/links/utm-builder";
import { apiRequest, fromLocalInput, toLocalInput } from "@/components/links/api";
import type { ProjectOption } from "@/components/links/link-create-form";

export interface EditableLink {
  id: string;
  destination_url: string;
  title: string | null;
  folder: string | null;
  tags: string[];
  expires_at: string | null;
  max_clicks: number | null;
  is_active: boolean;
  has_password: boolean;
  project_id: string | null;
  locked: boolean; // taken down by admin / owner banned
}

export function LinkEditForm({ link, projects = [] }: { link: EditableLink; projects?: ProjectOption[] }) {
  const router = useRouter();
  const [url, setUrl] = useState(link.destination_url);
  const [title, setTitle] = useState(link.title ?? "");
  const [folder, setFolder] = useState(link.folder ?? "");
  const [tags, setTags] = useState(link.tags.join(", "));
  const [expires, setExpires] = useState(toLocalInput(link.expires_at));
  const [maxClicks, setMaxClicks] = useState(link.max_clicks === null ? "" : String(link.max_clicks));
  const [active, setActive] = useState(link.is_active);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [projectId, setProjectId] = useState(link.project_id ?? "");
  const [showUtm, setShowUtm] = useState(false);
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
    const res = await apiRequest(`/api/links/${link.id}`, "PATCH", {
      destination_url: url,
      title: title || null,
      folder: folder || null,
      tags: tags || null,
      // An unchanged, already-past expiry must not be re-validated as "new"; only send when changed.
      expires_at: expires === toLocalInput(link.expires_at) ? undefined : fromLocalInput(expires),
      max_clicks: maxClicks.trim() === "" ? null : Number(maxClicks),
      is_active: active,
      password: password || undefined,
      clear_password: clearPassword || undefined,
      // Only send when changed; an empty choice clears the project.
      project_id: projectId === (link.project_id ?? "") ? undefined : projectId || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    setPassword("");
    setClearPassword(false);
    setSaved(true);
    router.refresh();
  }

  const fieldErr = (f: string) => (errorField === f && error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null);

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div>
        <Field id="destination_url" label="Destination URL" value={url} onChange={(e) => setUrl(e.target.value)} required />
        {fieldErr("destination_url")}
        <button type="button" onClick={() => setShowUtm((v) => !v)} className="mt-2 text-xs text-brand-violet underline">
          {showUtm ? "Hide UTM builder" : "Edit UTM tracking tags"}
        </button>
      </div>
      {showUtm && (
        <UtmBuilder
          url={url}
          onApply={(u) => {
            setUrl(u);
            setShowUtm(false);
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="title" label="Title (for you)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Field id="folder" label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={40} />
        <Field id="tags" label="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        {projects.length > 0 && (
          <div>
            <label htmlFor="project_id" className="mb-1 block text-sm text-muted">
              Project
            </label>
            <select id="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal">
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
        <div>
          <Field id="expires" type="datetime-local" label="Expires at" value={expires} onChange={(e) => setExpires(e.target.value)} hint="Clear the field to remove the expiry." />
          {fieldErr("expires_at")}
        </div>
        <div>
          <Field id="max_clicks" type="number" min={1} label="Click limit" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} hint="Leave empty for unlimited." />
          {fieldErr("max_clicks")}
        </div>
        <div>
          <Field
            id="password"
            type="text"
            autoComplete="off"
            label={link.has_password ? "Change password" : "Password (optional)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={link.has_password ? "Leave empty to keep the current password." : "Visitors must enter it before being redirected."}
          />
          {fieldErr("password")}
          {link.has_password && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={clearPassword} onChange={(e) => setClearPassword(e.target.checked)} />
              Remove the password
            </label>
          )}
        </div>
      </div>

      {!link.locked && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Link is on (turn off to stop redirecting without deleting it)
        </label>
      )}

      {error && !errorField && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved ✓</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
