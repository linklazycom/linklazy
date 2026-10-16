import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanText } from "@/lib/links/fields";

const schema = z.object({ action: z.enum(["takedown", "restore"]), note: z.string().max(500).nullish(), flag_owner: z.boolean().optional() });

/** Admin takedown / restore of a bio page. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const note = cleanText(parsed.data.note, 500);
  const now = new Date().toISOString();

  const svc = createServiceClient();
  const { data: page } = await svc.from("bio_pages").select("id, user_id, slug, disabled_reason").eq("id", id).maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  if (parsed.data.action === "restore" && page.disabled_reason === "owner_banned") {
    return NextResponse.json({ error: "This page is off because its owner is banned or suspended. Unban the user instead." }, { status: 409 });
  }

  const patch =
    parsed.data.action === "takedown"
      ? { disabled_reason: "admin_takedown", disabled_at: now, disabled_note: note, updated_at: now }
      : { disabled_reason: null, disabled_at: null, disabled_note: null, updated_at: now };
  const { error } = await svc.from("bio_pages").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update the page." }, { status: 500 });

  if (parsed.data.action === "takedown" && parsed.data.flag_owner) {
    await supabase.from("profiles").update({ is_flagged: true, flag_reason: note ?? "Bio page abuse", flagged_at: now, flagged_by: adminId }).eq("id", page.user_id);
  }
  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: parsed.data.action === "takedown" ? "bio_takedown" : "bio_restore",
    target_table: "bio_pages",
    target_id: id,
    metadata: { slug: page.slug, note, flag_owner: !!parsed.data.flag_owner },
  });
  return NextResponse.json({ ok: true });
}
