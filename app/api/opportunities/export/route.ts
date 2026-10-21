import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/links/csv";
import { CONFIDENCE_LABELS, OPP_EXPORT_HEADERS, OPP_STATUS_LABELS, oppTypeLabel, parseOppFilters, type Confidence, type OppStatus } from "@/lib/opportunities/rules";

/** CSV of the user's opportunities with the same filters as the page (read through the user's own session, so row-level security applies). */
export async function GET(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;

  const sp: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const f = parseOppFilters(sp);

  const supabase = await createClient();
  let q = supabase
    .from("opportunities")
    .select("project_id, opp_type, score, confidence, status, domain, url, title, note, found_at")
    .eq("user_id", gate.ctx.userId)
    .gte("score", f.minScore)
    .limit(5000);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.type) q = q.eq("opp_type", f.type);
  if (f.status === null) q = q.neq("status", "ignored");
  else if (f.status !== "all") q = q.eq("status", f.status);
  q = f.sort === "newest" ? q.order("found_at", { ascending: false }) : f.sort === "domain" ? q.order("domain", { ascending: true }) : q.order("score", { ascending: false }).order("found_at", { ascending: false });

  const [{ data: rows }, { data: projects }] = await Promise.all([q, supabase.from("projects").select("id, name").eq("user_id", gate.ctx.userId)]);
  const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const csv = toCsv(
    OPP_EXPORT_HEADERS,
    (rows ?? []).map((r) => [
      names.get(r.project_id as string) ?? "",
      oppTypeLabel(r.opp_type as string),
      r.score,
      CONFIDENCE_LABELS[r.confidence as Confidence] ?? r.confidence,
      OPP_STATUS_LABELS[r.status as OppStatus] ?? r.status,
      r.domain,
      r.url,
      r.title,
      r.note ?? "",
      String(r.found_at ?? "").slice(0, 10),
    ])
  );
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="opportunities.csv"', "cache-control": "no-store" },
  });
}
