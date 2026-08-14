import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pressReleaseProductSchema } from "@/lib/validators/press-release-product";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { supabase };
}

export async function GET() {
  const access = await requireAdmin(); if (access.error) return access.error;
  const { data, error } = await access.supabase.from("press_release_products").select("*").order("sort_order").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const access = await requireAdmin(); if (access.error) return access.error;
  const parsed = pressReleaseProductSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { data, error } = await access.supabase.from("press_release_products").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
