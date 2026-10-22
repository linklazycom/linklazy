import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { toolById } from "@/lib/features/registry";
import { clearToolFlagCache } from "@/lib/features/gate";

/** Switches one user-facing tool on or off (Batch 16C). Admin only; only keys from the tool list can be written. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = (await readJson(request, 2_000)) as { id?: unknown; enabled?: unknown } | null;
  const tool = typeof body?.id === "string" ? toolById(body.id) : undefined;
  if (!tool || typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert({ key: tool.flagKey, value: body.enabled ? "on" : "off", updated_by: auth.adminId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Could not save the switch." }, { status: 500 });
  clearToolFlagCache();
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "feature_toggle", target_table: "site_settings", target_id: null, metadata: { tool: tool.id, key: tool.flagKey, enabled: body.enabled } });
  return NextResponse.json({ ok: true });
}
