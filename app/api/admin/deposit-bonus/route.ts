import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { validateBonusInput } from "@/lib/deposit-bonus";

const schema = z.object({
  enabled: z.boolean(),
  minAmount: z.number(),
  percent: z.number(),
  maxBonus: z.number(),
});

/** Saves the deposit-bonus settings (switch, minimum top-up, percent, cap) into site_settings. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const built = validateBonusInput(parsed.data);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const now = new Date().toISOString();
  for (const row of built.rows) {
    const { error } = await supabase.from("site_settings").upsert({ key: row.key, value: row.value, updated_by: adminId, updated_at: now });
    if (error) return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "deposit_bonus_update",
    target_table: "site_settings",
    target_id: null,
    metadata: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
