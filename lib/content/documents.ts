import { DOC_BODY_MAX, DOC_TITLE_MAX, isContentKind, type ContentKind } from "@/lib/content/kinds";
import { cleanLine } from "@/lib/projects/rules";

/** Saved Content Studio documents (Batch 15): input checks. Pure. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

type Fail = { ok: false; message: string; field?: string };

/** Body text: plain text only, line breaks kept, control characters removed. */
export function cleanBody(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, DOC_BODY_MAX);
}

export interface NewDocument {
  kind: ContentKind;
  title: string;
  body: string;
  projectId: string | null;
}

export function validateNewDocument(input: Record<string, unknown>): { ok: true; value: NewDocument } | Fail {
  if (!isContentKind(input.kind)) return { ok: false, message: "Unknown document type.", field: "kind" };
  const title = cleanLine(input.title, DOC_TITLE_MAX);
  if (!title) return { ok: false, message: "Give the document a title.", field: "title" };
  const body = cleanBody(input.body);
  if (body === null || body.trim().length === 0) return { ok: false, message: "There is nothing to save yet.", field: "body" };
  let projectId: string | null = null;
  if (input.project_id !== undefined && input.project_id !== null && input.project_id !== "") {
    if (!isUuid(input.project_id)) return { ok: false, message: "Invalid project.", field: "project_id" };
    projectId = input.project_id;
  }
  return { ok: true, value: { kind: input.kind, title, body, projectId } };
}

export interface DocumentPatch {
  title?: string;
  body?: string;
}

export function validateDocumentPatch(input: Record<string, unknown>): { ok: true; value: DocumentPatch } | Fail {
  const out: DocumentPatch = {};
  if (input.title !== undefined) {
    const title = cleanLine(input.title, DOC_TITLE_MAX);
    if (!title) return { ok: false, message: "Give the document a title.", field: "title" };
    out.title = title;
  }
  if (input.body !== undefined) {
    const body = cleanBody(input.body);
    if (body === null || body.trim().length === 0) return { ok: false, message: "The document cannot be empty.", field: "body" };
    out.body = body;
  }
  if (out.title === undefined && out.body === undefined) return { ok: false, message: "Nothing to change." };
  return { ok: true, value: out };
}

/** File name for an export: letters, digits, dashes; never a path. */
export function exportFileName(title: string, ext: "md" | "txt"): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "document"}.${ext}`;
}
