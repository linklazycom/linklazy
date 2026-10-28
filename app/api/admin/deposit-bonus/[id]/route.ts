import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { clawBackBonus, retryFailedBonus } from "@/lib/deposit-bonus-server";

const schema = z.object({ action: z.enum(["clawback", "retry"]) });

/**
 * clawback: use AFTER refunding the deposit at the payment provider. Takes back only the unspent part of the bonus.
 * retry: gives a bonus whose wallet credit failed another try.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const service = createServiceClient();
  const result = parsed.data.action === "clawback" ? await clawBackBonus(service, id) : await retryFailedBonus(service, id);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Failed" }, { status: 409 });

  await admin.supabase.from("admin_logs").insert({
    admin_id: admin.adminId,
    action: `deposit_bonus_${parsed.data.action}`,
    target_table: "wallet_bonuses",
    target_id: id,
    metadata: { result },
  });
  return NextResponse.json(result);
}
