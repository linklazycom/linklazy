import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { normalizeSlug, isPlausibleSlug } from "@/lib/links/slug";
import { evaluateRedirect } from "@/lib/links/rules";
import { isSafeRedirectTarget, hostMatchesDomain } from "@/lib/links/url";
import { verifyLinkPassword } from "@/lib/links/password";
import { isLikelyBot } from "@/lib/links/bot";
import { getLinkBlocklist, isLinkFeatureOn, ownHosts } from "@/lib/links/server";
import { buildClickRecord } from "@/lib/analytics/click";
import { getHashSecret } from "@/lib/analytics/visitor";
import { renderPasswordPage, renderStatePage, stateHttpStatus, type StatePage } from "@/lib/links/pages";

/**
 * The one redirect pipeline, shared by linklazy.com/l/<slug> (Batch 9) and customer custom
 * domains (Batch 11). Every rule (takedown, expiry, click limit, password, blocklist, bot
 * filtering, click logging) is identical on both; the only differences are in RedirectContext.
 */
export interface RedirectContext {
  /** Custom domains only: a slug resolves only when it belongs to this user. */
  ownerId?: string;
  /** Absolute LinkLazy URL for links on state pages; empty on linklazy.com itself. */
  base?: string;
  /** Where the password form posts to. */
  passwordAction?: string;
  /** Extra hostnames that count as "ours" when classifying referrers. */
  extraOwnHosts?: string[];
}

// Never cached: every visit must be counted and every limit/expiry/takedown enforced.
export const REDIRECT_HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export function htmlResponse(html: string, status: number) {
  return new NextResponse(html, { status, headers: { ...REDIRECT_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}

export function stateResponse(state: StatePage, slug?: string, base = "") {
  return htmlResponse(renderStatePage(state, slug, base), stateHttpStatus(state));
}

export async function handleRedirect(request: Request, rawSlug: string, password: string | null, ctx: RedirectContext = {}) {
  const base = ctx.base ?? "";
  const slug = normalizeSlug(rawSlug);
  if (!isPlausibleSlug(slug)) return stateResponse("not_found", undefined, base);
  if (!(await isLinkFeatureOn())) return stateResponse("unavailable", undefined, base);

  const svc = createServiceClient();
  let q = svc
    .from("short_links")
    .select("id, destination_url, is_active, has_password, expires_at, max_clicks, click_count, disabled_reason")
    .eq("slug", slug);
  if (ctx.ownerId) q = q.eq("user_id", ctx.ownerId);
  const { data: link, error } = await q.maybeSingle();
  if (error) return stateResponse("unavailable", undefined, base);
  if (!link) return stateResponse("not_found", undefined, base);

  const decision = evaluateRedirect(link);
  if (decision.action === "block") return stateResponse(decision.reason, slug, base);

  // Defence in depth: only http(s), and re-check the admin blocklist on every visit
  // so a newly blocked domain stops working for links created earlier.
  if (!isSafeRedirectTarget(link.destination_url)) return stateResponse("taken_down", slug, base);
  const blocklist = await getLinkBlocklist();
  const host = new URL(link.destination_url).hostname;
  if (blocklist.domains.some((d) => hostMatchesDomain(host, d))) return stateResponse("taken_down", slug, base);

  const passwordOpts = { action: ctx.passwordAction, base };
  if (decision.action === "ask_password") {
    if (password === null) return htmlResponse(renderPasswordPage(slug, undefined, passwordOpts), 200);
    const { allowed } = await checkRateLimit("link_password", `${getRequestIp(request)}:${slug}`, { max: 10, windowMinutes: 15 });
    if (!allowed) return htmlResponse(renderPasswordPage(slug, "Too many attempts. Please try again later.", passwordOpts), 429);
    const { data: secret } = await svc.from("short_link_secrets").select("password_hash").eq("link_id", link.id).maybeSingle();
    if (!secret || !verifyLinkPassword(password, secret.password_hash)) {
      return htmlResponse(renderPasswordPage(slug, "Wrong password. Please try again.", passwordOpts), 401);
    }
  }

  // Count + log the visit. Bots / link-preview fetchers / HEAD requests never use up a click.
  const userAgent = request.headers.get("user-agent");
  const counts = request.method !== "HEAD" && !isLikelyBot(userAgent);
  if (counts) {
    const click = buildClickRecord({
      url: request.url,
      ip: getRequestIp(request),
      userAgent,
      referer: request.headers.get("referer"),
      country: request.headers.get("x-vercel-ip-country"),
      secret: getHashSecret(),
      ownHosts: [...ownHosts(), ...(ctx.extraOwnHosts ?? [])],
    });
    const args = {
      p_link_id: link.id,
      p_source: click.source,
      p_country: click.country,
      p_device: click.device,
      p_browser: click.browser,
      p_referrer: click.referrer_host,
      p_visitor: click.visitor_hash,
    };
    if (link.max_clicks !== null) {
      // Click-limited links must be counted atomically BEFORE redirecting.
      const { data: ok, error: rpcError } = await svc.rpc("record_link_click", args);
      if (rpcError) console.error("record_link_click failed:", rpcError.message); // fail open: still redirect
      else if (ok === false) return stateResponse("limit_reached", slug, base);
    } else {
      after(async () => {
        const { error: rpcError } = await createServiceClient().rpc("record_link_click", args);
        if (rpcError) console.error("record_link_click failed:", rpcError.message);
      });
    }
  }

  return NextResponse.redirect(link.destination_url, { status: request.method === "POST" ? 303 : 302, headers: REDIRECT_HEADERS });
}

export async function readPasswordField(request: Request): Promise<string> {
  try {
    const form = await request.formData();
    const v = form.get("password");
    if (typeof v === "string") return v.slice(0, 100);
  } catch {
    /* treated as an empty (wrong) password */
  }
  return "";
}
