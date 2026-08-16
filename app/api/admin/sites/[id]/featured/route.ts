import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({ is_featured: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;
  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from("sites").update({ is_featured: parsed.data.is_featured }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: parsed.data.is_featured ? "site_featured" : "site_unfeatured",
    target_table: "sites",
    target_id: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
