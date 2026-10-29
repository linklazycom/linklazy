import { NextResponse } from "next/server";
import { limiterFor } from "@/lib/limiter-registry";
import { getRequestIp } from "@/lib/rate-limit";

/**
 * Best-effort per-instance limit for cheap, hot PUBLIC routes (search box, ad slot, currency rate...).
 * One limiter per route name. Returns a 429 response when the caller is over the limit, otherwise null.
 * Not a global guarantee (see lib/memory-rate-limit.ts); money, AI and scan routes use the DB limiter instead.
 */
export function publicLimit(request: Request, name: string, max = 60, windowMs = 60_000): NextResponse | null {
  if (limiterFor(name, max, windowMs).allow(getRequestIp(request))) return null;
  return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } });
}
