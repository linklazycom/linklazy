import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  message: z.string().trim().min(1).max(3000),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const { allowed } = await checkRateLimit("contact", ip, { max: 5, windowMinutes: 60 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages sent. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert(parsed.data);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
