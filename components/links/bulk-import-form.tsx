"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

interface RowResult {
  line: number;
  ok: boolean;
  slug?: string;
  error?: string;
}

const TEMPLATE = "destination_url,slug,title,folder,tags,expires_at,max_clicks\nhttps://example.com/page,,My page,Campaigns,promo|email,,\n";

export function BulkImportForm({ maxRows }: { maxRows: number }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ created: number; failed: number; results: RowResult[] } | null>(null);

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
    const res = await apiRequest("/api/links/import", "POST", { csv });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSummary({
      created: Number(res.data?.created ?? 0),
      failed: Number(res.data?.failed ?? 0),
      results: (res.data?.results as RowResult[]) ?? [],
    });
    router.refresh();
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
        <p className="text-sm text-muted">
          Up to {maxRows} rows per import. Columns: <code>destination_url</code> (required), <code>slug</code>, <code>title</code>,{" "}
          <code>folder</code>, <code>tags</code> (separate with |), <code>expires_at</code>, <code>max_clicks</code>.{" "}
          <a href={templateHref} download="linklazy-import-template.csv" className="text-brand-violet underline">
            Download a template
          </a>
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder="…or paste CSV here"
          className="w-full rounded-chip border border-line px-3 py-2 font-mono text-xs outline-none focus:border-signal"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy || !csv.trim()}>
          {busy ? "Importing…" : "Import links"}
        </Button>
      </form>

      {summary && (
        <div className="rounded-chip border border-line bg-white p-5 text-sm">
          <p className="mb-3 font-medium">
            {summary.created} created, {summary.failed} failed
          </p>
          {summary.failed > 0 && (
            <ul className="space-y-1 text-xs">
              {summary.results
                .filter((r) => !r.ok)
                .slice(0, 100)
                .map((r) => (
                  <li key={r.line} className="text-red-600">
                    Line {r.line}: {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
