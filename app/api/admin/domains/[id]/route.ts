import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { readJson } from "@/lib/links/http";
import { adminSetDomainStatus, removeDomain } from "@/lib/domains/service";

const UUID = z.string().uuid();
const schema = z.object({ action: z.enum(["disable", "enable", "mark_active"]), note: z.string().max(300).nullish() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const parsed = schema.safeParse(await readJson(request, 5_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const res = await adminSetDomainStatus(id, parsed.data.action, parsed.data.note ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await admin.supabase.from("admin_logs").insert({ admin_id: admin.adminId, action: `domain_${parsed.data.action}`, target_table: "custom_domains", target_id: id, metadata: { note: parsed.data.note ?? null } });
  return NextResponse.json({ domain: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const res = await removeDomain(null, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await admin.supabase.from("admin_logs").insert({ admin_id: admin.adminId, action: "domain_delete", target_table: "custom_domains", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
