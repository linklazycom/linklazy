import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideGate, toolForPath } from "@/lib/features/registry";
import { getToolFlags } from "@/lib/features/gate";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// PERF: role/ban status used to require a second DB round-trip (a
// `profiles` query) on every single /dashboard and /admin navigation, on
// top of the auth.getUser() round-trip. A Supabase Custom Access Token
// Hook (see sql/004_custom_access_token_hook.sql) now embeds
// user_role/is_banned/is_suspended directly into the JWT, so we read
// those from the token instead. Decoding (not verifying) the payload here
// is safe: auth.getUser() below already validated the token's signature
// against Supabase's Auth server. If a token predates the hook being
// enabled (or the hook isn't set up yet), these claims are simply absent
// and we fall back to the old DB query so nothing breaks.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith("/dashboard");
  const isAdmin = path.startsWith("/admin");
  let knownRole: string | undefined;

  if ((isDashboard || isAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if ((isDashboard || isAdmin) && user) {
    const {
      data: { session },
    } = await supabase.auth.getSession(); // reads from cookies, no extra network call
    const claims = session ? decodeJwtPayload(session.access_token) : null;
    const claimsHaveRole = claims !== null && "user_role" in claims;

    let role: string | undefined;
    let isBanned = false;
    let isSuspended = false;

    if (claimsHaveRole) {
      role = claims!.user_role as string;
      isBanned = claims!.is_banned === true;
      isSuspended = claims!.is_suspended === true;
    } else {
      // Fallback: token issued before the custom access token hook was
      // enabled (or the hook isn't set up yet in Supabase). Same DB query
      // as before — just a safety net, not the common case.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_banned, is_suspended")
        .eq("id", user!.id)
        .single();
      role = profile?.role;
      isBanned = profile?.is_banned === true;
      isSuspended = profile?.is_suspended === true;
    }

    knownRole = role;
    if (isDashboard && (isBanned || isSuspended)) {
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      url.searchParams.set("reason", isBanned ? "banned" : "suspended");
      return NextResponse.redirect(url);
    }

    if (isAdmin && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Tool switches (Batch 16C): a tool an admin switched off is closed to ordinary users, in the page and in its API.
  // Only requests that belong to a switchable tool cost a settings lookup; any failure leaves the tool open.
  if (user && toolForPath(path)) {
    const flags = await getToolFlags();
    const hit = toolForPath(path)!;
    if (flags[hit.tool.flagKey] === false) {
      if (knownRole === undefined) knownRole = await resolveRole(supabase, user.id);
      const gate = decideGate(path, knownRole, flags);
      if (gate.action === "redirect") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/unavailable";
        url.search = "";
        url.searchParams.set("tool", hit.tool.id);
        return NextResponse.redirect(url);
      }
      if (gate.action === "block") {
        return NextResponse.json({ error: "This tool is currently switched off.", unavailable: true }, { status: 503 });
      }
    }
  }

  return response;
}

async function resolveRole(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<string | undefined> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeJwtPayload(session.access_token) : null;
    if (claims && "user_role" in claims) return claims.user_role as string;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    return profile?.role;
  } catch {
    return undefined;
  }
}
