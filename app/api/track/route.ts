import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeTrackPayload, TRACK_LIMITS } from "@/lib/track-payload";
import { createMemoryRateLimiter } from "@/lib/memory-rate-limit";

// Best-effort per-instance limit: 60 beacons / minute / client IP. A real
// visitor sends about one beacon per page navigation.
const limiter = createMemoryRateLimiter({ max: 60, windowMs: 60_000 });

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function POST(request: Request) {
  // Analytics must never break a page, so over-limit / junk input still
  // answers 200 — but nothing is written.
  if (!limiter.allow(clientIp(request))) return NextResponse.json({ ok: true });

  const raw = await request.text().catch(() => "");
  if (raw.length > TRACK_LIMITS.body) return NextResponse.json({ ok: true });

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const payload = sanitizeTrackPayload(parsed);
  if (!payload) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("page_views").insert({ ...payload, user_id: user?.id ?? null });

  return NextResponse.json({ ok: true });
}
