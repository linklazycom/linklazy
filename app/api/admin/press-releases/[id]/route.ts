import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";

const schema = z.object({ status: z.enum(["pending_review", "awaiting_content", "in_progress", "submitted_to_media", "published", "cancelled"]), admin_note: z.string().trim().max(2000).nullable().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { supabase } = admin;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const { id } = await params;
  const { error } = await supabase.from("press_release_orders").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
