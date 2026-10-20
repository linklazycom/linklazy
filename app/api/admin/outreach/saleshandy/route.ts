import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateFieldMap } from "@/lib/outreach/saleshandy";
import { ensureConnection, rotateWebhookSecret, saveApiKey, testSaleshandy } from "@/lib/outreach/saleshandy-server";

/** Saleshandy connection settings (admin only). The API key is encrypted before it is stored and is never sent back to the browser. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 10_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const b = body as Record<string, unknown>;
  const service = createServiceClient();
  const log = (action: string) => auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action, target_table: "outreach_connection", target_id: null, metadata: {} });

  try {
    switch (b.action) {
      case "save_key": {
        const key = typeof b.api_key === "string" ? b.api_key.trim() : "";
        if (key.length < 16 || key.length > 300 || /\s/.test(key)) return NextResponse.json({ error: "That does not look like a Saleshandy API key. Copy it again from Saleshandy > Settings > API Key.", field: "api_key" }, { status: 400 });
        await saveApiKey(auth.adminId, key, service);
        await log("outreach_saleshandy_key_saved");
        return NextResponse.json({ ok: true });
      }
      case "save_fields": {
        const v = validateFieldMap(b.field_map);
        if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });
        await ensureConnection(auth.adminId, service);
        const { error } = await service.from("outreach_connection").update({ field_map: v.value, updated_by: auth.adminId, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
        await log("outreach_saleshandy_fields_saved");
        return NextResponse.json({ ok: true });
      }
      case "test": {
        const result = await testSaleshandy(auth.adminId, service);
        return NextResponse.json(result);
      }
      case "rotate_webhook": {
        await rotateWebhookSecret(auth.adminId, service);
        await log("outreach_saleshandy_webhook_rotated");
        return NextResponse.json({ ok: true });
      }
      case "disconnect": {
        await ensureConnection(auth.adminId, service);
        await service.from("outreach_connection").update({ api_key_encrypted: null, api_key_hint: null, last_test_at: null, last_test_ok: null, last_test_message: null, updated_by: auth.adminId, updated_at: new Date().toISOString() }).eq("id", 1);
        await log("outreach_saleshandy_disconnected");
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 200) : "Something went wrong." }, { status: 500 });
  }
}
