import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanText } from "@/lib/links/fields";

const schema = z.object({
  action: z.enum(["takedown", "dismiss"]),
  note: z.string().max(500).nullish(),
  flag_owner: z.boolean().optional(),
});

/** Resolves an abuse report: take the link down (closing all open reports for it) or dismiss. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const note = cleanText(parsed.data.note, 500);
  const now = new Date().toISOString();

  const svc = createServiceClient();
  const { data: report } = await svc.from("link_reports").select("id, link_id, slug, status").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status !== "open") return NextResponse.json({ error: "This report was already handled." }, { status: 409 });

  if (parsed.data.action === "dismiss") {
    await svc.from("link_reports").update({ status: "dismissed", handled_by: adminId, handled_at: now, admin_note: note }).eq("id", id);
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: "link_report_dismissed", target_table: "link_reports", target_id: id, metadata: { slug: report.slug, note } });
    return NextResponse.json({ ok: true });
  }

  if (report.link_id) {
    const { data: link } = await svc.from("short_links").select("user_id, disabled_reason").eq("id", report.link_id).maybeSingle();
    if (link) {
      if (!link.disabled_reason) {
        await svc
          .from("short_links")
          .update({ disabled_reason: "admin_takedown", disabled_at: now, disabled_note: note ?? `Abuse report ${id}`, updated_at: now })
          .eq("id", report.link_id);
      }
      if (parsed.data.flag_owner) {
        await supabase
          .from("profiles")
          .update({ is_flagged: true, flag_reason: note ?? "Short-link abuse", flagged_at: now, flagged_by: adminId })
          .eq("id", link.user_id);
      }
    }
    // One takedown settles every open report about the same link.
    await svc
      .from("link_reports")
      .update({ status: "actioned", handled_by: adminId, handled_at: now, admin_note: note })
      .eq("link_id", report.link_id)
      .eq("status", "open");
  } else {
    await svc.from("link_reports").update({ status: "actioned", handled_by: adminId, handled_at: now, admin_note: note }).eq("id", id);
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "link_report_takedown",
    target_table: "link_reports",
    target_id: id,
    metadata: { slug: report.slug, note, flag_owner: !!parsed.data.flag_owner },
  });
  return NextResponse.json({ ok: true });
}
