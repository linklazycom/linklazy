import { createServiceClient } from "@/lib/supabase/service";

/**
 * Simple DB-backed rate limiter for public, unauthenticated write routes
 * (contact form, guest support tickets) where there's no user_id to key
 * off of — only a request IP. Not meant for high-traffic hot paths; this
 * is a spam-prevention floor, not a general-purpose limiter.
 */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  opts: { max: number; windowMinutes: number }
): Promise<{ allowed: boolean }> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - opts.windowMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("identifier", identifier)
    .gte("created_at", since);

  if ((count ?? 0) >= opts.max) {
    return { allowed: false };
  }

  await supabase.from("rate_limit_events").insert({ bucket, identifier });
  return { allowed: true };
}

/**
 * Best-effort request IP extraction behind Vercel's proxy. Falls back to
 * a constant so a missing header degrades to "one shared bucket" instead
 * of throwing.
 */
export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
