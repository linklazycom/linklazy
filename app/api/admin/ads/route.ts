import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";

const adSlotSchema = z
  .object({
    placement: z.string().trim().min(1).max(100),
    kind: z.enum(["image_link", "html"]),
    image_url: z.string().url().optional(),
    link_url: z.string().url().optional(),
    html_code: z.string().trim().max(20000).optional(),
    alt_text: z.string().trim().max(200).optional(),
    active: z.boolean().default(true),
    sort_order: z.number().int().default(0),
  })
  .refine(
    (v) => (v.kind === "image_link" ? !!v.image_url : !!v.html_code),
    { message: "image_link needs image_url; html needs html_code" }
  );

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }
  const { data, error } = await check.supabase
    .from("ad_slots")
    .select("*")
    .order("placement", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }

  const body = await request.json();
  const parsed = adSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await check.supabase.from("ad_slots").insert(parsed.data);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
