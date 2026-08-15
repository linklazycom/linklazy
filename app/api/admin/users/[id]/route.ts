import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId } = check;

  if (targetId === adminId) {
    return NextResponse.json({ error: "You can't delete your own admin account." }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Log before deleting — target_id would otherwise reference a row that no
  // longer exists in either auth.users or profiles.
  await serviceClient.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_deleted",
    target_table: "profiles",
    target_id: targetId,
  });

  const { error } = await serviceClient.auth.admin.deleteUser(targetId);

  if (error) {
    // If auth deletion fails (e.g. FK constraints from orders/sites this
    // user still owns), surface that clearly rather than silently leaving
    // a half-deleted account — suspend/ban is the safer move for accounts
    // with order/listing history.
    return NextResponse.json(
      { error: `Could not delete: ${error.message}. If this user has orders or listings, ban them instead — deleting could break records those depend on.` },
      { status: 409 }
    );
  }

  // Belt-and-suspenders: if profiles.id -> auth.users(id) isn't set to
  // ON DELETE CASCADE, clean up the leftover profile row explicitly.
  await serviceClient.from("profiles").delete().eq("id", targetId);

  return NextResponse.json({ ok: true });
}
