import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isCustomHost, customHostRewritePath, normalizeHostHeader } from "@/lib/domains/host";

function ownHostList(): string[] {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com").hostname.toLowerCase();
    const bare = host.replace(/^www\./, "");
    return [host, bare, `www.${bare}`];
  } catch {
    return ["linklazy.com", "www.linklazy.com"];
  }
}

export async function proxy(request: NextRequest) {
  // Customer custom domains (Batch 11): rewrite everything to the redirect-only route, before
  // any session work. No other page or API of the app can be reached through such a host.
  const host = normalizeHostHeader(request.headers.get("host"));
  if (isCustomHost(host, ownHostList())) {
    const url = request.nextUrl.clone();
    url.pathname = customHostRewritePath(host, request.nextUrl.pathname);
    return NextResponse.rewrite(url);
  }
  // Public short-link redirects (/l/<slug>) and bio pages (/bio/<slug>) must stay fast, so on
  // linklazy.com they skip the Supabase session refresh (one network round-trip) that every other page pays.
  const path = request.nextUrl.pathname;
  if (path.startsWith("/l/") || path.startsWith("/bio/")) return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    // /l/ and /bio/ are NOT excluded here any more: on a customer domain they must be rewritten like every other path
    // (otherwise linklazy.com's own pages would be reachable there). The function above skips session work for them on our own host.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
