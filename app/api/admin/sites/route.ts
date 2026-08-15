import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const PAGE_SIZE = 25;

/**
 * Full site directory for admins — unlike /admin/sites (which only shows
 * the pending approval queue), this covers every status so an admin can
 * find an already-approved or rejected site to inspect its DR history,
 * verification, orders, etc. Supports pagination + search + status filter
 * via query params: ?page=1&status=approved&q=domain-or-niche
 */
export async function GET(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }
  const { supabase } = check;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const status = searchParams.get("status") ?? "all";
  const q = searchParams.get("q")?.trim() ?? "";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("sites")
    .select(
      "id, domain, niche, status, da, dr, dr_verified, dr_check_status, organic_traffic, owner_id, created_at, profiles:owner_id(full_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`domain.ilike.%${q}%,niche.ilike.%${q}%`);

  const { data: sites, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sites: sites ?? [],
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  });
}
