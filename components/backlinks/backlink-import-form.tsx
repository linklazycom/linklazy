"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { BACKLINK_IMPORT_TEMPLATE } from "@/lib/backlinks/rules";
import type { ProjectOption } from "@/components/backlinks/backlink-add-form";

interface RowResult {
  line: number;
  ok: boolean;
  error?: string;
}

export function BacklinkImportForm({ projects, maxRows }: { projects: ProjectOption[]; maxRows: number }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ added: number; failed: number; results: RowResult[] } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) return setError("That file is too large (max ~400 KB).");
    setError(null);
    setCsv(await file.text());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSummary(null);
    const res = await apiRequest("/api/backlinks/import", "POST", { csv, project_id: projectId || null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSummary({ added: Number(res.data?.added ?? 0), failed: Number(res.data?.failed ?? 0), results: (res.data?.results as RowResult[]) ?? [] });
    router.refresh();
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(BACKLINK_IMPORT_TEMPLATE)}`;
  const failures = summary?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
        <p className="text-sm text-muted">
          Up to {maxRows} rows per import. Columns: <code>source_url</code> (the page that links to you) and <code>target_url</code> (your page) are required;{" "}
          <code>anchor_text</code> and <code>note</code> are optional.{" "}
          <a href={templateHref} download="linklazy-backlinks-template.csv" className="text-brand-violet underline">
            Download a template
          </a>
          . Imported links are not checked until you press &quot;Check now&quot; or the next daily check runs.
        </p>
        {projects.length > 0 && (
          <div>
            <label htmlFor="project_id" className="mb-1 block text-sm text-muted">
              Put all of them in a project (optional)
            </label>
            <select id="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal sm:w-72">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder="…or paste CSV here" className="w-full rounded-chip border border-line px-3 py-2 font-mono text-xs outline-none focus:border-signal" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy || !csv.trim()}>
          {busy ? "Importing…" : "Import backlinks"}
        </Button>
      </form>

      {summary && (
        <div className="rounded-chip border border-line bg-white p-5 text-sm">
          <p className="mb-3 font-medium">
            {summary.added} added, {summary.failed} not added
          </p>
          {failures.length > 0 && (
            <ul className="space-y-1 text-xs">
              {failures.slice(0, 50).map((r) => (
                <li key={r.line}>
                  <span className="font-mono">Line {r.line}:</span> {r.error}
                </li>
              ))}
              {failures.length > 50 && <li className="text-muted">…and {failures.length - 50} more.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
