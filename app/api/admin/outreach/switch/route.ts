import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { readJson } from "@/lib/links/http";
import { setPushEnabled } from "@/lib/outreach/server";

/** The master switch for handing contacts to Saleshandy. OFF until an admin turns it on; turning it off stops the cron and manual pushes at once. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 1_000);
  const enabled = (body as { enabled?: unknown } | null)?.enabled;
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!(await setPushEnabled(enabled, auth.adminId))) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: enabled ? "outreach_switch_on" : "outreach_switch_off", target_table: "site_settings", target_id: null, metadata: {} });
  return NextResponse.json({ ok: true, enabled });
}
