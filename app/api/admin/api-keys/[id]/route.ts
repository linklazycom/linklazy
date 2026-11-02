import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanText } from "@/lib/links/fields";
import { notifyApiKeyOwner } from "@/lib/api/admin-notice";

const schema = z.object({ action: z.literal("revoke"), note: z.string().max(500).nullish() });

/** Admin revoke of one API key (Batch 23B). A revoked key stops working at once and cannot be switched back on; the owner makes a new one. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const note = cleanText(parsed.data.note, 500);

  const svc = createServiceClient();
  const { data: key } = await svc.from("api_keys").select("id, user_id, name, key_prefix, revoked_at").eq("id", id).maybeSingle();
  if (!key) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  if (key.revoked_at) return NextResponse.json({ error: "This key is already revoked." }, { status: 409 });

  const { error } = await svc.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Could not revoke the key." }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "api_key_revoke",
    target_table: "api_keys",
    target_id: id,
    metadata: { key_prefix: key.key_prefix, name: key.name, note },
  });
  const emailSent = await notifyApiKeyOwner(svc, key.user_id as string, { name: key.name as string, prefix: key.key_prefix as string, note });
  return NextResponse.json({ ok: true, emailSent });
}
