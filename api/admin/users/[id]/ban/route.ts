import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  if (targetId === adminId) {
    return NextResponse.json({ error: "You can't ban your own admin account." }, { status: 400 });
  }

  const { banned, reason } = await request.json();
  const serviceClient = createServiceClient();

  // Lock out at the Supabase Auth level too, not just the app's own
  // is_banned flag — a banned user shouldn't be able to log in and hit
  // API routes directly, even ones that don't check profiles.is_banned.
  const { error: authError } = await serviceClient.auth.admin.updateUserById(targetId, {
    ban_duration: banned ? "876000h" : "none", // ~100 years = effectively permanent
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { error } = await supabase
    .from("profiles")
    .update({
      is_banned: Boolean(banned),
      banned_reason: banned ? reason ?? null : null,
      banned_at: banned ? new Date().toISOString() : null,
      banned_by: banned ? adminId : null,
    })
    .eq("id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: banned ? "user_banned" : "user_unbanned",
    target_table: "profiles",
    target_id: targetId,
    metadata: { reason },
  });

  return NextResponse.json({ ok: true });
}
