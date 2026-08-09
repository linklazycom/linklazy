import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const savedSearchSchema = z.object({
  name: z.string().trim().max(200).optional(),
  filters: z.record(z.string(), z.unknown()),
  email_alerts: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = savedSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase.from("saved_searches").insert({
    user_id: user.id,
    name: parsed.data.name || null,
    filters: parsed.data.filters,
    email_alerts: parsed.data.email_alerts,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
