import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reason } = await request.json().catch(() => ({ reason: null }));

  const { error } = await supabase
    .from("sites")
    .update({ status: "rejected", rejection_reason: reason ?? "Did not meet listing guidelines" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: "site_rejected",
    target_table: "sites",
    target_id: id,
    metadata: { reason },
  });

  return NextResponse.json({ ok: true });
}
