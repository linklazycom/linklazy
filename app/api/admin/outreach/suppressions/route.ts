import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanLine } from "@/lib/projects/rules";
import { normalizeEmail } from "@/lib/outreach/email";
import { chunk } from "@/lib/outreach/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Adds pasted addresses to the do-not-email list. The database then moves any matching contact out of active/held. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 400_000);
  if (!body || typeof body !== "object" || typeof (body as { emails?: unknown }).emails !== "string") {
    return NextResponse.json({ error: "Paste at least one email address." }, { status: 400 });
  }
  const b = body as { emails: string; note?: unknown };
  const tokens = b.emails.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length > 5000) return NextResponse.json({ error: "Please add at most 5000 addresses at a time." }, { status: 400 });

  const emails: string[] = [];
  let invalid = 0;
  for (const t of tokens) {
    const e = normalizeEmail(t);
    // System mailboxes (abuse@, no-reply@...) are refused as contacts but are fine on a do-not-email list.
    const value = e.ok ? e.email : t.includes("@") ? t.trim().toLowerCase() : null;
    if (!value || value.length > 254 || !/^[^@\s]+@[^@\s]+$/.test(value)) {
      invalid++;
      continue;
    }
    if (!emails.includes(value)) emails.push(value);
  }
  if (emails.length === 0) return NextResponse.json({ error: "None of those look like email addresses.", invalid }, { status: 400 });

  const note = cleanLine(b.note, 300);
  const service = createServiceClient();
  let added = 0;
  for (const group of chunk(emails, 500)) {
    const { data, error } = await service
      .from("outreach_suppressions")
      .upsert(group.map((email) => ({ email, reason: "manual", note, created_by: auth.adminId })), { onConflict: "email", ignoreDuplicates: true })
      .select("id");
    if (error) return NextResponse.json({ error: "Could not save the list. Please try again." }, { status: 500 });
    added += data?.length ?? 0;
  }
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_suppress_added", target_table: "outreach_suppressions", target_id: null, metadata: { added, invalid } });
  return NextResponse.json({ ok: true, added, alreadyListed: emails.length - added, invalid });
}

/** Only "manual" entries can be removed. Unsubscribes, bounces and complaints are permanent. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createServiceClient().from("outreach_suppressions").delete().eq("id", id).eq("reason", "manual").select("id");
  if (error) return NextResponse.json({ error: "Could not remove the entry." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Only manual entries can be removed." }, { status: 404 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "outreach_suppress_removed", target_table: "outreach_suppressions", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
