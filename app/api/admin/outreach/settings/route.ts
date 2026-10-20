import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { OUTREACH_SENDER_ADDRESS_KEY, OUTREACH_SENDER_NAME_KEY, validateSenderIdentity } from "@/lib/outreach/sender";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 5_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateSenderIdentity(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert([
      { key: OUTREACH_SENDER_NAME_KEY, value: v.value.name, updated_by: auth.adminId, updated_at: now },
      { key: OUTREACH_SENDER_ADDRESS_KEY, value: v.value.address, updated_by: auth.adminId, updated_at: now },
    ]);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
