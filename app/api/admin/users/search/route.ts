import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Lightweight account search for the admin "assign to" picker — matches by
 * name first (fast, from profiles), then filters by email if a query is
 * given (email lives on auth.users, so we fetch it in and filter here
 * rather than a slow per-row lookup).
 */
export async function GET(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const serviceClient = createServiceClient();

  const { data: profiles, error } = await serviceClient
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emails = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError || !data?.users?.length) break;
    data.users.forEach((u) => {
      if (u.email) emails.set(u.id, u.email);
    });
    if (data.users.length < 1000) break;
    page += 1;
  }

  const merged = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    email: emails.get(p.id) ?? null,
  }));

  const filtered = q
    ? merged.filter(
        (u) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      )
    : merged;

  return NextResponse.json({ users: filtered.slice(0, 20) });
}
