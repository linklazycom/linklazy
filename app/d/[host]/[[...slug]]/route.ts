import { NextResponse } from "next/server";
import { handleRedirect, readPasswordField, stateResponse, REDIRECT_HEADERS } from "@/lib/links/redirect";
import { getActiveDomain } from "@/lib/domains/resolve";
import { normalizeHostHeader } from "@/lib/domains/host";
import { isSafeRedirectTarget } from "@/lib/links/url";
import { isLinkFeatureOn, siteUrl } from "@/lib/links/server";

// Custom-domain entry point. proxy.ts rewrites EVERY path on a customer domain to /d/<host>/<path>,
// so nothing else of the app (login, dashboard, API ...) is ever served from a customer's domain.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ host: string; slug?: string[] }> };

async function handle(request: Request, { params }: Ctx, password: string | null) {
  const { host: rawHost, slug } = await params;
  const host = normalizeHostHeader(decodeURIComponent(rawHost));
  const base = siteUrl();

  // Defence in depth: the real Host header must match the path. Opening /d/<host>/... on
  // linklazy.com (or spoofing the path) therefore never resolves a customer domain.
  if (normalizeHostHeader(request.headers.get("host")) !== host) return stateResponse("not_found", undefined, base);

  const domain = await getActiveDomain(host);
  if (!domain) return stateResponse("not_found", undefined, base);
  if (!(await isLinkFeatureOn())) return stateResponse("unavailable", undefined, base);

  const segments = slug ?? [];
  if (segments.length === 0) {
    // Bare domain: optional owner-chosen landing redirect, otherwise a neutral "not found" page.
    if (domain.root_redirect_url && isSafeRedirectTarget(domain.root_redirect_url)) {
      return NextResponse.redirect(domain.root_redirect_url, { status: 302, headers: REDIRECT_HEADERS });
    }
    return stateResponse("not_found", undefined, base);
  }
  if (segments.length > 1) return stateResponse("not_found", undefined, base);

  return handleRedirect(request, segments[0], password, {
    ownerId: domain.user_id,
    base,
    passwordAction: `/${encodeURIComponent(segments[0])}`,
    extraOwnHosts: [host],
  });
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(request, ctx, null);
}
export async function HEAD(request: Request, ctx: Ctx) {
  return handle(request, ctx, null);
}
export async function POST(request: Request, ctx: Ctx) {
  return handle(request, ctx, await readPasswordField(request));
}

