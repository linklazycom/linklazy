import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getUnsubscribeSecret, parseUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/outreach/token";

/**
 * Public unsubscribe (Batch 16B-1). Works for the confirm button on /unsubscribe/<token> and for the one-click
 * POST that mail apps send for the List-Unsubscribe header (token in the query string, RFC 8058).
 * Safe to repeat. A GET never unsubscribes anyone: mail scanners open links, only a POST counts.
 */
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const { allowed } = await checkRateLimit("outreach_unsubscribe", ip, { max: 30, windowMinutes: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  let token: unknown = new URL(request.url).searchParams.get("t");
  if (!token) {
    try {
      const text = await request.text();
      if (text.length < 2000) token = (JSON.parse(text) as { token?: unknown }).token;
    } catch {
      /* not JSON (e.g. the form-encoded one-click body): the token was in the query string */
    }
  }

  const secret = getUnsubscribeSecret();
  const parsed = parseUnsubscribeToken(token);
  if (!secret || !parsed) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });

  const service = createServiceClient();
  const { data: contact } = await service.from("outreach_contacts").select("id, email").eq("id", parsed.id).maybeSingle();
  // Same answer for "no such contact" and "bad signature": nothing is revealed about who is on the list.
  if (!contact || !verifyUnsubscribeToken(secret, parsed, contact.email)) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });

  const { error } = await service
    .from("outreach_suppressions")
    .upsert({ email: contact.email, reason: "unsubscribe", note: null }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
