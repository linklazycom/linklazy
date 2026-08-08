import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const slotSchema = z.object({
  label: z.string().trim().min(1),
  link_type: z.enum(["dofollow", "nofollow"]),
  placement: z.enum(["in_content", "author_bio", "homepage", "sidebar"]),
  max_concurrent_orders: z.coerce.number().int().min(1).default(1),
  price_amount: z.coerce.number().int().min(0).optional(),
  accepts_exchange: z.boolean().default(true),
  accepts_paid: z.boolean().default(true),
  content_provided_by: z.enum(["seller", "buyer"]).default("seller"),
});

export async function POST(
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
    .select("owner_id")
    .eq("id", siteId)
    .single();

  if (!site || site.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = slotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase
    .from("site_link_slots")
    .insert({ ...parsed.data, site_id: siteId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
