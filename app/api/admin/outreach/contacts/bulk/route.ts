import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { isHoldReason } from "@/lib/outreach/rules";

/**
 * Bulk decisions on HELD contacts. Releasing needs the typed word RELEASE: it is the moment the admin takes
 * responsibility for emailing people that the safety hold stopped. The database still refuses anyone on the
 * do-not-email list (they come out as unsubscribed/blocked, not active).
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 5_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const b = body as Record<string, unknown>;
  if (!isHoldReason(b.reason)) return NextResponse.json({ error: "Choose which held group to change." }, { status: 400 });

  const now = new Date().toISOString();
  const service = createServiceClient();

  if (b.action === "release_held") {
    if (b.confirm !== "RELEASE") return NextResponse.json({ error: "Type RELEASE to confirm.", field: "confirm" }, { status: 400 });
    const { data, error } = await service
      .from("outreach_contacts")
      .update({ status: "active", hold_reason: null, status_changed_at: now, updated_at: now })
      .eq("status", "held")
      .eq("hold_reason", b.reason)
      .select("id, status");
    if (error) return NextResponse.json({ error: "Could not release the contacts." }, { status: 500 });
    const released = (data ?? []).filter((r) => r.status === "active").length;
    await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_release_held", target_table: "outreach_contacts", target_id: null, metadata: { reason: b.reason, released } });
    return NextResponse.json({ ok: true, changed: released });
  }

  if (b.action === "block_held") {
    const { data, error } = await service
      .from("outreach_contacts")
      .update({ status: "blocked", hold_reason: null, status_changed_at: now, updated_at: now })
      .eq("status", "held")
      .eq("hold_reason", b.reason)
      .select("id");
    if (error) return NextResponse.json({ error: "Could not block the contacts." }, { status: 500 });
    await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_block_held", target_table: "outreach_contacts", target_id: null, metadata: { reason: b.reason, blocked: data?.length ?? 0 } });
    return NextResponse.json({ ok: true, changed: data?.length ?? 0 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
