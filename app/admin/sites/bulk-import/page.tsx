"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const TEMPLATE_HEADERS = [
  "owner_email",
  "url",
  "niche",
  "language",
  "da",
  "pa",
  "dr",
  "organic_traffic",
  "referring_domains",
  "total_backlinks",
  "indexed_pages",
  "post_count",
  "spam_score",
  "accepts_exchange",
  "accepts_paid",
  "price_amount",
  "link_type",
  "placement",
  "turnaround_hours",
  "guidelines",
];

const TEMPLATE_EXAMPLE = [
  "seller@example.com",
  "https://example-blog.com",
  "Technology & Software",
  "en",
  "45",
  "40",
  "38",
  "12000",
  "310",
  "980",
  "150",
  "62",
  "1",
  "true",
  "true",
  "1500",
  "dofollow",
  "in_content",
  "48",
  "No gambling or adult content",
];

interface RowResult {
  row: number;
  url: string | null;
  owner_email: string | null;
  status: "created" | "error";
  site_id?: string;
  error?: string;
}

interface ImportResponse {
  total: number;
  created: number;
  failed: number;
  results: RowResult[];
}

function downloadTemplate() {
  const csv = `${TEMPLATE_HEADERS.join(",")}\n${TEMPLATE_EXAMPLE.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "linklazy-bulk-sites-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Very small preview parser (quote-aware) just so the admin can eyeball
// the file before submitting — the real validation happens server-side.
function previewParse(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = lines[0] ? splitLine(lines[0]).map((h) => h.trim()) : [];
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

export default function BulkImportSitesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const parsed = previewParse(text);
    setPreview(parsed);
  }

  async function handleImport() {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sites/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Import failed — check the CSV and try again.");
        setLoading(false);
        return;
      }
      setResult(body as ImportResponse);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFileName(null);
    setCsvText(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Bulk import sites</h1>
        <Link href="/admin/sites" className="text-sm text-brand-blue underline">
          Back to all sites
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted">
        Upload a CSV to list many sites at once, each assigned to an existing account by email —
        with the same metrics and link terms as listing a site one at a time. Every row goes
        straight to <span className="font-medium">approved &amp; verified</span>, same as the
        single-site admin form. Export from Excel or Google Sheets as CSV first (File → Download →
        Comma Separated Values).
      </p>

      <div className="mb-6 rounded-chip border border-line bg-white p-5">
        <h2 className="mb-2 text-sm font-medium">1. Get the template</h2>
        <p className="mb-3 text-xs text-muted">
          Columns: {TEMPLATE_HEADERS.join(", ")}. Only <span className="font-medium">owner_email</span> and{" "}
          <span className="font-medium">url</span> are strictly required — leave others blank to use the
          same defaults as the manual form (language=en, link_type=dofollow, placement=in_content,
          turnaround_hours=48, accepts_exchange/accepts_paid=true).
        </p>
        <Button size="sm" variant="secondary" onClick={downloadTemplate}>
          Download CSV template
        </Button>
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-5">
        <h2 className="mb-2 text-sm font-medium">2. Upload your CSV</h2>
        <p className="mb-3 text-xs text-muted">
          <span className="font-medium">owner_email</span> must match an existing account — this tool
          won&apos;t create new accounts, so make sure sellers/buyers already have one before importing
          their sites.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none file:mr-3 file:rounded-chip file:border-0 file:bg-paper file:px-3 file:py-1.5 file:text-sm"
        />
        {fileName && <p className="mt-2 text-xs text-muted">Selected: {fileName}</p>}
      </div>

      {preview && (
        <div className="mb-6 rounded-chip border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">
              3. Preview — {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} detected
            </h2>
            <button onClick={reset} className="text-xs text-brand-blue underline">
              Clear
            </button>
          </div>

          {preview.rows.length === 0 ? (
            <p className="text-sm text-red-600">No data rows found — check the file has a header row plus data.</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-chip border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-paper">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {preview.headers.map((_, ci) => (
                        <td key={ci} className="whitespace-nowrap px-2 py-1.5">
                          {r[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 20 && (
                <p className="border-t border-line px-2 py-1.5 text-xs text-muted">
                  …and {preview.rows.length - 20} more row{preview.rows.length - 20 === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          )}

          <Button className="mt-4" onClick={handleImport} disabled={loading || preview.rows.length === 0}>
            {loading ? "Importing…" : `Import ${preview.rows.length} site${preview.rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-medium">Results</h2>
          <p className="mb-3 text-sm">
            {result.created} of {result.total} site{result.total === 1 ? "" : "s"} created.{" "}
            {result.failed > 0 && <span className="text-red-600">{result.failed} failed — see below.</span>}
          </p>
          <div className="max-h-80 overflow-auto rounded-chip border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Row</th>
                  <th className="px-2 py-1.5 font-medium">URL</th>
                  <th className="px-2 py-1.5 font-medium">Owner email</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.row} className="border-t border-line">
                    <td className="px-2 py-1.5">{r.row}</td>
                    <td className="max-w-[200px] truncate px-2 py-1.5">{r.url ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.owner_email ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <span className={r.status === "created" ? "text-green-600" : "text-red-600"}>
                        {r.status === "created" ? "Created" : "Failed"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.status === "created" ? (
                        <Link href={`/admin/sites/${r.site_id}`} className="text-brand-blue underline">
                          View site
                        </Link>
                      ) : (
                        r.error
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
