import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateTestimonial } from "@/lib/growth/testimonials";

/** Adds a testimonial (Batch 18). It can only be published together with the admin's confirmation that the person agreed. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const body = await readJson(request, 10_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateTestimonial(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const { data, error } = await createServiceClient().from("testimonials").insert({ ...v.value, created_by: auth.adminId }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Could not save. Has SQL 057 been run?" }, { status: 500 });
  await auth.supabase.from("admin_logs").insert({ admin_id: auth.adminId, action: "testimonial_create", target_table: "testimonials", target_id: data.id as string, metadata: { published: v.value.is_published } });
  return NextResponse.json({ ok: true, id: data.id });
}
