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

// Never cached: every visit must be counted and every limit/expiry/takedown enforced.
export const dynamic = "force-dynamic";

const BASE_HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, { status, headers: { ...BASE_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}
function stateResponse(state: StatePage, slug?: string) {
  return htmlResponse(renderStatePage(state, slug), stateHttpStatus(state));
}

async function handle(request: Request, rawSlug: string, password: string | null) {
  const slug = normalizeSlug(rawSlug);
  if (!isPlausibleSlug(slug)) return stateResponse("not_found");
  if (!(await isLinkFeatureOn())) return stateResponse("unavailable");

  const svc = createServiceClient();
  const { data: link, error } = await svc
    .from("short_links")
    .select("id, destination_url, is_active, has_password, expires_at, max_clicks, click_count, disabled_reason")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return stateResponse("unavailable");
  if (!link) return stateResponse("not_found");

  const decision = evaluateRedirect(link);
  if (decision.action === "block") return stateResponse(decision.reason, slug);

  // Defence in depth: only http(s), and re-check the admin blocklist on every visit
  // so a newly blocked domain stops working for links created earlier.
  if (!isSafeRedirectTarget(link.destination_url)) return stateResponse("taken_down", slug);
  const blocklist = await getLinkBlocklist();
  const host = new URL(link.destination_url).hostname;
  if (blocklist.domains.some((d) => hostMatchesDomain(host, d))) return stateResponse("taken_down", slug);

  if (decision.action === "ask_password") {
    if (password === null) return htmlResponse(renderPasswordPage(slug), 200);
    const { allowed } = await checkRateLimit("link_password", `${getRequestIp(request)}:${slug}`, { max: 10, windowMinutes: 15 });
    if (!allowed) return htmlResponse(renderPasswordPage(slug, "Too many attempts. Please try again later."), 429);
    const { data: secret } = await svc.from("short_link_secrets").select("password_hash").eq("link_id", link.id).maybeSingle();
    if (!secret || !verifyLinkPassword(password, secret.password_hash)) {
      return htmlResponse(renderPasswordPage(slug, "Wrong password. Please try again."), 401);
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
      ownHosts: ownHosts(),
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
      else if (ok === false) return stateResponse("limit_reached", slug);
    } else {
      after(async () => {
        const { error: rpcError } = await createServiceClient().rpc("record_link_click", args);
        if (rpcError) console.error("record_link_click failed:", rpcError.message);
      });
    }
  }

  return NextResponse.redirect(link.destination_url, { status: request.method === "POST" ? 303 : 302, headers: BASE_HEADERS });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(request, (await params).slug, null);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(request, (await params).slug, null);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  let password = "";
  try {
    const form = await request.formData();
    const v = form.get("password");
    if (typeof v === "string") password = v.slice(0, 100);
  } catch {
    /* treated as an empty (wrong) password */
  }
  return handle(request, (await params).slug, password);
}
