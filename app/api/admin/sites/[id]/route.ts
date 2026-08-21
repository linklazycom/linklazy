import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { siteSubmissionSchema } from "@/lib/validators/site";

// Same field set as new-site submission, but every field optional since
// this is a partial edit — only send what changed.
const editSchema = siteSubmissionSchema.partial();

/**
 * Full-detail edit for an already-listed site — niche, language, metrics,
 * price, link terms, guidelines, etc. The admin site detail page already
 * covers approve/reject, DR re-check, featured toggle, and owner
 * reassignment; this fills the gap of actually correcting a listing's own
 * fields (e.g. a seller's self-reported DA/traffic turned out wrong, or a
 * price/niche needs correcting) without deleting and re-creating the site.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }
  const { adminId, supabase } = check;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: before } = await serviceClient.from("sites").select("domain").eq("id", id).single();
  if (!before) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: site, error } = await serviceClient
    .from("sites")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "site_edited",
    target_table: "sites",
    target_id: id,
    metadata: { domain: before.domain, fields_changed: Object.keys(parsed.data) },
  });

  return NextResponse.json({ site });
}
