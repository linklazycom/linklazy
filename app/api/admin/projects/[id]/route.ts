import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanText } from "@/lib/links/fields";
import { notifyProjectOwner } from "@/lib/projects/suspension";

const schema = z.object({ action: z.enum(["suspend", "restore"]), note: z.string().max(500).nullish() });

/** Admin pause / restore of one project (Batch 23B). Needs SQL 071. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { action } = parsed.data;
  const note = cleanText(parsed.data.note, 500);

  const svc = createServiceClient();
  const { data: project } = await svc.from("projects").select("id, user_id, name, domain").eq("id", id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const patch =
    action === "suspend"
      ? { suspended_at: new Date().toISOString(), suspended_reason: note, suspended_by: adminId, updated_at: new Date().toISOString() }
      : { suspended_at: null, suspended_reason: null, suspended_by: null, updated_at: new Date().toISOString() };
  const { error } = await svc.from("projects").update(patch).eq("id", id);
  if (error) {
    const missing = /suspended_|column/i.test(error.message);
    return NextResponse.json({ error: missing ? "Run SQL 071 first (it adds the pause columns)." : "Could not update the project." }, { status: missing ? 409 : 500 });
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: action === "suspend" ? "project_suspend" : "project_restore",
    target_table: "projects",
    target_id: id,
    metadata: { domain: project.domain, note },
  });
  // Tell the owner (best effort; the pause itself never depends on the email).
  const emailSent = await notifyProjectOwner(svc, project.user_id as string, action, { name: project.name as string, note });
  return NextResponse.json({ ok: true, emailSent });
}
