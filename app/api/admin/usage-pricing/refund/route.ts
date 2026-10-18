import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { readJson } from "@/lib/links/http";
import { createServiceClient } from "@/lib/supabase/service";
import { refundUsage } from "@/lib/usage/charge";

const schema = z.object({ charge_id: z.string().uuid() });

/** Admin refund of one usage charge (idempotent: pressing it twice returns the money once). */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 2_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const svc = createServiceClient();
  const { data: before } = await svc.from("usage_charges").select("id, user_id, action, amount, status").eq("id", parsed.data.charge_id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Charge not found." }, { status: 404 });

  const ok = await refundUsage(before.id as string, "refunded by admin");
  if (!ok) return NextResponse.json({ error: "The refund failed. Nothing was changed; please try again." }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "usage_charge_refund",
    target_table: "usage_charges",
    target_id: before.id as string,
    metadata: { user_id: before.user_id, action: before.action, amount: before.amount, previous_status: before.status },
  });
  return NextResponse.json({ ok: true });
}
