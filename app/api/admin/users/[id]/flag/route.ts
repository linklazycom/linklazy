import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const { flagged, reason } = await request.json();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_flagged: Boolean(flagged),
      flag_reason: flagged ? reason ?? null : null,
      flagged_at: flagged ? new Date().toISOString() : null,
      flagged_by: flagged ? adminId : null,
    })
    .eq("id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: flagged ? "user_flagged" : "user_unflagged",
    target_table: "profiles",
    target_id: targetId,
    metadata: { reason },
  });

  return NextResponse.json({ ok: true });
}
