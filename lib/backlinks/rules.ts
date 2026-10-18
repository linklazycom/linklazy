import { validateDestinationUrl } from "@/lib/links/url";
import { cleanLine } from "@/lib/projects/rules";
import { csvToObjects } from "@/lib/csv";
import { hostKey } from "@/lib/backlinks/match";

/** Pure validation / CSV parsing for the Backlink Monitor (Batch 13). Tested in tests/backlink-rules.test.ts. */
export const ANCHOR_INPUT_MAX = 150;
export const NOTE_INPUT_MAX = 500;
export const IMPORT_MAX_ROWS = 500;

type Fail = { ok: false; message: string; field: string };

export interface NormalizedPage {
  url: string;
  domain: string;
}

/**
 * "Blog.Example.org/post/#top" -> { url: "https://blog.example.org/post", domain: "blog.example.org" }.
 * The fragment and a trailing slash are dropped (the query string is kept: it can change the page).
 * Private/internal hosts, shorteners, credentials and LinkLazy's own addresses are refused.
 */
export function normalizePageUrl(raw: unknown, field: "source_url" | "target_url", ownHosts: readonly string[] = []): { ok: true; value: NormalizedPage } | Fail {
  const r = validateDestinationUrl(typeof raw === "string" ? raw : "", { ownHosts });
  if (!r.ok) return { ok: false, message: r.message, field };
  const u = new URL(r.url);
  if (ownHosts.map((h) => h.toLowerCase()).includes(u.hostname.toLowerCase())) {
    return { ok: false, message: "Enter a page on another website, not a LinkLazy address.", field };
  }
  u.hash = "";
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const url = `${u.protocol}//${u.host}${path}${u.search}`;
  if (url.length > 2048) return { ok: false, message: "That URL is too long.", field };
  return { ok: true, value: { url, domain: hostKey(u.hostname) } };
}

export interface BacklinkFields {
  source: NormalizedPage;
  target: NormalizedPage;
  anchor: string | null;
  note: string | null;
}

export function validateBacklinkFields(
  input: { source_url?: unknown; target_url?: unknown; anchor_text?: unknown; note?: unknown },
  ownHosts: readonly string[] = []
): { ok: true; value: BacklinkFields } | Fail {
  const source = normalizePageUrl(input.source_url, "source_url", ownHosts);
  if (!source.ok) return source;
  const target = normalizePageUrl(input.target_url, "target_url", ownHosts);
  if (!target.ok) return target;
  if (source.value.url === target.value.url) {
    return { ok: false, message: "The page that links and the page it links to cannot be the same.", field: "target_url" };
  }
  return { ok: true, value: { source: source.value, target: target.value, anchor: cleanLine(input.anchor_text, ANCHOR_INPUT_MAX), note: cleanLine(input.note, NOTE_INPUT_MAX) } };
}

export interface BacklinkImportRow {
  line: number; // 1-based line in the file (header = line 1)
  source_url: string;
  target_url: string;
  anchor_text: string | null;
  note: string | null;
}

const SOURCE_HEADERS = ["source_url", "source", "linking_page", "page_url", "url"];
const TARGET_HEADERS = ["target_url", "target", "your_url", "destination_url", "destination"];
const ANCHOR_HEADERS = ["anchor_text", "anchor"];

export function parseBacklinkCsv(text: string, maxRows: number): { ok: true; rows: BacklinkImportRow[] } | { ok: false; error: string } {
  const { headers, rows } = csvToObjects(text);
  if (!headers.length) return { ok: false, error: "The file is empty." };
  const sourceH = SOURCE_HEADERS.find((h) => headers.includes(h));
  const targetH = TARGET_HEADERS.find((h) => headers.includes(h));
  if (!sourceH) return { ok: false, error: 'Missing a "source_url" column (the page that links to you).' };
  if (!targetH) return { ok: false, error: 'Missing a "target_url" column (the page on your site it links to).' };
  if (rows.length === 0) return { ok: false, error: "No data rows found." };
  const cap = Math.min(maxRows, IMPORT_MAX_ROWS);
  if (rows.length > cap) return { ok: false, error: `Too many rows (${rows.length}). The limit is ${cap} per import.` };
  const anchorH = ANCHOR_HEADERS.find((h) => headers.includes(h));
  return {
    ok: true,
    rows: rows.map((r, i) => ({
      line: i + 2,
      source_url: (r[sourceH] ?? "").trim(),
      target_url: (r[targetH] ?? "").trim(),
      anchor_text: anchorH ? (r[anchorH] ?? "").trim() || null : null,
      note: (r["note"] ?? "").trim() || null,
    })),
  };
}

export const BACKLINK_EXPORT_HEADERS = [
  "source_url", "target_url", "status", "reason", "link_type", "expected_anchor", "found_anchor", "project",
  "last_checked_at", "first_found_at", "last_found_at", "consecutive_failures",
] as const;

export const BACKLINK_IMPORT_TEMPLATE = "source_url,target_url,anchor_text,note\nhttps://blog.example.org/my-post,https://yoursite.com/page,best widgets,guest post\n";

/** "follow" / "nofollow" / "sponsored ugc" / "" (unknown) for the export and the list. */
export function linkTypeLabel(rel: string | null, isFollow: boolean | null): string {
  if (isFollow === null) return "";
  if (isFollow) return "follow";
  return rel ? rel : "nofollow (page-level)";
}
