import { csvToObjects } from "@/lib/csv";

/** CSV import/export for short links (Batch 9). Pure; tested in tests/link-csv.test.ts. */

/** Spreadsheet formula-injection guard: cells starting with = + - @ are prefixed with an apostrophe. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const EXPORT_HEADERS = [
  "slug", "short_url", "destination_url", "title", "folder", "tags", "status",
  "clicks", "click_limit", "expires_at", "created_at",
] as const;

export function toCsv(headers: readonly string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n") + "\r\n";
}

export interface ImportRow {
  line: number; // 1-based line number in the file (header = line 1)
  destination_url: string;
  slug: string | null;
  title: string | null;
  folder: string | null;
  tags: string[];
  expires_at: string | null;
  max_clicks: number | null | "invalid";
}

const URL_HEADERS = ["destination_url", "url", "destination", "long_url"];

export function parseImportCsv(text: string, maxRows: number):
  | { ok: true; rows: ImportRow[] }
  | { ok: false; error: string } {
  const { headers, rows } = csvToObjects(text);
  if (!headers.length) return { ok: false, error: "The file is empty." };
  const urlHeader = URL_HEADERS.find((h) => headers.includes(h));
  if (!urlHeader) return { ok: false, error: "Missing a \"destination_url\" column." };
  if (rows.length === 0) return { ok: false, error: "No data rows found." };
  if (rows.length > maxRows) return { ok: false, error: `Too many rows (${rows.length}). The limit is ${maxRows} per import.` };

  const out: ImportRow[] = rows.map((r, i) => {
    const mc = (r["max_clicks"] ?? r["click_limit"] ?? "").trim();
    const n = mc === "" ? null : Number(mc);
    return {
      line: i + 2,
      destination_url: (r[urlHeader] ?? "").trim(),
      slug: (r["slug"] ?? "").trim() || null,
      title: (r["title"] ?? "").trim() || null,
      folder: (r["folder"] ?? "").trim() || null,
      tags: (r["tags"] ?? "").split(/[;|,]/).map((t) => t.trim()).filter(Boolean),
      expires_at: (r["expires_at"] ?? "").trim() || null,
      max_clicks: n === null ? null : Number.isInteger(n) && n > 0 ? n : "invalid",
    };
  });
  return { ok: true, rows: out };
}
