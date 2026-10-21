import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateTicketPatch } from "@/lib/outreach/reply";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Changes a ticket's status and/or adds a private note (Batch 16B-3). Admin only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 20_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const v = validateTicketPatch(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const service = createServiceClient();
  const { data: ticket } = await service.from("outreach_tickets").select("id").eq("id", id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date().toISOString();
  if (v.value.status) {
    const { error } = await service
      .from("outreach_tickets")
      .update({ status: v.value.status, closed_at: v.value.status === "closed" ? now : null, updated_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  }
  if (v.value.note) {
    const { error } = await service.from("outreach_ticket_messages").insert({ ticket_id: id, kind: "note", body: v.value.note, created_by: auth.adminId });
    if (error) return NextResponse.json({ error: "Could not save the note." }, { status: 500 });
    await service.from("outreach_tickets").update({ updated_at: now }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
