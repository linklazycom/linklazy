import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateCampaignPatch } from "@/lib/outreach/campaign";
import { isUuid } from "@/lib/content/documents";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 5_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateCampaignPatch(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const update: Record<string, unknown> = { ...v.value, updated_at: new Date().toISOString() };
  if (v.value.status === "active") update.pause_reason = null; // resuming clears the old reason
  if (v.value.status === "paused") update.pause_reason = "Paused by an admin";
  const { data, error } = await createServiceClient().from("outreach_campaigns").update(update).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_campaign_updated", target_table: "outreach_campaigns", target_id: id, metadata: v.value as Record<string, unknown> });
  return NextResponse.json({ ok: true });
}

/** A campaign that already handed contacts to Saleshandy cannot be deleted (the history is kept): pause it instead. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const service = createServiceClient();
  const { count } = await service.from("outreach_sends").select("id", { count: "exact", head: true }).eq("campaign_id", id).not("pushed_at", "is", null);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "This campaign has already sent contacts to Saleshandy, so it is kept for the history. Pause it instead." }, { status: 409 });
  const { data, error } = await service.from("outreach_campaigns").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: "Could not delete the campaign." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
