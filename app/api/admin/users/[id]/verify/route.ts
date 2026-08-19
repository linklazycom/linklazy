import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Lets an admin manually mark a user's email as verified — for cases where
 * the confirmation email never arrived, landed in spam, or the user signed
 * up before email delivery was fixed. Uses the service-role client since
 * confirming email is an auth.users-level operation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const serviceClient = createServiceClient();

  const { data: updated, error } = await serviceClient.auth.admin.updateUserById(targetId, {
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_email_verified",
    target_table: "profiles",
    target_id: targetId,
  });

  return NextResponse.json({ ok: true, emailConfirmedAt: updated.user?.email_confirmed_at ?? null });
}
