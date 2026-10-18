import { NextResponse } from "next/server";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/links/csv";
import { BACKLINK_EXPORT_HEADERS, linkTypeLabel } from "@/lib/backlinks/rules";
import { STATUS_LABEL } from "@/lib/backlinks/labels";
import type { BacklinkStatus } from "@/lib/backlinks/check";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = Object.keys(STATUS_LABEL);

/** CSV of the user's tracked backlinks (read through the user's own session, so row-level security applies). */
export async function GET(request: Request) {
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;

  const url = new URL(request.url);
  const project = url.searchParams.get("project") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const supabase = await createClient();
  let q = supabase
    .from("backlinks")
    .select("source_url, target_url, status, reason, rel, is_follow, anchor_text, found_anchor, project_id, last_checked_at, first_found_at, last_found_at, consecutive_failures")
    .eq("user_id", gate.ctx.userId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (UUID_RE.test(project)) q = q.eq("project_id", project);
  if (STATUSES.includes(status)) q = q.eq("status", status);

  const [{ data: rows }, { data: projects }] = await Promise.all([q, supabase.from("projects").select("id, name").eq("user_id", gate.ctx.userId)]);
  const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const csv = toCsv(
    BACKLINK_EXPORT_HEADERS,
    (rows ?? []).map((r) => [
      r.source_url, r.target_url, STATUS_LABEL[r.status as BacklinkStatus] ?? r.status, r.reason ?? "", linkTypeLabel(r.rel, r.is_follow), r.anchor_text ?? "", r.found_anchor ?? "",
      r.project_id ? names.get(r.project_id) ?? "" : "", r.last_checked_at ?? "", r.first_found_at ?? "", r.last_found_at ?? "", r.consecutive_failures,
    ])
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="linklazy-backlinks.csv"', "Cache-Control": "no-store" },
  });
}
