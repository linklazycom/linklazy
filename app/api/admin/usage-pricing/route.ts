import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { readJson } from "@/lib/links/http";
import { buildPricingRows } from "@/lib/usage/pricing";
import { clearUsagePricingCache } from "@/lib/usage/server";

const schema = z.object({
  enabled: z.boolean(),
  prices: z.record(z.string(), z.number()),
  freePerDay: z.record(z.string(), z.number()),
});

/** Saves the usage price list and the master charging switch into site_settings (one row per key). */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const built = buildPricingRows(parsed.data);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const now = new Date().toISOString();
  for (const row of built.rows) {
    const { error } = await supabase.from("site_settings").upsert({ key: row.key, value: row.value, updated_by: adminId, updated_at: now });
    if (error) return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
  clearUsagePricingCache();
  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "usage_pricing_update",
    target_table: "site_settings",
    target_id: null,
    metadata: { enabled: parsed.data.enabled, prices: parsed.data.prices, freePerDay: parsed.data.freePerDay },
  });
  return NextResponse.json({ ok: true });
}
