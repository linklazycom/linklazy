import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getLinkLimits, isLinkFeatureOn } from "@/lib/links/server";
import { hashApiKey, hasScope, keyIsUsable, looksLikeApiKey, parseBearer, type ApiScope } from "@/lib/api/keys";

/**
 * Authentication + rate limiting for the public API (Batch 11).
 * Order matters: shape check (no DB) -> throttle failures per IP -> hash lookup -> key state ->
 * owner state -> scope -> per-key rate limit. Every failure uses the same envelope.
 */
export interface ApiCtx {
  userId: string;
  isAdmin: boolean;
  createdAt: string | null;
  keyId: string;
}

export function apiError(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const UNAUTH = { "WWW-Authenticate": 'Bearer realm="LinkLazy API"' };

export async function authenticateApi(request: Request, scope: ApiScope): Promise<{ error: NextResponse } | { ctx: ApiCtx }> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return { error: apiError(401, "missing_key", "Send your API key as 'Authorization: Bearer <key>'.", UNAUTH) };

  const ip = getRequestIp(request);
  // Failed attempts are throttled per IP so the endpoint cannot be used to guess keys.
  if (!looksLikeApiKey(token)) {
    const { allowed } = await checkRateLimit("api_auth_fail", ip, { max: 30, windowMinutes: 10 });
    return { error: allowed ? apiError(401, "invalid_key", "The API key is not valid.", UNAUTH) : apiError(429, "rate_limited", "Too many failed attempts. Try again later.", { "Retry-After": "600" }) };
  }

  const svc = createServiceClient();
  const { data: key } = await svc
    .from("api_keys")
    .select("id, user_id, scopes, revoked_at, expires_at, last_used_at")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();

  if (!key || !keyIsUsable(key)) {
    const { allowed } = await checkRateLimit("api_auth_fail", ip, { max: 30, windowMinutes: 10 });
    return { error: allowed ? apiError(401, "invalid_key", "The API key is not valid, expired or revoked.", UNAUTH) : apiError(429, "rate_limited", "Too many failed attempts. Try again later.", { "Retry-After": "600" }) };
  }

  const [{ data: profile }, { data: authUser }, featureOn, limits] = await Promise.all([
    svc.from("profiles").select("role, is_banned, is_suspended").eq("id", key.user_id).maybeSingle(),
    svc.auth.admin.getUserById(key.user_id),
    isLinkFeatureOn(),
    getLinkLimits(),
  ]);
  if (profile?.is_banned || profile?.is_suspended) return { error: apiError(403, "account_disabled", "This account cannot use the API.") };
  if (!featureOn) return { error: apiError(503, "feature_off", "Link management is currently turned off.") };
  if (!hasScope(key.scopes ?? [], scope)) return { error: apiError(403, "insufficient_scope", `This key does not have the '${scope}' scope.`) };

  const perMinute = limits.api_rate_per_minute;
  const { allowed } = await checkRateLimit("api_key", key.id, { max: perMinute, windowMinutes: 1 });
  if (!allowed) {
    return { error: apiError(429, "rate_limited", `Rate limit exceeded (${perMinute} requests per minute per key).`, { "Retry-After": "30", "X-RateLimit-Limit": String(perMinute) }) };
  }

  // Record "last used" at most every 10 minutes, off the request path.
  const stale = !key.last_used_at || Date.now() - Date.parse(key.last_used_at) > 10 * 60_000;
  if (stale) {
    after(async () => {
      await createServiceClient().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
    });
  }

  return { ctx: { userId: key.user_id, isAdmin: profile?.role === "admin", createdAt: authUser?.user?.created_at ?? null, keyId: key.id } };
}
