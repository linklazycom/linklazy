import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanText } from "@/lib/links/fields";

const schema = z.object({
  action: z.enum(["takedown", "restore"]),
  note: z.string().max(500).nullish(),
  flag_owner: z.boolean().optional(),
});

/** Admin takedown / restore of a single short link. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { action, flag_owner } = parsed.data;
  const note = cleanText(parsed.data.note, 500);

  const svc = createServiceClient();
  const { data: link } = await svc.from("short_links").select("id, user_id, slug, disabled_reason").eq("id", id).maybeSingle();
  if (!link) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  // owner_banned is managed automatically by the ban trigger — don't let a manual restore fight it.
  if (action === "restore" && link.disabled_reason === "owner_banned") {
    return NextResponse.json({ error: "This link is off because its owner is banned or suspended. Unban the user instead." }, { status: 409 });
  }

  const patch =
    action === "takedown"
      ? { disabled_reason: "admin_takedown", disabled_at: new Date().toISOString(), disabled_note: note, updated_at: new Date().toISOString() }
      : { disabled_reason: null, disabled_at: null, disabled_note: null, updated_at: new Date().toISOString() };
  const { error } = await svc.from("short_links").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update the link." }, { status: 500 });

  if (action === "takedown" && flag_owner) {
    await supabase
      .from("profiles")
      .update({ is_flagged: true, flag_reason: note ?? "Short-link abuse", flagged_at: new Date().toISOString(), flagged_by: adminId })
      .eq("id", link.user_id);
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: action === "takedown" ? "link_takedown" : "link_restore",
    target_table: "short_links",
    target_id: id,
    metadata: { slug: link.slug, note, flag_owner: !!flag_owner },
  });
  return NextResponse.json({ ok: true });
}
