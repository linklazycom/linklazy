import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payPerViewSchema = z.object({
  pay_per_view_enabled: z.boolean(),
  view_price: z.coerce.number().int().min(50).max(500).nullable().optional(),
  access_duration_days: z.coerce.number().int().min(1).nullable().optional(), // null = lifetime
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id")
    .eq("id", siteId)
    .single();

  if (!site || site.owner_id !== user.id) {
    return NextResponse.json({ error: "Site not found or not owned by you." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = payPerViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { pay_per_view_enabled, view_price, access_duration_days } = parsed.data;

  if (pay_per_view_enabled && !view_price) {
    return NextResponse.json(
      { error: "Set a view price (৳50-500) to enable pay-per-view." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("sites")
    .update({
      pay_per_view_enabled,
      view_price: pay_per_view_enabled ? view_price : null,
      access_duration_days: access_duration_days ?? null,
    })
    .eq("id", siteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
