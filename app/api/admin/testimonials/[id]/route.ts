import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateTestimonial } from "@/lib/growth/testimonials";
import { isUuid } from "@/lib/opportunities/rules";

/** Edits, publishes/unpublishes or deletes one testimonial. Publishing always re-checks the permission confirmation. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 10_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const db = createServiceClient();
  const { data: existing } = await db.from("testimonials").select("author_name, author_role, author_site, quote, source_note, consent_confirmed, is_published, sort_order").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // A partial change (for example only is_published) is merged onto the saved record, then validated as a whole.
  const merged = { ...existing, ...(body as Record<string, unknown>) };
  const v = validateTestimonial(merged);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const { error } = await db.from("testimonials").update({ ...v.value, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "testimonial_update", target_table: "testimonials", target_id: id, metadata: { published: v.value.is_published } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createServiceClient().from("testimonials").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "testimonial_delete", target_table: "testimonials", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
