import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateCampaign } from "@/lib/outreach/campaign";

/** Creates a campaign. It always starts PAUSED: nothing is handed to Saleshandy until an admin activates it. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 20_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateCampaign(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const service = createServiceClient();
  if (v.value.site_ids.length > 0) {
    const { data } = await service.from("sites").select("id").in("id", v.value.site_ids).eq("status", "approved");
    if ((data ?? []).length !== v.value.site_ids.length) return NextResponse.json({ error: "One of the chosen listings is not an approved site.", field: "site_ids" }, { status: 400 });
  }
  const { data, error } = await service
    .from("outreach_campaigns")
    .insert({ ...v.value, status: "paused", created_by: auth.adminId })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not create the campaign." }, { status: 500 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_campaign_created", target_table: "outreach_campaigns", target_id: data.id, metadata: { daily_cap: v.value.daily_cap } });
  return NextResponse.json({ id: data.id });
}
