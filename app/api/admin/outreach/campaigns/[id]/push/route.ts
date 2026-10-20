import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { isUuid } from "@/lib/content/documents";
import { runOutreachPush } from "@/lib/outreach/push";

export const maxDuration = 60;

/** "Send now": hands the next batch of contacts to Saleshandy for one campaign, within the campaign's daily limit (counted per UTC day). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const run = await runOutreachPush({ campaignId: id });
  if (!run.ok) return NextResponse.json({ error: run.error }, { status: 400 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_manual_push", target_table: "outreach_campaigns", target_id: id, metadata: { pushed: run.results[0]?.pushed ?? 0 } });
  return NextResponse.json({ ok: true, result: run.results[0] ?? null });
}
