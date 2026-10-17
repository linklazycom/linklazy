"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/links/copy-button";
import { UtmBuilder } from "@/components/links/utm-builder";
import { apiRequest, fromLocalInput } from "@/components/links/api";

export interface ProjectOption {
  id: string;
  name: string;
}

export function LinkCreateForm({ siteUrl, projects = [], defaultProjectId = null }: { siteUrl: string; projects?: ProjectOption[]; defaultProjectId?: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [expires, setExpires] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [showUtm, setShowUtm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();
  const [created, setCreated] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    setCreated(null);
    const mc = maxClicks.trim() === "" ? null : Number(maxClicks);
    const res = await apiRequest("/api/links", "POST", {
      destination_url: url,
      slug: slug || null,
      title: title || null,
      folder: folder || null,
      tags: tags || null,
      expires_at: fromLocalInput(expires),
      max_clicks: mc,
      password: password || null,
      project_id: projectId || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    setCreated(String(res.data?.short_url ?? ""));
    setUrl("");
    setSlug("");
    setTitle("");
    setFolder("");
    setTags("");
    setExpires("");
    setMaxClicks("");
    setPassword("");
    setProjectId(defaultProjectId ?? "");
    setShowUtm(false);
    router.refresh();
  }

  const fieldErr = (f: string) => (errorField === f && error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null);

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <h2 className="font-display text-lg font-medium">Create a short link</h2>

      <div>
        <Field id="destination_url" label="Destination URL" placeholder="https://example.com/your/long/page" value={url} onChange={(e) => setUrl(e.target.value)} required />
        {fieldErr("destination_url")}
        <button type="button" onClick={() => setShowUtm((v) => !v)} className="mt-2 text-xs text-brand-violet underline">
          {showUtm ? "Hide UTM builder" : "Add UTM tracking tags"}
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

      <details className="rounded-chip border border-line p-4" open={!!defaultProjectId}>
        <summary className="cursor-pointer text-sm font-medium">More options</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Field id="slug" label="Custom slug (optional)" placeholder="spring-sale" value={slug} onChange={(e) => setSlug(e.target.value)} hint={`${siteUrl}/l/${slug.trim().toLowerCase() || "your-slug"}`} />
            {fieldErr("slug")}
          </div>
          <Field id="title" label="Title (for you)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <Field id="folder" label="Folder" placeholder="Campaigns" value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={40} />
          <Field id="tags" label="Tags (comma separated)" placeholder="promo, email" value={tags} onChange={(e) => setTags(e.target.value)} />
          <div>
            <Field id="expires" type="datetime-local" label="Expires at (optional)" value={expires} onChange={(e) => setExpires(e.target.value)} />
            {fieldErr("expires_at")}
          </div>
          <div>
            <Field id="max_clicks" type="number" min={1} label="Click limit (optional)" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} />
            {fieldErr("max_clicks")}
          </div>
          {projects.length > 0 && (
            <div>
              <label htmlFor="project_id" className="mb-1 block text-sm text-muted">
                Project (optional)
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
            <Field id="password" type="text" autoComplete="off" label="Password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} hint="Visitors must enter it before being redirected." />
            {fieldErr("password")}
          </div>
        </div>
      </details>

      {error && !errorField && <p className="text-sm text-red-600">{error}</p>}
      {created && (
        <div className="flex flex-wrap items-center gap-3 rounded-chip border border-signal/30 bg-signal-soft p-3 text-sm">
          <span>Created:</span>
          <a href={created} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-brand-violet underline">
            {created}
          </a>
          <CopyButton text={created} />
        </div>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create link"}
      </Button>
    </form>
  );
}
