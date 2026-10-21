import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One click "do not email this person again" for someone who asked to stop (Batch 16B-3).
 * Puts the address on the do-not-email list (the database then moves the contact out of active) and closes the ticket.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const service = createServiceClient();
  const { data: ticket } = await service.from("outreach_tickets").select("id, email").eq("id", id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error } = await service
    .from("outreach_suppressions")
    .upsert({ email: ticket.email as string, reason: "manual", note: "asked to stop (reply ticket)", created_by: auth.adminId }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Could not add the address to the do-not-email list." }, { status: 500 });

  const now = new Date().toISOString();
  await service.from("outreach_tickets").update({ status: "closed", closed_at: now, updated_at: now }).eq("id", id);
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_ticket_stop", target_table: "outreach_tickets", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
