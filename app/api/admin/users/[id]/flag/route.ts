import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { flagged, reason } = await request.json();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_flagged: Boolean(flagged),
      flag_reason: flagged ? reason ?? null : null,
      flagged_at: flagged ? new Date().toISOString() : null,
      flagged_by: flagged ? user.id : null,
    })
    .eq("id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: flagged ? "user_flagged" : "user_unflagged",
    target_table: "profiles",
    target_id: targetId,
    metadata: { reason },
  });

  return NextResponse.json({ ok: true });
}
