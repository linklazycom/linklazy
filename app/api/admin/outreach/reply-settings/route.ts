import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { OUTREACH_INBOX_LINK_KEY, OUTREACH_NOTIFY_KEY, validateInboxTemplate } from "@/lib/outreach/notify";

const schema = z.object({ notify: z.boolean(), inbox_link_template: z.string().max(1000).nullish() });

/** Saves the reply-alert switch and the Saleshandy conversation link template (Batch 23C). */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const parsed = schema.safeParse(await readJson(request, 5_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const template = validateInboxTemplate(parsed.data.inbox_link_template ?? "");
  if (!template.ok) return NextResponse.json({ error: template.message, field: "inbox_link_template" }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert([
      { key: OUTREACH_NOTIFY_KEY, value: parsed.data.notify, updated_by: auth.adminId, updated_at: now },
      { key: OUTREACH_INBOX_LINK_KEY, value: template.value, updated_by: auth.adminId, updated_at: now },
    ]);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
