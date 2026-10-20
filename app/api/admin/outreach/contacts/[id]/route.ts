import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateContactPatch } from "@/lib/outreach/rules";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 20_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const { data: current } = await service.from("outreach_contacts").select("id, status").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const v = validateContactPatch(body as Record<string, unknown>, current.status);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const update: Record<string, unknown> = { ...v.value, updated_at: new Date().toISOString() };
  if (v.value.status) {
    update.status_changed_at = new Date().toISOString();
    // Putting someone on hold by hand records why; any other status clears the reason.
    update.hold_reason = v.value.status === "held" ? "manual" : null;
  }
  const { error } = await service.from("outreach_contacts").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createServiceClient().from("outreach_contacts").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: "Could not delete the contact." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_contact_deleted", target_table: "outreach_contacts", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
