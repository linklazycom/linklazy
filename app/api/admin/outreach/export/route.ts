import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { parseContactFilters } from "@/lib/outreach/filters";
import { toCsv } from "@/lib/links/csv";

const HEADERS = ["email", "name", "company", "website", "country", "source", "status", "hold_reason", "tags", "notes", "created_at"] as const;
const MAX_ROWS = 20_000;

/** CSV export of the contact list (same filters as the contacts page). Cells that start with = + - @ are neutralised for spreadsheets. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseContactFilters(params);

  let q = auth.supabase
    .from("outreach_contacts")
    .select("email, full_name, company, website, country, source, status, hold_reason, tags, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (f.status) q = q.eq("status", f.status);
  if (f.source) q = q.eq("source", f.source);
  if (f.country) q = q.eq("country", f.country);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.q) q = q.or(`email.ilike.%${f.q}%,full_name.ilike.%${f.q}%,company.ilike.%${f.q}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Could not export." }, { status: 500 });

  const csv = toCsv(
    HEADERS,
    (data ?? []).map((r) => [r.email, r.full_name, r.company, r.website, r.country, r.source, r.status, r.hold_reason, (r.tags ?? []).join(";"), r.notes, r.created_at])
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="outreach-contacts.csv"', "Cache-Control": "no-store" },
  });
}
