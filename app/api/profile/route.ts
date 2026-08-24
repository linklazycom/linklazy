import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  bio: z.string().trim().max(1000).optional(),
  country: z.string().trim().max(100).optional(),
  display_name: z.string().trim().max(100).optional(),
  avatar_url: z.string().url().max(600).optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
